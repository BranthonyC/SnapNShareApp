import { getItem, putItemIfNotExists, queryItems, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, notFound, unauthorized, forbidden, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const VALID_REASONS = ['inappropriate', 'spam', 'other'];
const DESCRIPTION_MAX_LENGTH = 500;
const AUTO_REPORT_THRESHOLD = 3;

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

export async function handler(event) {
  try {
    // ── Auth: guest (guests report content) ──────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();

    // ── Path params ──────────────────────────────────────────────────────
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
      return forbidden('OTP_REQUIRED', 'Email verification is required before reporting');
    }

    // ── Parse & validate body ────────────────────────────────────────────
    const body = parseBody(event);
    const { reason, description } = body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return validationError('reason must be one of: inappropriate, spam, other');
    }
    if (description && description.length > DESCRIPTION_MAX_LENGTH) {
      return validationError(`description must be at most ${DESCRIPTION_MAX_LENGTH} characters`);
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

    // ── Create REPORT record (one per session) ───────────────────────────
    const now = new Date().toISOString();
    const reportItem = {
      PK: `MEDIA#${mediaId}`,
      SK: `REPORT#${auth.sub}`,
      reason,
      description: description || null,
      sessionId: auth.sub,
      eventId,
      mediaId,
      createdAt: now,
    };

    try {
      await putItemIfNotExists(reportItem);
    } catch (condErr) {
      if (condErr.name === 'ConditionalCheckFailedException') {
        return validationError('You have already reported this media', { code: 'ALREADY_REPORTED' });
      }
      throw condErr;
    }

    // ── Increment reportCount on the MEDIA item ──────────────────────────
    let newReportCount = 1;
    try {
      const updated = await updateItem(
        mediaItem.PK,
        mediaItem.SK,
        'SET reportCount = if_not_exists(reportCount, :zero) + :one',
        { ':one': 1, ':zero': 0 },
      );
      newReportCount = updated.reportCount || 1;
    } catch (updateErr) {
      logger.warn('Failed to increment reportCount', { mediaId, error: updateErr.message });
    }

    // ── Auto-flag if reportCount >= threshold ────────────────────────────
    if (newReportCount >= AUTO_REPORT_THRESHOLD) {
      try {
        await updateItem(
          mediaItem.PK,
          mediaItem.SK,
          'SET #status = :reported',
          { ':reported': 'reported' },
          { '#status': 'status' },
        );
        logger.info('Media auto-flagged as reported', { eventId, mediaId, reportCount: newReportCount });
      } catch (flagErr) {
        logger.warn('Failed to auto-flag media', { mediaId, error: flagErr.message });
      }
    }

    logger.info('Report submitted', { eventId, mediaId, reason, sessionId: auth.sub });
    return ok({ message: 'Report submitted' });
  } catch (err) {
    logger.error('reportMedia error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
