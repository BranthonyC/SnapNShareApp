import { getItem, putItem, updateItem } from '../../shared/dynamodb.mjs';
import { ok, serverError } from '../../shared/response.mjs';
import { getTierConfig, getSecret } from '../../shared/config.mjs';
import { parseBody } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

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
      const now = new Date().toISOString();
      const retentionDays = tierConfig.storageDays ?? RETENTION_DAYS[tier] ?? 15;
      const newExpiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      try {
        await updateItem(
          `EVENT#${eventId}`,
          'METADATA',
          'SET #tier = :tier, #uploadLimit = :uploadLimit, #mediaTypes = :mediaTypes, #paymentStatus = :paymentStatus, #expiresAt = :expiresAt, #expiresAtTTL = :expiresAtTTL, #allowDownloads = :allowDownloads, #allowVideo = :allowVideo, #autoApprove = :autoApprove, #maxFileSizeBytes = :maxFileSizeBytes, #paidAt = :paidAt, #updatedAt = :updatedAt',
          {
            ':tier': tier,
            ':uploadLimit': tierConfig.uploadLimit,
            ':mediaTypes': tierConfig.mediaTypes,
            ':paymentStatus': 'paid',
            ':expiresAt': newExpiresAt.toISOString(),
            ':expiresAtTTL': Math.floor(newExpiresAt.getTime() / 1000),
            ':allowDownloads': true,
            ':allowVideo': true,
            ':autoApprove': tier === 'premium',
            ':maxFileSizeBytes': tierConfig.maxFileSizeBytes,
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
          logger.warn('Duplicate payment webhook — event already paid', {
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
