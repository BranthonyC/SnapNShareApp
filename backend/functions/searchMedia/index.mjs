import { getItem, queryItems } from '../../shared/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function handler(event) {
  try {
    // ── Auth: guest or host ──────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();

    // ── Path params ──────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Query params ─────────────────────────────────────────────────────
    const q = event.queryStringParameters?.q;
    const cursor = event.queryStringParameters?.cursor || null;
    let limit = parseInt(event.queryStringParameters?.limit || DEFAULT_LIMIT, 10);

    if (!q || q.trim().length === 0) {
      return validationError('q (search term) query parameter is required');
    }

    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    // ── Verify event exists ──────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Build filter expression ──────────────────────────────────────────
    // Always filter by uploadedBy containing search term
    let filterExpr = 'contains(uploadedBy, :q)';
    const exprValues = { ':q': q.trim() };
    const exprNames = {};

    // For guests: also filter for visible status only
    if (auth.role !== 'host') {
      filterExpr += ' AND #status = :visible';
      exprValues[':visible'] = 'visible';
      exprNames['#status'] = 'status';
    }

    // ── Query MEDIA items with filter ────────────────────────────────────
    const { items, nextCursor } = await queryItems(
      `EVENT#${eventId}`,
      'MEDIA#',
      {
        limit,
        cursor,
        scanForward: false, // newest first
        filterExpr,
        exprValues,
        exprNames: Object.keys(exprNames).length > 0 ? exprNames : undefined,
      },
    );

    logger.info('Media search', { eventId, q, resultCount: items.length });

    return ok({
      items,
      nextCursor,
    });
  } catch (err) {
    logger.error('searchMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
