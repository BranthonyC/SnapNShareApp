import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { getItem, queryItems, updateItem, batchDelete } from '../../shared/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, forbidden, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;

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

/**
 * Delete S3 objects associated with a media item (original + thumbnails).
 * Silently ignores missing keys.
 */
async function deleteS3Objects(mediaItem) {
  const keys = [mediaItem.s3Key, mediaItem.thumbnailKey, mediaItem.mediumKey].filter(Boolean);
  await Promise.all(
    keys.map((key) =>
      s3.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: key })).catch((err) => {
        logger.warn('Failed to delete S3 object', { key, error: err.message });
      }),
    ),
  );
}

/**
 * Delete all related items (REACTIONs, COMMENTs, REPORTs) for a media item.
 */
async function deleteRelatedItems(mediaId) {
  const pk = `MEDIA#${mediaId}`;

  // Collect all items under this PK (reactions, comments, reports)
  const allKeys = [];
  let cursor = null;
  do {
    const { items, nextCursor } = await queryItems(pk, '', { cursor, limit: 100 });
    for (const item of items) {
      allKeys.push({ PK: item.PK, SK: item.SK });
    }
    cursor = nextCursor;
  } while (cursor);

  if (allKeys.length > 0) {
    await batchDelete(allKeys);
  }
}

export async function handler(event) {
  try {
    // ── Auth: host only ──────────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    // ── Path params ──────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    const mediaId = event.pathParameters?.mediaId;
    if (!eventId || !mediaId) {
      return validationError('eventId and mediaId path parameters are required');
    }

    // ── Verify event exists ──────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Find the MEDIA item ──────────────────────────────────────────────
    const mediaItem = await findMediaItem(eventId, mediaId);
    if (!mediaItem) {
      return notFound('MEDIA_NOT_FOUND', 'Media not found');
    }

    // ── Delete S3 objects ────────────────────────────────────────────────
    await deleteS3Objects(mediaItem);

    // ── Delete the MEDIA DDB item ────────────────────────────────────────
    await batchDelete([{ PK: mediaItem.PK, SK: mediaItem.SK }]);

    // ── Delete related items (reactions, comments, reports) ──────────────
    await deleteRelatedItems(mediaId);

    // ── Decrement uploadCount on EVENT record (atomic) ───────────────────
    try {
      await updateItem(
        `EVENT#${eventId}`,
        'METADATA',
        'SET uploadCount = uploadCount - :one',
        { ':one': 1, ':zero': 0 },
        undefined,
        'uploadCount > :zero',
      );
    } catch (updateErr) {
      logger.warn('Failed to decrement uploadCount', { eventId, error: updateErr.message });
    }

    logger.info('Media deleted', { eventId, mediaId });
    return ok({ message: 'Media deleted' });
  } catch (err) {
    logger.error('deleteMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
