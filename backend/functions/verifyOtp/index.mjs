import { timingSafeEqual } from 'node:crypto';

import { getItem, updateItem, deleteItem, putItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, forbidden, unauthorized, notFound, serverError, error } from '/opt/nodejs/response.mjs';
import { authenticateRequest, signJwt } from '/opt/nodejs/auth.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const MAX_ATTEMPTS = 5;
const GUEST_SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function handler(event) {
  try {
    // ── Auth: guest JWT required ───────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();

    // ── Path param ─────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Cross-check JWT eventId against path eventId ──────────────────
    if (auth.eventId && auth.eventId !== eventId) {
      return forbidden('FORBIDDEN', 'You do not have access to this event');
    }

    // ── Parse body ────────────────────────────────────────────────────
    const body = parseBody(event);
    const { code, destination } = body;

    if (!code || typeof code !== 'string') {
      return validationError('code is required');
    }
    if (!destination || typeof destination !== 'string') {
      return validationError('destination is required');
    }

    // ── Get OTP record ────────────────────────────────────────────────
    const otpRecord = await getItem(`EVENT#${eventId}`, `OTP#${destination}`);

    if (!otpRecord) {
      return error('OTP_EXPIRED', 'OTP has expired or does not exist', 400);
    }

    // ── Check TTL (manual check in case DDB TTL hasn't cleaned it yet)
    const now = Math.floor(Date.now() / 1000);
    if (otpRecord.expiresAtTTL && otpRecord.expiresAtTTL < now) {
      await deleteItem(`EVENT#${eventId}`, `OTP#${destination}`);
      return error('OTP_EXPIRED', 'OTP has expired', 400);
    }

    // ── Check max attempts ────────────────────────────────────────────
    if ((otpRecord.attempts || 0) >= MAX_ATTEMPTS) {
      await deleteItem(`EVENT#${eventId}`, `OTP#${destination}`);
      return error('OTP_MAX_ATTEMPTS', 'Maximum verification attempts exceeded. Please request a new code.', 400);
    }

    // ── Increment attempts ────────────────────────────────────────────
    await updateItem(
      `EVENT#${eventId}`,
      `OTP#${destination}`,
      'SET #attempts = #attempts + :inc',
      { ':inc': 1 },
      { '#attempts': 'attempts' },
    );

    // ── Timing-safe compare ───────────────────────────────────────────
    const storedCode = String(otpRecord.code);
    const submittedCode = String(code);

    // Ensure same length for timingSafeEqual
    if (storedCode.length !== submittedCode.length) {
      return error('OTP_INVALID', 'Invalid verification code', 400);
    }

    const isValid = timingSafeEqual(
      Buffer.from(storedCode),
      Buffer.from(submittedCode),
    );

    if (!isValid) {
      const remaining = MAX_ATTEMPTS - (otpRecord.attempts || 0) - 1;
      return error('OTP_INVALID', 'Invalid verification code', 400, {
        attemptsRemaining: remaining,
      });
    }

    // ── Success: delete OTP record ────────────────────────────────────
    await deleteItem(`EVENT#${eventId}`, `OTP#${destination}`);

    // ── Update SESSION record: set verified=true ──────────────────────
    const sessionId = auth.sub;
    const channel = otpRecord.channel || 'email';

    try {
      await updateItem(
        `EVENT#${eventId}`,
        `SESSION#${sessionId}`,
        'SET #verified = :verified, #verifiedVia = :verifiedVia, #verifiedAt = :verifiedAt',
        {
          ':verified': true,
          ':verifiedVia': channel,
          ':verifiedAt': new Date().toISOString(),
        },
        {
          '#verified': 'verified',
          '#verifiedVia': 'verifiedVia',
          '#verifiedAt': 'verifiedAt',
        },
      );
    } catch (sessionErr) {
      logger.warn('Failed to update session verified status', {
        eventId,
        sessionId,
        error: sessionErr.message,
      });
    }

    // ── Reissue JWT with verified: true ───────────────────────────────
    const token = await signJwt(
      {
        sub: sessionId,
        eventId,
        role: auth.role || 'guest',
        verified: true,
        verifiedVia: channel,
      },
      GUEST_SESSION_TTL_SECONDS,
    );

    logger.info('OTP verified successfully', {
      eventId,
      channel,
      destination: destination.substring(0, 3) + '***',
    });

    return ok({ token, verified: true });
  } catch (err) {
    logger.error('verifyOtp error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
