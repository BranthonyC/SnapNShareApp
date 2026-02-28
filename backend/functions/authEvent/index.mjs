import { createHash } from 'node:crypto';

import { getItem, putItem } from '../../shared/dynamodb.mjs';
import { ok, validationError, notFound, forbidden, serverError, error } from '../../shared/response.mjs';
import { signJwt, generateSessionId } from '../../shared/auth.mjs';
import { validateAuthEvent, parseBody, sanitizeHtml } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

// Guest session TTL: 48 hours (covers full event + some grace)
const GUEST_SESSION_TTL_SECONDS = 48 * 60 * 60;

// Host fields that must never be exposed to guests
const HOST_ONLY_FIELDS = new Set([
  'hostPasswordHash',
  'hostEmail',
  'checkoutId',
  'lastNotifiedAt',
  'paymentStatus',
  'GSI1PK',
  'GSI1SK',
  'PK',
  'SK',
]);

// Subset of event fields safe to return to a guest on auth
function buildGuestEventView(ev) {
  const view = {};
  for (const [key, val] of Object.entries(ev)) {
    if (!HOST_ONLY_FIELDS.has(key)) {
      view[key] = val;
    }
  }
  return view;
}

export async function handler(event) {
  try {
    // ── Path param ─────────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Parse & validate body ──────────────────────────────────────────────
    const body = parseBody(event);
    const validationErrors = validateAuthEvent(body);
    if (validationErrors.length > 0) {
      return validationError('Invalid request body', { fields: validationErrors });
    }

    const { password, nickname: rawNickname } = body;

    // ── Load event ─────────────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev) {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    if (ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }
    if (ev.status === 'locked') {
      return forbidden('EVENT_LOCKED', 'This event is currently locked by the host');
    }

    // ── Password check (plaintext compare — guest password is never hashed) ─
    if (password !== ev.guestPassword) {
      logger.warn('Auth failed: wrong password', { eventId });
      return forbidden('WRONG_PASSWORD', 'Incorrect event password');
    }

    // ── Build nickname ─────────────────────────────────────────────────────
    // Auto-assign "Invitado_NNN" if not provided; otherwise sanitize user input
    const guestNumber = Math.floor(Math.random() * 9000) + 1000;
    const nickname = rawNickname
      ? sanitizeHtml(rawNickname).slice(0, 40)
      : `Invitado_${guestNumber}`;

    // ── IP hash ────────────────────────────────────────────────────────────
    const ip = event.requestContext?.http?.sourceIp || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // ── Session & JWT ──────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const nowUnix = Math.floor(Date.now() / 1000);
    const sessionId = generateSessionId();
    const sessionExpiresAt = new Date(Date.now() + GUEST_SESSION_TTL_SECONDS * 1000).toISOString();
    const sessionExpiresAtTTL = nowUnix + GUEST_SESSION_TTL_SECONDS;

    // Guests on 'basic' tier are auto-verified (no OTP step needed).
    // For 'paid' and 'premium', verified=false — the client must complete OTP.
    const verified = ev.tier === 'basic';

    const sessionItem = {
      PK: `EVENT#${eventId}`,
      SK: `SESSION#${sessionId}`,
      sessionId,
      eventId,
      role: 'guest',
      nickname,
      ipHash,
      verified,
      verifiedVia: null,
      createdAt: now,
      expiresAt: sessionExpiresAt,
      expiresAtTTL: sessionExpiresAtTTL,
      uploadCount: 0,
    };

    await putItem(sessionItem);

    const token = await signJwt(
      { sub: sessionId, eventId, role: 'guest', nickname, verified },
      GUEST_SESSION_TTL_SECONDS,
    );

    logger.info('Guest authenticated', { eventId, sessionId, tier: ev.tier, verified });

    // ── Build safe event view ──────────────────────────────────────────────
    const eventView = buildGuestEventView(ev);

    return ok({
      token,
      session: {
        sessionId,
        role: 'guest',
        nickname,
        verified,
        requiresOtp: !verified,
        expiresAt: sessionExpiresAt,
      },
      event: eventView,
    });
  } catch (err) {
    logger.error('authEvent error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
