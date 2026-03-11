import { getItem, putItem, queryItems, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, created, validationError, notFound, unauthorized, forbidden, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest, generateSessionId } from '/opt/nodejs/auth.mjs';
import { parseBody, sanitizeHtml, validateComment } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

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
    },
  );
  return items.length > 0 ? items[0] : null;
}

/**
 * Find a COMMENT item by commentId under a media item.
 */
async function findCommentItem(mediaId, commentId) {
  const { items } = await queryItems(
    `MEDIA#${mediaId}`,
    'COMMENT#',
    {
      filterExpr: 'commentId = :commentId',
      exprValues: { ':commentId': commentId },
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

    // ── Cross-check JWT eventId against path eventId ─────────────────
    if (auth.eventId && auth.eventId !== eventId) {
      return forbidden('EVENT_MISMATCH', 'Token does not match this event');
    }

    // ── OTP verification required for guests ──────────────────────────
    if (auth.role === 'guest' && !auth.verified) {
      return forbidden('OTP_REQUIRED', 'Email verification is required before commenting');
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const body = parseBody(event);

    // ── Handle "like" action on an existing comment ─────────────────────
    if (body.action === 'like' && body.commentId) {
      const comment = await findCommentItem(mediaId, body.commentId);
      if (!comment) {
        return notFound('COMMENT_NOT_FOUND', 'Comment not found');
      }

      // Check if already liked (toggle)
      const likePK = `COMMENT#${body.commentId}`;
      const likeSK = `LIKE#${auth.sub}`;
      const existing = await getItem(likePK, likeSK);

      if (existing) {
        await deleteItem(likePK, likeSK);
        try {
          await updateItem(
            comment.PK, comment.SK,
            'SET likeCount = likeCount - :one',
            { ':one': 1 },
          );
        } catch (e) {
          logger.warn('Failed to decrement likeCount', { error: e.message });
        }
        logger.info('Comment unliked', { commentId: body.commentId, sessionId: auth.sub });
        return ok({ liked: false, commentId: body.commentId });
      } else {
        await putItem({ PK: likePK, SK: likeSK, sessionId: auth.sub, createdAt: new Date().toISOString() });
        try {
          await updateItem(
            comment.PK, comment.SK,
            'SET likeCount = if_not_exists(likeCount, :zero) + :one',
            { ':one': 1, ':zero': 0 },
          );
        } catch (e) {
          logger.warn('Failed to increment likeCount', { error: e.message });
        }
        logger.info('Comment liked', { commentId: body.commentId, sessionId: auth.sub });
        return ok({ liked: true, commentId: body.commentId });
      }
    }

    // ── Standard comment creation ───────────────────────────────────────
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

    // ── Determine comment status based on autoApprove ──────────────────
    // Hosts always get auto-approved. Guests depend on event setting.
    const autoApprove = ev.autoApprove !== false; // default true for backwards compat
    const commentStatus = (auth.role === 'host' || autoApprove) ? 'visible' : 'pending_review';

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
      likeCount: 0,
      status: commentStatus,
    };

    await putItem(commentItem);

    // ── Increment commentCount on MEDIA item (only for visible comments) ──
    if (commentStatus === 'visible') {
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
    }

    logger.info('Comment added', { eventId, mediaId, commentId, status: commentStatus, sessionId: auth.sub });

    return created({
      commentId,
      text: sanitizedText,
      authorName,
      createdAt: now,
      likeCount: 0,
      status: commentStatus,
    });
  } catch (err) {
    logger.error('addComment error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
