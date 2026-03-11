import { queryItems } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, unauthorized, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function handler(event) {
  try {
    // ── Auth: guest or host ─────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();

    // ── Path params ─────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    const mediaId = event.pathParameters?.mediaId;
    if (!eventId || !mediaId) {
      return validationError('eventId and mediaId path parameters are required');
    }

    // ── Query params ────────────────────────────────────────────────────
    const queryParams = event.queryStringParameters || {};
    const cursor = queryParams.cursor || null;
    let limit = parseInt(queryParams.limit, 10) || DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (limit < 1) limit = DEFAULT_LIMIT;

    // ── Query comments for this media item ──────────────────────────────
    // Guests only see 'visible' comments; hosts see all
    const queryOpts = {
      limit,
      cursor,
      scanForward: true, // ascending by createdAt (embedded in SK)
    };

    if (auth.role !== 'host') {
      queryOpts.filterExpr = '(attribute_not_exists(#st) OR #st = :visible)';
      queryOpts.exprNames = { '#st': 'status' };
      queryOpts.exprValues = { ':visible': 'visible' };
    }

    const { items, nextCursor } = await queryItems(
      `MEDIA#${mediaId}`,
      'COMMENT#',
      queryOpts,
    );

    // ── Strip internal keys from each comment ───────────────────────────
    const comments = items.map(({ PK, SK, ...comment }) => comment);

    logger.debug('Listed comments', { eventId, mediaId, count: comments.length });

    return ok({
      items: comments,
      nextCursor,
    });
  } catch (err) {
    logger.error('listComments error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
