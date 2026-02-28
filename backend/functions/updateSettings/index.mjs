import { getItem, updateItem } from '../../shared/dynamodb.mjs';
import { ok, validationError, forbidden, notFound, unauthorized, serverError } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { parseBody, validateSettings } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

// Allowed settings fields
const ALLOWED_SETTINGS = new Set([
  'galleryPrivacy',
  'allowDownloads',
  'allowVideo',
  'emailNotifications',
  'autoApprove',
  'colorTheme',
  'showDateTime',
]);

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

    // ── Parse body ──────────────────────────────────────────────────────
    const body = parseBody(event);

    // Filter to only allowed settings fields
    const settingsBody = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_SETTINGS.has(key)) {
        settingsBody[key] = value;
      }
    }

    if (Object.keys(settingsBody).length === 0) {
      return validationError('No valid settings fields provided');
    }

    // ── Fetch event to get tier for validation ──────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev) {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    if (ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Validate settings against tier ──────────────────────────────────
    const validationErrors = validateSettings(settingsBody, ev.tier);
    if (validationErrors.length > 0) {
      return validationError('Invalid settings', { fields: validationErrors });
    }

    // ── Build dynamic UpdateExpression ──────────────────────────────────
    const updateParts = [];
    const exprValues = {};
    const exprNames = {};

    for (const [key, value] of Object.entries(settingsBody)) {
      const safeKey = `#${key}`;
      const safeVal = `:${key}`;
      exprNames[safeKey] = key;
      exprValues[safeVal] = value;
      updateParts.push(`${safeKey} = ${safeVal}`);
    }

    // Always update updatedAt
    updateParts.push('#updatedAt = :updatedAt');
    exprNames['#updatedAt'] = 'updatedAt';
    exprValues[':updatedAt'] = new Date().toISOString();

    const updateExpr = `SET ${updateParts.join(', ')}`;

    const updated = await updateItem(
      `EVENT#${eventId}`,
      'METADATA',
      updateExpr,
      exprValues,
      exprNames,
    );

    // ── Build settings response with only the updated values ────────────
    const settings = {};
    for (const key of ALLOWED_SETTINGS) {
      if (updated[key] !== undefined) {
        settings[key] = updated[key];
      }
    }

    logger.info('Settings updated', { eventId, fields: Object.keys(settingsBody) });

    return ok({
      message: 'Settings updated',
      settings,
    });
  } catch (err) {
    logger.error('updateSettings error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
