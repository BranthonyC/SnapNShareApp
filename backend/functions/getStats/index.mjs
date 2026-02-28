import { getItem, queryItems } from '../../shared/dynamodb.mjs';
import { ok, validationError, forbidden, notFound, unauthorized, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

export async function handler(event) {
  try {
    // ── Auth: host only ─────────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    // ── Path param ──────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Cross-check JWT eventIds against path eventId ───────────────────
    if (auth.eventIds && !auth.eventIds.includes(eventId)) {
      if (auth.eventId && auth.eventId !== eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
      if (!auth.eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
    }

    // ── Get event record ────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Query all MEDIA items for the event ─────────────────────────────
    // Paginate through all media items to aggregate stats
    const allMedia = [];
    let mediaCursor = null;
    do {
      const result = await queryItems(
        `EVENT#${eventId}`,
        'MEDIA#',
        { limit: 100, cursor: mediaCursor },
      );
      allMedia.push(...result.items);
      mediaCursor = result.nextCursor;
    } while (mediaCursor);

    // ── Query all SESSION items for the event ───────────────────────────
    const allSessions = [];
    let sessionCursor = null;
    do {
      const result = await queryItems(
        `EVENT#${eventId}`,
        'SESSION#',
        { limit: 100, cursor: sessionCursor },
      );
      allSessions.push(...result.items);
      sessionCursor = result.nextCursor;
    } while (sessionCursor);

    // ── Aggregate upload stats ──────────────────────────────────────────
    const uploadsByType = {};
    let totalStorageBytes = 0;
    const storageByType = {};
    const moderationCounts = { pending: 0, approved: 0, rejected: 0, reported: 0 };
    let totalReactions = 0;
    const reactionsByEmoji = {};

    for (const media of allMedia) {
      // Determine type category from fileType (image/jpeg -> image)
      const typeCategory = media.fileType ? media.fileType.split('/')[0] : 'image';
      uploadsByType[typeCategory] = (uploadsByType[typeCategory] || 0) + 1;

      // Storage
      const fileSize = media.fileSize || 0;
      totalStorageBytes += fileSize;
      if (!storageByType[typeCategory]) {
        storageByType[typeCategory] = 0;
      }
      storageByType[typeCategory] += fileSize;

      // Moderation status
      const status = media.status || 'visible';
      if (status === 'pending_review') {
        moderationCounts.pending += 1;
      } else if (status === 'visible') {
        moderationCounts.approved += 1;
      } else if (status === 'hidden') {
        moderationCounts.rejected += 1;
      } else if (status === 'reported') {
        moderationCounts.reported += 1;
      }

      // Reaction counts from MEDIA item's reactionCounts map
      if (media.reactionCounts && typeof media.reactionCounts === 'object') {
        for (const [emoji, count] of Object.entries(media.reactionCounts)) {
          const numCount = Number(count) || 0;
          totalReactions += numCount;
          reactionsByEmoji[emoji] = (reactionsByEmoji[emoji] || 0) + numCount;
        }
      }
    }

    // ── Aggregate guest stats ───────────────────────────────────────────
    let guestTotal = 0;
    let guestVerified = 0;

    for (const session of allSessions) {
      if (session.role === 'guest') {
        guestTotal += 1;
        if (session.verified) {
          guestVerified += 1;
        }
      }
    }

    // ── Build response ──────────────────────────────────────────────────
    const stats = {
      uploads: {
        count: ev.uploadCount || allMedia.length,
        limit: ev.uploadLimit,
        byType: uploadsByType,
      },
      guests: {
        total: guestTotal,
        verified: guestVerified,
      },
      reactions: {
        total: totalReactions,
        byEmoji: reactionsByEmoji,
      },
      storage: {
        totalBytes: totalStorageBytes,
        byType: storageByType,
      },
      moderation: moderationCounts,
    };

    logger.info('Stats retrieved', { eventId, mediaCount: allMedia.length, guestCount: guestTotal });

    return ok(stats);
  } catch (err) {
    logger.error('getStats error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
