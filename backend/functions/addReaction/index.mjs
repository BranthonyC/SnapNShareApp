import { getItem, putItem, deleteItem, queryItems, updateItem } from '../../shared/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { parseBody, validateReaction } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

/**
 * Find a MEDIA item by mediaId within an event.
 * MEDIA SK pattern: MEDIA#<timestamp>#<mediaId>
 * We query all MEDIA# items and filter by mediaId attribute.
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
    const validationErrors = validateReaction(body);
    if (validationErrors.length > 0) {
      return validationError('Invalid reaction', { fields: validationErrors });
    }

    const { emoji } = body;

    // ── Verify event exists ─────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Find the MEDIA item (need its full SK for updates) ──────────────
    const mediaItem = await findMediaItem(eventId, mediaId);
    if (!mediaItem) {
      return notFound('MEDIA_NOT_FOUND', 'Media not found');
    }

    // ── Check if reaction already exists (toggle behavior) ──────────────
    const reactionPK = `MEDIA#${mediaId}`;
    const reactionSK = `REACTION#${auth.sub}#${emoji}`;
    const existingReaction = await getItem(reactionPK, reactionSK);

    let toggled;

    if (existingReaction) {
      // ── Remove reaction (toggle off) ──────────────────────────────────
      await deleteItem(reactionPK, reactionSK);

      // Decrement reactionCounts on MEDIA item atomically
      try {
        await updateItem(
          mediaItem.PK,
          mediaItem.SK,
          'SET reactionCounts.#emoji = reactionCounts.#emoji - :one',
          { ':one': 1 },
          { '#emoji': emoji },
        );
      } catch (updateErr) {
        // If the emoji key doesn't exist in the map, just ignore
        logger.warn('Failed to decrement reactionCounts', { mediaId, emoji, error: updateErr.message });
      }

      toggled = false;
      logger.info('Reaction removed', { eventId, mediaId, emoji, sessionId: auth.sub });
    } else {
      // ── Add reaction (toggle on) ──────────────────────────────────────
      const now = new Date().toISOString();

      const reactionItem = {
        PK: reactionPK,
        SK: reactionSK,
        emoji,
        sessionId: auth.sub,
        eventId,
        mediaId,
        createdAt: now,
      };

      await putItem(reactionItem);

      // Increment reactionCounts on MEDIA item atomically
      // First ensure the reactionCounts map exists, then increment the emoji key
      try {
        // Try incrementing the existing emoji key
        await updateItem(
          mediaItem.PK,
          mediaItem.SK,
          'SET reactionCounts.#emoji = if_not_exists(reactionCounts.#emoji, :zero) + :one',
          { ':one': 1, ':zero': 0 },
          { '#emoji': emoji },
        );
      } catch (updateErr) {
        // If reactionCounts map doesn't exist yet, create it
        try {
          await updateItem(
            mediaItem.PK,
            mediaItem.SK,
            'SET reactionCounts = :counts',
            { ':counts': { [emoji]: 1 } },
          );
        } catch (createErr) {
          logger.warn('Failed to initialize reactionCounts', { mediaId, error: createErr.message });
        }
      }

      toggled = true;
      logger.info('Reaction added', { eventId, mediaId, emoji, sessionId: auth.sub });
    }

    return ok({
      toggled,
      emoji,
    });
  } catch (err) {
    logger.error('addReaction error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
