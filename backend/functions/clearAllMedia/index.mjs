import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { getItem, queryItems, updateItem, batchDelete } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, forbidden, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;

/**
 * Delete S3 objects associated with a media item.
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

    // ── Require confirmation header ──────────────────────────────────────
    const confirmHeader = event.headers?.['x-confirm-delete'] || event.headers?.['X-Confirm-Delete'];
    if (confirmHeader !== 'true') {
      return validationError('X-Confirm-Delete: true header is required');
    }

    // ── Path params ──────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Verify event exists ──────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Query ALL MEDIA items for event (paginate through all) ───────────
    const allMediaItems = [];
    let cursor = null;
    do {
      const { items, nextCursor } = await queryItems(
        `EVENT#${eventId}`,
        'MEDIA#',
        { cursor, limit: 100 },
      );
      allMediaItems.push(...items);
      cursor = nextCursor;
    } while (cursor);

    const totalCount = allMediaItems.length;

    if (totalCount === 0) {
      return ok({ message: 'No media to delete', count: 0 });
    }

    // ── Collect DDB keys for batch delete ────────────────────────────────
    const mediaKeys = allMediaItems.map((item) => ({ PK: item.PK, SK: item.SK }));

    // ── Delete all S3 objects and related items (best-effort) ─────────────
    // Process in parallel batches to stay within Lambda timeout
    const BATCH_SIZE = 10;
    for (let i = 0; i < allMediaItems.length; i += BATCH_SIZE) {
      const batch = allMediaItems.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (mediaItem) => {
          try {
            await deleteS3Objects(mediaItem);
            await deleteRelatedItems(mediaItem.mediaId);
          } catch (itemErr) {
            logger.warn('Failed to clean up media item', { mediaId: mediaItem.mediaId, error: itemErr.message });
          }
        }),
      );
    }

    // ── Batch delete all MEDIA DDB items ─────────────────────────────────
    await batchDelete(mediaKeys);

    // ── Reset uploadCount to 0 on EVENT ──────────────────────────────────
    try {
      await updateItem(
        `EVENT#${eventId}`,
        'METADATA',
        'SET uploadCount = :zero',
        { ':zero': 0 },
      );
    } catch (updateErr) {
      logger.warn('Failed to reset uploadCount', { eventId, error: updateErr.message });
    }

    logger.info('All media cleared', { eventId, count: totalCount });
    return ok({ message: 'All media scheduled for deletion', count: totalCount });
  } catch (err) {
    logger.error('clearAllMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
