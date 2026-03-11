import { getItem, queryItems } from '/opt/nodejs/dynamodb.mjs';
import { ok, unauthorized, notFound, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

// Default and maximum page sizes
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

// Media fields that are host-only (hidden from guests)
const HOST_ONLY_MEDIA_FIELDS = new Set([
  'moderationLabels',
  'rejectionReason',
]);

// Internal DynamoDB key attributes — always stripped
const INTERNAL_FIELDS = new Set(['PK', 'SK', 'GSI2PK', 'GSI2SK']);

/**
 * Build a CDN URL from an S3 key.
 * Phase 1: unsigned URL (CloudFront distribution is OAC-based but not signed).
 * TODO: replace with @aws-sdk/cloudfront-signer once CloudFront key pair is provisioned.
 *       Use getSignedUrl from cloudfront-signer for signed URLs in Phase 2.
 */
function buildCdnUrl(s3Key) {
  if (!s3Key) return null;
  if (!CLOUDFRONT_DOMAIN) return null;
  return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
}

/**
 * Enrich a MEDIA record with CDN URLs and strip internal / role-restricted fields.
 */
function buildMediaView(item, role) {
  const view = {};

  for (const [key, val] of Object.entries(item)) {
    if (INTERNAL_FIELDS.has(key)) continue;
    if (role !== 'host' && HOST_ONLY_MEDIA_FIELDS.has(key)) continue;
    view[key] = val;
  }

  // Resolve full, thumbnail, and medium URLs
  view.url = buildCdnUrl(item.s3Key) ?? item.s3Key ?? null;
  view.thumbnailUrl = buildCdnUrl(item.thumbnailKey) ?? item.thumbnailKey ?? null;
  view.mediumUrl = buildCdnUrl(item.mediumKey) ?? item.mediumKey ?? null;

  return view;
}

export async function handler(event) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const claims = await authenticateRequest(event);
    if (!claims) {
      return unauthorized();
    }

    const { eventId: tokenEventId, eventIds: tokenEventIds, role } = claims;

    // ── Path param ─────────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // Host JWTs have eventIds (plural array); guest JWTs have eventId (singular)
    if (tokenEventIds && !tokenEventIds.includes(eventId)) {
      return unauthorized('Token is not valid for this event');
    }
    if (!tokenEventIds && tokenEventId !== eventId) {
      return unauthorized('Token is not valid for this event');
    }

    // ── Query string params ────────────────────────────────────────────────
    const qs = event.queryStringParameters || {};
    const cursor = qs.cursor ?? null;

    const rawLimit = parseInt(qs.limit ?? String(DEFAULT_PAGE_SIZE), 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    // Hosts can filter by status; guests always see only 'visible' items
    const statusFilter = role === 'host' && qs.status ? qs.status : null;

    // Sort order: newest first by default
    const scanForward = qs.order === 'asc';

    // ── Verify event exists ────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Build query options ────────────────────────────────────────────────
    const queryOptions = {
      limit,
      cursor,
      scanForward,
      // Use GSI2 for time-sorted access (GSI2PK = EVENT#{id}, GSI2SK = MEDIA#{timestamp})
      indexName: 'GSI2',
    };

    // Apply status filter expression
    if (statusFilter) {
      // Host filtering by specific status
      queryOptions.filterExpr = '#st = :status';
      queryOptions.exprValues = { ':status': statusFilter };
      queryOptions.exprNames = { '#st': 'status' };
    } else if (role !== 'host') {
      // Guests only see visible items
      queryOptions.filterExpr = '#st = :status';
      queryOptions.exprValues = { ':status': 'visible' };
      queryOptions.exprNames = { '#st': 'status' };
    }
    // Host with no status filter → no filter (sees all statuses)

    // ── Query DynamoDB ─────────────────────────────────────────────────────
    const { items, nextCursor } = await queryItems(
      `EVENT#${eventId}`,
      'MEDIA#',
      queryOptions,
    );

    // ── Build response items ───────────────────────────────────────────────
    const responseItems = items.map((item) => buildMediaView(item, role));

    logger.info('listMedia', {
      eventId,
      role,
      count: responseItems.length,
      hasCursor: !!nextCursor,
      statusFilter: statusFilter ?? (role !== 'host' ? 'visible' : 'all'),
    });

    return ok({
      items: responseItems,
      nextCursor,
      // total is the count in this page; exact total requires a separate scan
      // which is expensive — the client should use nextCursor for pagination
      count: responseItems.length,
      // Provide the overall event upload count as a cheap approximation for UI progress bars
      uploadCount: ev.uploadCount,
      uploadLimit: ev.uploadLimit,
    });
  } catch (err) {
    logger.error('listMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
