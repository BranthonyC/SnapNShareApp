import { randomUUID } from 'node:crypto';

import { getItem, putItem, queryItems } from '../../shared/dynamodb.mjs';
import { ok, validationError, serverError } from '../../shared/response.mjs';
import { generateOtp } from '../../shared/auth.mjs';
import { sendHostOtpEmail } from '../../shared/email.mjs';
import { parseBody } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

// Host OTP TTL: 10 minutes
const HOST_OTP_TTL_SECONDS = 600;

export async function handler(event) {
  try {
    // ── Parse body ────────────────────────────────────────────────────────
    const body = parseBody(event);
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return validationError('Valid email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Anti-enumeration: ALWAYS return the same response shape ──────────
    const response = ok({
      message: 'If an account exists, we sent a code',
      expiresIn: HOST_OTP_TTL_SECONDS,
    });

    // ── Check if host exists via GSI1 ────────────────────────────────────
    const { items } = await queryItems(
      `HOST#${normalizedEmail}`,
      'EVENT#',
      { limit: 1, indexName: 'GSI1' },
    );

    if (items.length === 0) {
      // Host does not exist — log and return same response (anti-enumeration)
      logger.info('Host login attempt for non-existent email', { email: normalizedEmail });
      return response;
    }

    // ── Generate and store OTP ───────────────────────────────────────────
    const otpCode = generateOtp();
    const now = new Date().toISOString();
    const nowUnix = Math.floor(Date.now() / 1000);

    const otpItem = {
      PK: `HOST_OTP#${normalizedEmail}`,
      SK: `OTP#${normalizedEmail}`,
      otpCode,
      otpId: randomUUID(),
      channel: 'email',
      destination: normalizedEmail,
      attempts: 0,
      sendCount: 1,
      createdAt: now,
      expiresAtTTL: nowUnix + HOST_OTP_TTL_SECONDS,
    };

    await putItem(otpItem);

    // ── Send OTP email (fire-and-forget) ─────────────────────────────────
    sendHostOtpEmail(normalizedEmail, otpCode).catch((err) => {
      logger.warn('Failed to send host OTP email', { email: normalizedEmail, error: err.message });
    });

    logger.info('Host OTP sent', { email: normalizedEmail });

    return response;
  } catch (err) {
    logger.error('hostLogin error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
