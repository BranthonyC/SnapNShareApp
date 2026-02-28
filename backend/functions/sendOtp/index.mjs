import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

import { getItem, putItem, updateItem } from '../../shared/dynamodb.mjs';
import { ok, validationError, forbidden, unauthorized, rateLimited, notFound, serverError, error } from '../../shared/response.mjs';
import { authenticateRequest } from '../../shared/auth.mjs';
import { generateOtp } from '../../shared/auth.mjs';
import { sendOtpEmail } from '../../shared/email.mjs';
import { parseBody } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

const sns = new SNSClient({});

// Rate limit: max 3 sends per destination per 10 minutes
const RATE_LIMIT_WINDOW_SECONDS = 600;
const MAX_SENDS_PER_WINDOW = 3;
const OTP_TTL_SECONDS = 300; // 5 minutes

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
    const { channel, destination } = body;

    if (!channel || !['email', 'sms'].includes(channel)) {
      return validationError('channel must be "email" or "sms"');
    }
    if (!destination) {
      return validationError('destination is required');
    }

    // Validate destination format
    if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
      return validationError('Invalid email address');
    }
    if (channel === 'sms' && !/^\+[1-9]\d{6,14}$/.test(destination)) {
      return validationError('Invalid phone number. Must be in E.164 format (e.g. +50212345678)');
    }

    // ── Get event & verify tier supports OTP ──────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    if (ev.tier === 'basic') {
      return forbidden('OTP_NOT_AVAILABLE', 'OTP verification is not available for basic tier events');
    }

    // ── Rate limit check ──────────────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    const otpRecord = await getItem(`EVENT#${eventId}`, `OTP#${destination}`);

    if (otpRecord) {
      const windowStart = now - RATE_LIMIT_WINDOW_SECONDS;
      if (otpRecord.createdAt && new Date(otpRecord.createdAt).getTime() / 1000 > windowStart) {
        if ((otpRecord.sendCount || 0) >= MAX_SENDS_PER_WINDOW) {
          return rateLimited('Too many OTP requests. Please wait before requesting another code.');
        }
      }
    }

    // ── Generate OTP ──────────────────────────────────────────────────
    const code = generateOtp();
    const expiresAtTTL = now + OTP_TTL_SECONDS;
    const sendCount = otpRecord && otpRecord.sendCount
      ? otpRecord.sendCount + 1
      : 1;

    // ── Store OTP record ──────────────────────────────────────────────
    const otpItem = {
      PK: `EVENT#${eventId}`,
      SK: `OTP#${destination}`,
      code,
      channel,
      destination,
      eventId,
      attempts: 0,
      sendCount,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAtTTL * 1000).toISOString(),
      expiresAtTTL,
    };

    await putItem(otpItem);

    // ── Send OTP ──────────────────────────────────────────────────────
    if (channel === 'email') {
      await sendOtpEmail(destination, code, ev.title);

      logger.info('OTP sent via email', { eventId, destination: destination.substring(0, 3) + '***' });

      return ok({ sent: true, channel: 'email', expiresIn: OTP_TTL_SECONDS });
    }

    // SMS channel
    try {
      await sns.send(new PublishCommand({
        PhoneNumber: destination,
        Message: `${code} es tu codigo de verificacion para ${ev.title} en EventAlbum. Expira en 5 minutos.`,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      }));

      logger.info('OTP sent via SMS', { eventId, destination: destination.substring(0, 5) + '***' });

      return ok({ sent: true, channel: 'sms', expiresIn: OTP_TTL_SECONDS });
    } catch (smsErr) {
      logger.warn('SMS send failed, suggesting fallback', {
        eventId,
        error: smsErr.message,
      });

      return ok({ sent: false, channel: 'sms', fallback: true });
    }
  } catch (err) {
    logger.error('sendOtp error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
