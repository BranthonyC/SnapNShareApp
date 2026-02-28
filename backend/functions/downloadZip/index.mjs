import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getItem, queryItems } from '../../shared/dynamodb.mjs';
import { ok, validationError, forbidden, unauthorized, notFound, serverError, error } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

const s3 = new S3Client({});
const BUCKET = process.env.MEDIA_BUCKET || process.env.S3_BUCKET;
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

export async function handler(event) {
  try {
    // ── Auth: host only ───────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    // ── Path param ────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Cross-check JWT eventId against path eventId ──────────────────
    if (auth.eventIds && !auth.eventIds.includes(eventId)) {
      if (auth.eventId && auth.eventId !== eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
      if (!auth.eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
    }

    // ── Get event & verify tier ───────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    if (ev.tier === 'basic') {
      return forbidden('TIER_UPGRADE_REQUIRED', 'Bulk download requires paid or premium tier');
    }

    // ── Query all visible MEDIA items ─────────────────────────────────
    const allMedia = [];
    let mediaCursor = null;
    do {
      const result = await queryItems(
        `EVENT#${eventId}`,
        'MEDIA#',
        {
          limit: 100,
          cursor: mediaCursor,
          filterExpr: '#status = :visible',
          exprValues: { ':visible': 'visible' },
          exprNames: { '#status': 'status' },
        },
      );
      allMedia.push(...result.items);
      mediaCursor = result.nextCursor;
    } while (mediaCursor);

    if (allMedia.length === 0) {
      return ok({
        files: [],
        fileCount: 0,
        estimatedSize: 0,
        message: 'No visible media files to download',
      });
    }

    // ── Generate presigned URLs for each file ─────────────────────────
    const files = [];
    let estimatedSize = 0;

    for (const media of allMedia) {
      const s3Key = media.s3Key;
      if (!s3Key) continue;

      const fileSize = media.fileSize || 0;
      estimatedSize += fileSize;

      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
        });

        const presignedUrl = await getSignedUrl(s3, command, {
          expiresIn: PRESIGNED_URL_EXPIRY,
        });

        files.push({
          mediaId: media.mediaId,
          fileName: media.fileName || s3Key.split('/').pop(),
          fileType: media.fileType,
          fileSize,
          url: presignedUrl,
        });
      } catch (presignErr) {
        logger.warn('Failed to generate presigned URL', {
          mediaId: media.mediaId,
          s3Key,
          error: presignErr.message,
        });
      }
    }

    logger.info('Download links generated', {
      eventId,
      fileCount: files.length,
      estimatedSize,
    });

    // TODO: Implement actual ZIP archive generation using archiver package
    // For now, return individual presigned URLs that the frontend can download

    return ok({
      files,
      fileCount: files.length,
      estimatedSize,
      expiresIn: PRESIGNED_URL_EXPIRY,
    });
  } catch (err) {
    logger.error('downloadZip error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
