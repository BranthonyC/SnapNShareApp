import { getItem } from '../../shared/dynamodb.mjs';
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

    logger.info('QR stats retrieved', { eventId });

    return ok({
      totalScans: ev.totalScans || 0,
      uniqueVisitors: ev.uniqueVisitors || 0,
      lastScannedAt: ev.lastScannedAt || null,
    });
  } catch (err) {
    logger.error('getQrStats error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
