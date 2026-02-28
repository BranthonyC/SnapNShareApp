import { getItem, queryItems } from '../../shared/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, forbidden, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function handler(event) {
  try {
    // ── Auth: host only ──────────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    // ── Path params ──────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Query params ─────────────────────────────────────────────────────
    const cursor = event.queryStringParameters?.cursor || null;
    let limit = parseInt(event.queryStringParameters?.limit || DEFAULT_LIMIT, 10);
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    // ── Verify event exists ──────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Query MEDIA items sorted by uploadedAt descending ────────────────
    const { items: mediaItems, nextCursor } = await queryItems(
      `EVENT#${eventId}`,
      'MEDIA#',
      {
        limit,
        cursor,
        scanForward: false, // newest first
      },
    );

    // ── Build activity feed from MEDIA items ─────────────────────────────
    const activityItems = mediaItems.map((item) => {
      const isVideo = item.fileType?.startsWith('video/');
      const isAudio = item.fileType?.startsWith('audio/');
      let mediaType = 'photo';
      if (isVideo) mediaType = 'video';
      if (isAudio) mediaType = 'audio';

      return {
        type: 'upload',
        actor: item.uploadedBy || 'Anonymous',
        detail: `uploaded a ${mediaType}`,
        mediaId: item.mediaId,
        thumbnailUrl: item.thumbnailKey || null,
        timestamp: item.uploadedAt || item.createdAt,
      };
    });

    logger.info('Activity feed fetched', { eventId, count: activityItems.length });

    return ok({
      items: activityItems,
      nextCursor,
    });
  } catch (err) {
    logger.error('getActivity error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
