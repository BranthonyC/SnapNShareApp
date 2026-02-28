import { getItem } from '../../shared/dynamodb.mjs';
import { ok, unauthorized, notFound, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://eventalbum.codersatelier.com';

// Fields only returned to a host session
const HOST_ONLY_FIELDS = new Set([
  'hostPasswordHash',
  'guestPassword',
  'checkoutId',
  'lastNotifiedAt',
  'hostEmail',
  'GSI1PK',
  'GSI1SK',
  'PK',
  'SK',
  'ipHash',
]);

// Internal DynamoDB key fields to strip from all responses
const INTERNAL_FIELDS = new Set(['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK']);

/**
 * Build a CloudFront URL for an S3 key.
 * For Phase 1, this is unsigned (no signed-URL key yet).
 * TODO: replace with @aws-sdk/cloudfront-signer once CF key pair is provisioned.
 */
function buildCdnUrl(s3Key) {
  if (!s3Key) return null;
  if (!CLOUDFRONT_DOMAIN) return null;
  return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
}

function buildEventResponse(ev, role) {
  const result = {};

  for (const [key, val] of Object.entries(ev)) {
    // Always strip internal DynamoDB keys
    if (INTERNAL_FIELDS.has(key)) continue;

    // Strip host-only fields for guests
    if (role !== 'host' && HOST_ONLY_FIELDS.has(key)) continue;

    result[key] = val;
  }

  // Enrich with computed / URL fields
  result.qrUrl = `${FRONTEND_URL}/e/${ev.eventId}`;
  result.adminUrl = role === 'host' ? `${FRONTEND_URL}/e/${ev.eventId}/admin` : undefined;

  // Resolve cover image URL
  if (ev.coverUrl) {
    result.coverUrl = buildCdnUrl(ev.coverUrl) ?? ev.coverUrl;
  }

  return result;
}

export async function handler(event) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const claims = await authenticateRequest(event);
    if (!claims) {
      return unauthorized();
    }

    // ── Path param ─────────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // Ensure JWT belongs to this event (prevent token reuse across events)
    if (claims.eventId !== eventId) {
      return unauthorized('Token is not valid for this event');
    }

    // ── Load event ─────────────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Track scan / unique visitor (fire-and-forget) ─────────────────────
    // Only count guest views as QR scans; host admin views are not scans.
    if (claims.role === 'guest') {
      incrementScanCountAsync(eventId, ev).catch((err) => {
        logger.warn('Failed to update scan count', { eventId, error: err.message });
      });
    }

    logger.info('getEvent', { eventId, role: claims.role, sessionId: claims.sub });

    return ok(buildEventResponse(ev, claims.role));
  } catch (err) {
    logger.error('getEvent error', { error: err.message, stack: err.stack });
    return serverError();
  }
}

/**
 * Atomically increment totalScans on the event record.
 * Runs async so it never blocks the response.
 */
async function incrementScanCountAsync(eventId, ev) {
  const { updateItem } = await import('../../shared/dynamodb.mjs');
  const now = new Date().toISOString();
  await updateItem(
    `EVENT#${eventId}`,
    'METADATA',
    'SET totalScans = totalScans + :one, lastScannedAt = :now',
    { ':one': 1, ':now': now },
    null,
    null,
  );
}
