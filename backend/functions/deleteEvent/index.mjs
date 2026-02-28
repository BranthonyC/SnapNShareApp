import { getItem, updateItem } from '../../shared/dynamodb.mjs';
import { ok, validationError, forbidden, notFound, unauthorized, serverError, error } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { logger } from '../../shared/logger.mjs';

// Grace period before DynamoDB TTL auto-deletes: 24 hours
const GRACE_PERIOD_SECONDS = 24 * 60 * 60;

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

    // ── Require confirmation header ─────────────────────────────────────
    const confirmHeader =
      event.headers?.['x-confirm-delete'] ||
      event.headers?.['X-Confirm-Delete'];
    if (confirmHeader !== 'true') {
      return error('CONFIRMATION_REQUIRED', 'Missing X-Confirm-Delete header', 400);
    }

    // ── Verify event exists ─────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev) {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    if (ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Soft delete: set status=deleted, TTL = now + 24h ────────────────
    const now = new Date().toISOString();
    const nowUnix = Math.floor(Date.now() / 1000);
    const deletesAtUnix = nowUnix + GRACE_PERIOD_SECONDS;
    const deletesAt = new Date(deletesAtUnix * 1000).toISOString();

    await updateItem(
      `EVENT#${eventId}`,
      'METADATA',
      'SET #status = :status, #expiresAtTTL = :ttl, #deletedAt = :deletedAt',
      {
        ':status': 'deleted',
        ':ttl': deletesAtUnix,
        ':deletedAt': now,
      },
      {
        '#status': 'status',
        '#expiresAtTTL': 'expiresAtTTL',
        '#deletedAt': 'deletedAt',
      },
    );

    logger.info('Event scheduled for deletion', { eventId, deletesAt });

    return ok({
      message: 'Event scheduled for deletion',
      deletesAt,
    });
  } catch (err) {
    logger.error('deleteEvent error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
