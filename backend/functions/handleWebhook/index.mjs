import { getItem, putItem, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, serverError } from '/opt/nodejs/response.mjs';
import { getTierConfig, getSecret } from '/opt/nodejs/config.mjs';
import { sendReceiptEmail, sendEventCreatedEmail } from '/opt/nodejs/email.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const RECURRENTE_API_URL = 'https://app.recurrente.com/api/checkouts/';

// Storage retention in days by tier (fallback if not in SSM config)
const RETENTION_DAYS = {
  basic: 15,
  paid: 180,
  premium: 365,
};

export async function handler(event) {
  try {
    // ── Parse webhook body ────────────────────────────────────────────
    const body = parseBody(event);
    const eventType = body.event_type || body.type;

    logger.info('Webhook received', { eventType, body: JSON.stringify(body).substring(0, 500) });

    // ── Handle payment_intent.succeeded ───────────────────────────────
    if (eventType === 'payment_intent.succeeded') {
      const checkoutId = body.checkout_id || body.data?.checkout_id;
      const paymentIntentId = body.payment_intent_id || body.id || body.data?.id;
      const metadata = body.metadata || body.data?.metadata || {};
      const eventId = metadata.event_id;
      const tier = metadata.tier;

      if (!checkoutId || !eventId || !tier) {
        logger.warn('Webhook missing required fields', { checkoutId, eventId, tier });
        // Return 200 to avoid Recurrente retries
        return ok({ received: true });
      }

      // ── Verify payment via Recurrente API ─────────────────────────
      try {
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
          logger.error('Recurrente verification API failed', {
            status: verifyResponse.status,
            checkoutId,
          });
          return ok({ received: true, verified: false });
        }

        const checkoutData = await verifyResponse.json();

        if (checkoutData.status !== 'paid') {
          logger.warn('Checkout status is not paid', {
            checkoutId,
            status: checkoutData.status,
          });
          return ok({ received: true, verified: false, status: checkoutData.status });
        }
      } catch (verifyErr) {
        logger.error('Payment verification failed', {
          error: verifyErr.message,
          checkoutId,
        });
        // Return 200 to avoid retries — will need manual reconciliation
        return ok({ received: true, verified: false });
      }

      // ── Get tier config ───────────────────────────────────────────
      const tierConfig = await getTierConfig(tier);
      if (!tierConfig) {
        logger.error('Unknown tier in webhook', { tier, eventId });
        return ok({ received: true });
      }

      // ── Upgrade event ─────────────────────────────────────────────
      const isUpgrade = metadata.is_upgrade === 'true';
      const previousTier = metadata.previous_tier;
      const now = new Date().toISOString();
      const retentionDays = tierConfig.storageDays ?? RETENTION_DAYS[tier] ?? 15;
      const newExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      const updateExpr = 'SET #tier = :tier, #uploadLimit = :uploadLimit, #mediaTypes = :mediaTypes, #paymentStatus = :paymentStatus, #expiresAt = :expiresAt, #expiresAtTTL = :expiresAtTTL, #allowDownloads = :allowDownloads, #allowVideo = :allowVideo, #autoApprove = :autoApprove, #maxFileSizeBytes = :maxFileSizeBytes, #paidAt = :paidAt, #updatedAt = :updatedAt';
      const updateValues = {
        ':tier': tier,
        ':uploadLimit': tierConfig.uploadLimit,
        ':mediaTypes': tierConfig.mediaTypes,
        ':paymentStatus': 'paid',
        ':expiresAt': newExpiresAt.toISOString(),
        ':expiresAtTTL': Math.floor(newExpiresAt.getTime() / 1000),
        ':allowDownloads': tier !== 'basic',
        ':allowVideo': tier !== 'basic',
        ':autoApprove': tier === 'premium',
        ':maxFileSizeBytes': tierConfig.maxFileSizeBytes,
        ':paidAt': now,
        ':updatedAt': now,
      };
      const updateNames = {
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
      };

      // For upgrades: condition on current tier matching previous_tier (idempotency)
      // For initial payment: condition on paymentStatus not being 'paid' (idempotency)
      let conditionExpr;
      if (isUpgrade && previousTier) {
        updateValues[':previousTier'] = previousTier;
        conditionExpr = 'tier = :previousTier';
      } else {
        updateValues[':notPaid'] = 'paid';
        conditionExpr = 'paymentStatus <> :notPaid';
      }

      try {
        await updateItem(
          `EVENT#${eventId}`,
          'METADATA',
          updateExpr,
          updateValues,
          updateNames,
          conditionExpr,
        );
      } catch (updateErr) {
        if (updateErr.name === 'ConditionalCheckFailedException') {
          logger.warn(isUpgrade ? 'Duplicate upgrade webhook — tier already upgraded' : 'Duplicate payment webhook — event already paid', {
            eventId,
            checkoutId,
          });
          return ok({ received: true, duplicate: true });
        }
        throw updateErr;
      }

      // ── Create PAYMENT record ─────────────────────────────────────
      const paymentItem = {
        PK: `EVENT#${eventId}`,
        SK: `PAYMENT#${paymentIntentId}`,
        eventId,
        checkoutId,
        paymentIntentId,
        tier,
        status: 'paid',
        metadata,
        createdAt: now,
      };

      await putItem(paymentItem);

      logger.info('Event upgraded via payment', {
        eventId,
        tier,
        checkoutId,
        paymentIntentId,
      });

      // ── Send emails (must await — Lambda freezes after response) ──
      const hostEmail = metadata.host_email;
      const eventTitle = metadata.event_title || eventId;
      if (hostEmail) {
        // Send receipt email
        try {
          await sendReceiptEmail(hostEmail, {
            eventId,
            title: eventTitle,
            tier,
            amount: metadata.amount ? parseInt(metadata.amount, 10) : 0,
            currency: metadata.currency || 'GTQ',
            paymentDate: now,
            paymentMethod: metadata.payment_method || null,
          });
        } catch (emailErr) {
          logger.warn('Failed to send receipt email', {
            eventId,
            error: emailErr.message,
          });
        }

        // Send event-created email now that payment is confirmed (skip for upgrades)
        if (!isUpgrade) {
          const frontendUrl = process.env.FRONTEND_URL || 'https://snapnshare.app';
          const qrUrl = `${frontendUrl}/e/${eventId}`;
          try {
            await sendEventCreatedEmail(hostEmail, { eventId, title: eventTitle, qrUrl, tier });
          } catch (emailErr) {
            logger.warn('Failed to send event created email', {
              eventId,
              error: emailErr.message,
            });
          }
        }
      }

      return ok({ received: true, processed: true });
    }

    // ── Handle payment_intent.failed ──────────────────────────────────
    if (eventType === 'payment_intent.failed') {
      const metadata = body.metadata || body.data?.metadata || {};
      const eventId = metadata.event_id;
      const checkoutId = body.checkout_id || body.data?.checkout_id;

      logger.warn('Payment failed', { eventId, checkoutId, eventType });

      if (eventId) {
        try {
          await updateItem(
            `EVENT#${eventId}`,
            'METADATA',
            'SET #paymentStatus = :paymentStatus, #updatedAt = :updatedAt',
            {
              ':paymentStatus': 'failed',
              ':updatedAt': new Date().toISOString(),
            },
            {
              '#paymentStatus': 'paymentStatus',
              '#updatedAt': 'updatedAt',
            },
          );
        } catch (failErr) {
          logger.error('Failed to update payment status to failed', {
            eventId,
            error: failErr.message,
          });
        }
      }

      return ok({ received: true });
    }

    // ── Unhandled event type ──────────────────────────────────────────
    logger.info('Unhandled webhook event type', { eventType });
    return ok({ received: true });
  } catch (err) {
    logger.error('handleWebhook error', { error: err.message, stack: err.stack });
    // Always return 200 to prevent Recurrente retries
    return ok({ received: true, error: 'Internal processing error' });
  }
}
