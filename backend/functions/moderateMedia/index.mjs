import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { getItem, queryItems, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, forbidden, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;

const VALID_ACTIONS = ['approve', 'reject'];

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

    // ── Parse & validate body ────────────────────────────────────────────
    const body = parseBody(event);
    const { action } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return validationError('action must be "approve" or "reject"');
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

    // ── Apply moderation action ──────────────────────────────────────────
    let newStatus;

    if (action === 'approve') {
      newStatus = 'visible';
      await updateItem(
        mediaItem.PK,
        mediaItem.SK,
        'SET #status = :status, moderatedAt = :now, moderatedBy = :host',
        { ':status': 'visible', ':now': new Date().toISOString(), ':host': auth.sub },
        { '#status': 'status' },
      );
    } else {
      // reject: hide the media and optionally delete S3 objects
      newStatus = 'hidden';
      await updateItem(
        mediaItem.PK,
        mediaItem.SK,
        'SET #status = :status, moderatedAt = :now, moderatedBy = :host',
        { ':status': 'hidden', ':now': new Date().toISOString(), ':host': auth.sub },
        { '#status': 'status' },
      );

      // Delete S3 objects for rejected media
      await deleteS3Objects(mediaItem);
    }

    logger.info('Media moderated', { eventId, mediaId, action, newStatus });

    return ok({
      message: `Media ${action === 'approve' ? 'approved' : 'rejected'}`,
      status: newStatus,
    });
  } catch (err) {
    logger.error('moderateMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
