import { getItem, putItem, queryItems, updateItem } from '../../shared/dynamodb.mjs';
import { ok, created, validationError, notFound, unauthorized, serverError } from '../../shared/response.mjs';
import { authenticateRequest, generateSessionId } from '../../shared/auth.mjs';
import { parseBody, sanitizeHtml, validateComment } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

/**
 * Find a MEDIA item by mediaId within an event.
 * MEDIA SK pattern: MEDIA#<timestamp>#<mediaId>
 */
async function findMediaItem(eventId, mediaId) {
  const { items } = await queryItems(
    `EVENT#${eventId}`,
    'MEDIA#',
    {
      filterExpr: 'mediaId = :mediaId',
      exprValues: { ':mediaId': mediaId },
      limit: 1,
    },
  );
  return items.length > 0 ? items[0] : null;
}

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

    // ── Parse & validate body ───────────────────────────────────────────
    const body = parseBody(event);
    const validationErrors = validateComment(body);
    if (validationErrors.length > 0) {
      return validationError('Invalid comment', { fields: validationErrors });
    }

    // ── Verify event exists ─────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Find the MEDIA item (need its full SK for commentCount update) ──
    const mediaItem = await findMediaItem(eventId, mediaId);
    if (!mediaItem) {
      return notFound('MEDIA_NOT_FOUND', 'Media not found');
    }

    // ── Create comment ──────────────────────────────────────────────────
    const now = new Date().toISOString();
    const commentId = generateSessionId().replace('ses_', 'cmt_');
    const authorName = auth.nickname || auth.email || 'Host';
    const sanitizedText = sanitizeHtml(body.text);

    const commentItem = {
      PK: `MEDIA#${mediaId}`,
      SK: `COMMENT#${now}#${commentId}`,
      commentId,
      text: sanitizedText,
      authorName,
      sessionId: auth.sub,
      eventId,
      mediaId,
      createdAt: now,
    };

    await putItem(commentItem);

    // ── Increment commentCount on MEDIA item ────────────────────────────
    try {
      await updateItem(
        mediaItem.PK,
        mediaItem.SK,
        'SET commentCount = if_not_exists(commentCount, :zero) + :one',
        { ':one': 1, ':zero': 0 },
      );
    } catch (updateErr) {
      logger.warn('Failed to increment commentCount', { mediaId, error: updateErr.message });
    }

    logger.info('Comment added', { eventId, mediaId, commentId, sessionId: auth.sub });

    return created({
      commentId,
      text: sanitizedText,
      authorName,
      createdAt: now,
    });
  } catch (err) {
    logger.error('addComment error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
