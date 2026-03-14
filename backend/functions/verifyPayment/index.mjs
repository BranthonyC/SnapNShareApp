import { getItem, putItem, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, unauthorized, forbidden, notFound, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { getTierConfig, getSecret } from '/opt/nodejs/config.mjs';
import { sendReceiptEmail, sendEventCreatedEmail } from '/opt/nodejs/email.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const RECURRENTE_API_URL = 'https://app.recurrente.com/api/checkouts/';

const RETENTION_DAYS = {
  basic: 15,
  paid: 180,
  premium: 365,
};

export async function handler(event) {
  try {
    // ── Auth: host only ───────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    const eventId = event.pathParameters?.eventId;
    if (!eventId) return notFound('EVENT_NOT_FOUND', 'Event not found');

    // Cross-check JWT
    if (auth.eventIds && !auth.eventIds.includes(eventId)) {
      if (auth.eventId && auth.eventId !== eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
      if (!auth.eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
    }

    // ── Get event ─────────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // Already paid — nothing to do
    if (ev.paymentStatus === 'paid') {
      return ok({ paymentStatus: 'paid', alreadyPaid: true });
    }

    // Need a checkoutId to verify
    const checkoutId = ev.checkoutId || ev.upgradeCheckoutId;
    if (!checkoutId) {
      return ok({ paymentStatus: ev.paymentStatus, noCheckout: true });
    }

    // ── Verify with Recurrente API ────────────────────────────────────
    const [publicKey, secretKey] = await Promise.all([
      getSecret('recurrente-public-key'),
      getSecret('recurrente-secret-key'),
    ]);

    const verifyResponse = await fetch(`${RECURRENTE_API_URL}${checkoutId}`, {
      method: 'GET',
      headers: {
        'X-PUBLIC-KEY': publicKey,
        'X-SECRET-KEY': secretKey,
      },
    });

    if (!verifyResponse.ok) {
      logger.warn('Recurrente verify API failed', {
        status: verifyResponse.status,
        checkoutId,
        eventId,
      });
      return ok({ paymentStatus: ev.paymentStatus, verificationFailed: true });
    }

    const checkoutData = await verifyResponse.json();

    if (checkoutData.status !== 'paid') {
      logger.info('Checkout not yet paid', {
        checkoutId,
        status: checkoutData.status,
        eventId,
      });
      return ok({ paymentStatus: ev.paymentStatus, checkoutStatus: checkoutData.status });
    }

    // ── Payment confirmed — activate event ────────────────────────────
    const tier = ev.tier || 'basic';
    const tierConfig = await getTierConfig(tier);
    const now = new Date().toISOString();
    const retentionDays = tierConfig?.storageDays ?? RETENTION_DAYS[tier] ?? 15;
    const newExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    try {
      await updateItem(
        `EVENT#${eventId}`,
        'METADATA',
        'SET #tier = :tier, #uploadLimit = :uploadLimit, #mediaTypes = :mediaTypes, #paymentStatus = :paymentStatus, #expiresAt = :expiresAt, #expiresAtTTL = :expiresAtTTL, #allowDownloads = :allowDownloads, #allowVideo = :allowVideo, #autoApprove = :autoApprove, #maxFileSizeBytes = :maxFileSizeBytes, #paidAt = :paidAt, #updatedAt = :updatedAt',
        {
          ':tier': tier,
          ':uploadLimit': tierConfig?.uploadLimit ?? 150,
          ':mediaTypes': tierConfig?.mediaTypes ?? ['image/jpeg', 'image/png', 'image/webp'],
          ':paymentStatus': 'paid',
          ':expiresAt': newExpiresAt.toISOString(),
          ':expiresAtTTL': Math.floor(newExpiresAt.getTime() / 1000),
          ':allowDownloads': tier !== 'basic',
          ':allowVideo': tier !== 'basic',
          ':autoApprove': tier === 'premium',
          ':maxFileSizeBytes': tierConfig?.maxFileSizeBytes ?? 10485760,
          ':paidAt': now,
          ':updatedAt': now,
          ':notPaid': 'paid',
        },
        {
          '#tier': 'tier',
          '#uploadLimit': 'uploadLimit',
          '#mediaTypes': 'mediaTypes',
          '#paymentStatus': 'paymentStatus',
          '#expiresAt': 'expiresAt',
          '#expiresAtTTL': 'expiresAtTTL',
          '#allowDownloads': 'allowDownloads',
          '#allowVideo': 'allowVideo',
          '#autoApprove': 'autoApprove',
          '#maxFileSizeBytes': 'maxFileSizeBytes',
          '#paidAt': 'paidAt',
          '#updatedAt': 'updatedAt',
        },
        'paymentStatus <> :notPaid',
      );
    } catch (updateErr) {
      if (updateErr.name === 'ConditionalCheckFailedException') {
        return ok({ paymentStatus: 'paid', alreadyPaid: true });
      }
      throw updateErr;
    }

    // ── Create PAYMENT record ─────────────────────────────────────────
    const paymentId = `verify-${Date.now()}`;
    await putItem({
      PK: `EVENT#${eventId}`,
      SK: `PAYMENT#${paymentId}`,
      eventId,
      checkoutId,
      paymentIntentId: paymentId,
      tier,
      status: 'paid',
      source: 'manual-verify',
      createdAt: now,
    });

    logger.info('Payment verified and event activated', { eventId, checkoutId, tier });

    // ── Send emails ───────────────────────────────────────────────────
    if (ev.hostEmail) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://snapnshare.app';
      const qrUrl = `${frontendUrl}/e/${eventId}`;
      try {
        await sendEventCreatedEmail(ev.hostEmail, {
          eventId,
          title: ev.title || eventId,
          qrUrl,
          tier,
        });
      } catch (emailErr) {
        logger.warn('Failed to send event created email after verify', {
          eventId,
          error: emailErr.message,
        });
      }
    }

    return ok({ paymentStatus: 'paid', verified: true });
  } catch (err) {
    logger.error('verifyPayment error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
