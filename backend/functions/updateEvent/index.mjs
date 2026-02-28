import { getItem, updateItem } from '../../shared/dynamodb.mjs';
import { ok, validationError, forbidden, notFound, unauthorized, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { parseBody, sanitizeHtml, validateUpdateEvent } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

// Text fields that should be sanitized
const SANITIZE_FIELDS = new Set(['title', 'description', 'footerText', 'welcomeMessage']);

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
      // Also check the per-event JWT format (sub-based sessions)
      if (auth.eventId && auth.eventId !== eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
      if (!auth.eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
    }

    // ── Parse & validate body ───────────────────────────────────────────
    const body = parseBody(event);
    const validationErrors = validateUpdateEvent(body);
    if (validationErrors.length > 0) {
      return validationError('Invalid request body', { fields: validationErrors });
    }

    if (Object.keys(body).length === 0) {
      return validationError('No fields to update');
    }

    // ── Verify event exists ─────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev) {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    if (ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Build dynamic UpdateExpression ──────────────────────────────────
    const updateParts = [];
    const exprValues = {};
    const exprNames = {};
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(body)) {
      const safeKey = `#${key}`;
      const safeVal = `:${key}`;
      exprNames[safeKey] = key;
      exprValues[safeVal] = SANITIZE_FIELDS.has(key) && typeof value === 'string'
        ? sanitizeHtml(value)
        : value;
      updateParts.push(`${safeKey} = ${safeVal}`);
    }

    // Always update updatedAt
    updateParts.push('#updatedAt = :updatedAt');
    exprNames['#updatedAt'] = 'updatedAt';
    exprValues[':updatedAt'] = now;

    const updateExpr = `SET ${updateParts.join(', ')}`;

    const updated = await updateItem(
      `EVENT#${eventId}`,
      'METADATA',
      updateExpr,
      exprValues,
      exprNames,
    );

    logger.info('Event updated', { eventId, fields: Object.keys(body) });

    // ── Strip internal keys from response ───────────────────────────────
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, hostPasswordHash, ...safeEvent } = updated;

    return ok(safeEvent);
  } catch (err) {
    logger.error('updateEvent error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
