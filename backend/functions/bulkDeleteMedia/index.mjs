import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { getItem, queryItems, updateItem, batchDelete } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, forbidden, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;

const MAX_BULK_DELETE = 25;

/**
 * Find a MEDIA item by mediaId within an event.
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

    // ── Path params ──────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Parse & validate body ────────────────────────────────────────────
    const body = parseBody(event);
    const { mediaIds } = body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return validationError('mediaIds must be a non-empty array');
    }
    if (mediaIds.length > MAX_BULK_DELETE) {
      return validationError(`Maximum ${MAX_BULK_DELETE} media items per bulk delete`);
    }

    // ── Verify event exists ──────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Find all MEDIA items and collect S3 keys ─────────────────────────
    let deleted = 0;
    let failed = 0;
    const mediaKeys = []; // DDB keys to batch delete

    for (const mediaId of mediaIds) {
      try {
        const mediaItem = await findMediaItem(eventId, mediaId);
        if (!mediaItem) {
          failed++;
          logger.warn('Media not found during bulk delete', { eventId, mediaId });
          continue;
        }

        // Collect the DDB key
        mediaKeys.push({ PK: mediaItem.PK, SK: mediaItem.SK });

        // Delete S3 objects
        await deleteS3Objects(mediaItem);

        // Delete related items (reactions, comments, reports)
        await deleteRelatedItems(mediaId);

        deleted++;
      } catch (itemErr) {
        failed++;
        logger.warn('Failed to process media during bulk delete', { eventId, mediaId, error: itemErr.message });
      }
    }

    // ── Batch delete all MEDIA DDB items ─────────────────────────────────
    if (mediaKeys.length > 0) {
      await batchDelete(mediaKeys);
    }

    // ── Decrement uploadCount by count deleted ───────────────────────────
    if (deleted > 0) {
      try {
        await updateItem(
          `EVENT#${eventId}`,
          'METADATA',
          'SET uploadCount = uploadCount - :count',
          { ':count': deleted, ':zero': 0 },
          undefined,
          'uploadCount >= :zero',
        );
      } catch (updateErr) {
        logger.warn('Failed to decrement uploadCount', { eventId, error: updateErr.message });
      }
    }

    logger.info('Bulk delete completed', { eventId, deleted, failed });
    return ok({ deleted, failed });
  } catch (err) {
    logger.error('bulkDeleteMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
