import { timingSafeEqual } from 'node:crypto';

import { getItem, updateItem, deleteItem, queryItems } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, serverError, error } from '/opt/nodejs/response.mjs';
import { signJwt } from '/opt/nodejs/auth.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

// Host JWT TTL: 24 hours
const HOST_JWT_TTL_SECONDS = 24 * 60 * 60;

export async function handler(event) {
  try {
    // ── Parse & validate body ──────────────────────────────────────────────
    const body = parseBody(event);
    const { email, code } = body;

    if (!email || typeof email !== 'string') {
      return validationError('email is required');
    }
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return validationError('code must be a 6-digit string');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Look up OTP record ──────────────────────────────────────────────
    const otpRecord = await getItem(`HOST_OTP#${normalizedEmail}`, `OTP#${normalizedEmail}`);

    if (!otpRecord) {
      return error('OTP_EXPIRED', 'Code expired or not found', 400);
    }

    // ── Check max attempts ──────────────────────────────────────────────
    if (otpRecord.attempts >= 5) {
      // Invalidate the OTP
      await deleteItem(`HOST_OTP#${normalizedEmail}`, `OTP#${normalizedEmail}`);
      return error('OTP_MAX_ATTEMPTS', '5 failed attempts, please request a new code', 429);
    }

    // ── Increment attempts ──────────────────────────────────────────────
    await updateItem(
      `HOST_OTP#${normalizedEmail}`,
      `OTP#${normalizedEmail}`,
      'SET attempts = attempts + :inc',
      { ':inc': 1 },
    );

    // ── Timing-safe compare ─────────────────────────────────────────────
    const storedCode = otpRecord.otpCode;
    const codeMatch =
      storedCode.length === code.length &&
      timingSafeEqual(Buffer.from(storedCode), Buffer.from(code));

    if (!codeMatch) {
      logger.warn('Host OTP verification failed', { email: normalizedEmail, attempts: otpRecord.attempts + 1 });
      return error('OTP_INVALID', 'Wrong code', 400);
    }

    // ── OTP valid — delete it ───────────────────────────────────────────
    await deleteItem(`HOST_OTP#${normalizedEmail}`, `OTP#${normalizedEmail}`);

    // ── Query all events by this host via GSI1 ──────────────────────────
    const { items: eventItems } = await queryItems(
      `HOST#${normalizedEmail}`,
      'EVENT#',
      { indexName: 'GSI1', scanForward: false },
    );

    const eventIds = [];
    const events = [];
    for (const ev of eventItems) {
      if (ev.status !== 'deleted') {
        eventIds.push(ev.eventId);
        events.push({
          eventId: ev.eventId,
          title: ev.title,
          status: ev.status,
        });
      }
    }

    // ── Sign host JWT ───────────────────────────────────────────────────
    const token = await signJwt(
      {
        sub: `host_${normalizedEmail}`,
        email: normalizedEmail,
        role: 'host',
        eventIds,
      },
      HOST_JWT_TTL_SECONDS,
    );

    logger.info('Host verified successfully', { email: normalizedEmail, eventCount: events.length });

    return ok({
      token,
      role: 'host',
      events,
    });
  } catch (err) {
    logger.error('hostVerify error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
