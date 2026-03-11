import { randomUUID } from 'node:crypto';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getItem, putItem, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, unauthorized, forbidden, notFound, serverError, error } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { getTierConfig } from '/opt/nodejs/config.mjs';
import { validateUploadRequest, parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const s3 = new S3Client({
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;

// Presigned URL TTL in seconds
const PRESIGNED_URL_TTL = 180;

// Extension map for supported MIME types
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
};

function mimeCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'unknown';
}

export async function handler(event) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const claims = await authenticateRequest(event);
    if (!claims) {
      return unauthorized();
    }

    const { eventId, role, verified, sub: sessionId, nickname } = claims;

    // ── Path param must match token ────────────────────────────────────────
    const pathEventId = event.pathParameters?.eventId;
    if (!pathEventId || pathEventId !== eventId) {
      return unauthorized('Token is not valid for this event');
    }

    // ── OTP gate: paid/premium guests must be verified before uploading ────
    if (role === 'guest' && !verified) {
      return forbidden('OTP_REQUIRED', 'Email or SMS verification is required before uploading');
    }

    // ── Parse & validate body ──────────────────────────────────────────────
    const body = parseBody(event);
    const validationErrors = validateUploadRequest(body);
    if (validationErrors.length > 0) {
      return error('VALIDATION_ERROR', 'Invalid upload request', 400, { fields: validationErrors });
    }

    const { fileType, fileSize, fileName: rawFileName, type: uploadType } = body;

    // ── Load event ─────────────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    if (ev.status === 'locked') {
      return forbidden('EVENT_LOCKED', 'This event is currently locked');
    }

    // ── Cover image upload (host only, no upload count, no MEDIA record) ──
    if (uploadType === 'cover') {
      if (role !== 'host') {
        return forbidden('HOST_ONLY', 'Only hosts can upload cover images');
      }

      const category = mimeCategory(fileType);
      if (category !== 'image') {
        return error('INVALID_TYPE', 'Cover must be an image', 400);
      }

      // 10 MB limit for cover images
      if (fileSize > 10 * 1024 * 1024) {
        return error('FILE_TOO_LARGE', 'Cover image must be under 10MB', 413);
      }

      const ext = MIME_TO_EXT[fileType] || 'jpg';
      const s3Key = `events/${eventId}/cover.${ext}`;

      const putCommand = new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: s3Key,
        ContentType: fileType,
        ContentLength: fileSize,
        Tagging: `tier=${ev.tier}&eventId=${eventId}&type=cover`,
      });

      const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: PRESIGNED_URL_TTL });

      logger.info('Cover upload URL generated', { eventId, fileType, fileSize });

      return ok({
        uploadUrl,
        mediaId: null,
        s3Key,
        expiresIn: PRESIGNED_URL_TTL,
      });
    }

    // ── Tier config (from SSM cache) ───────────────────────────────────────
    const tierConfig = await getTierConfig(ev.tier);
    const {
      maxFileSizeBytes,
      mediaTypes: allowedMediaTypes,
    } = tierConfig;

    // ── File type check ────────────────────────────────────────────────────
    const category = mimeCategory(fileType);
    if (!allowedMediaTypes.includes(category)) {
      return forbidden(
        'MEDIA_TYPE_NOT_ALLOWED',
        `${category} uploads are not allowed on the ${ev.tier} tier`,
      );
    }

    // ── File size check ────────────────────────────────────────────────────
    if (fileSize > maxFileSizeBytes) {
      const maxMB = (maxFileSizeBytes / 1024 / 1024).toFixed(0);
      return error(
        'FILE_TOO_LARGE',
        `File size exceeds the ${maxMB}MB limit for the ${ev.tier} tier`,
        413,
      );
    }

    // ── Atomically increment uploadCount (ConditionalCheckFailedException → 429) ──
    let updatedEvent;
    try {
      updatedEvent = await updateItem(
        `EVENT#${eventId}`,
        'METADATA',
        'SET uploadCount = uploadCount + :one',
        { ':one': 1, ':limit': ev.uploadLimit },
        null,
        'uploadCount < :limit',
      );
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        return error(
          'UPLOAD_LIMIT_REACHED',
          `This event has reached its upload limit of ${ev.uploadLimit} files`,
          429,
        );
      }
      throw err;
    }

    // ── Also increment per-session upload count (best-effort) ─────────────
    updateItem(
      `EVENT#${eventId}`,
      `SESSION#${sessionId}`,
      'SET uploadCount = uploadCount + :one',
      { ':one': 1 },
      null,
      null,
    ).catch((err) => {
      logger.warn('Failed to increment session uploadCount', { sessionId, error: err.message });
    });

    // ── Generate media ID and S3 key ───────────────────────────────────────
    const mediaId = `med_${randomUUID().replace(/-/g, '')}`;
    const ext = MIME_TO_EXT[fileType] || 'bin';
    const s3Key = `events/${eventId}/${mediaId}.${ext}`;
    const uploadedAt = new Date().toISOString();

    // ── Create MEDIA record in DynamoDB (status: processing) ──────────────
    const mediaItem = {
      PK: `EVENT#${eventId}`,
      SK: `MEDIA#${uploadedAt}#${mediaId}`,
      GSI2PK: `EVENT#${eventId}`,
      GSI2SK: `MEDIA#${uploadedAt}`,

      mediaId,
      eventId,
      s3Key,
      thumbnailKey: null,
      mediumKey: null,
      fileType,
      fileSize,
      uploadedBy: nickname ?? 'Guest',
      uploadedAt,
      width: null,
      height: null,
      status: 'processing',
      moderationLabels: [],
      reportCount: 0,
      reactionCounts: {},
      commentCount: 0,
    };

    await putItem(mediaItem);

    // ── Generate presigned PUT URL ─────────────────────────────────────────
    const putCommand = new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: s3Key,
      ContentType: fileType,
      ContentLength: fileSize,
      // Tag objects with tier + eventId so lifecycle rules and cost allocation work
      Tagging: `tier=${ev.tier}&eventId=${eventId}`,
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: PRESIGNED_URL_TTL });

    logger.info('Upload URL generated', { eventId, mediaId, fileType, fileSize, role });

    return ok({
      uploadUrl,
      mediaId,
      s3Key,
      expiresIn: PRESIGNED_URL_TTL,
    });
  } catch (err) {
    logger.error('getUploadUrl error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
