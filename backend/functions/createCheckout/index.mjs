import { getItem, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, forbidden, unauthorized, notFound, serverError, error } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { getSecret } from '/opt/nodejs/config.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://snapnshare.app';

// Pricing in cents
const PRICES = {
  basic: { GTQ: 800, USD: 100 },
  paid: { GTQ: 11600, USD: 1500 },
  premium: { GTQ: 23200, USD: 3000 },
};

// Tier ordering for upgrade validation
const TIER_ORDER = { basic: 0, paid: 1, premium: 2 };

const RECURRENTE_API_URL = 'https://app.recurrente.com/api/checkouts/';

export async function handler(event) {
  try {
    // ── Auth: host only ───────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    // ── Path param ────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Cross-check JWT eventId against path eventId ──────────────────
    if (auth.eventIds && !auth.eventIds.includes(eventId)) {
      if (auth.eventId && auth.eventId !== eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
      if (!auth.eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
    }

    // ── Parse body ────────────────────────────────────────────────────
    const body = parseBody(event);
    const { tier, currency, discountCode, isUpgrade } = body;

    if (!tier || !['basic', 'paid', 'premium'].includes(tier)) {
      return validationError('tier must be basic, paid, or premium');
    }
    if (!currency || !['GTQ', 'USD'].includes(currency)) {
      return validationError('currency must be GTQ or USD');
    }

    // ── Verify event exists and isn't already paid ────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    // ── Handle upgrade vs initial payment ──────────────────────────────
    if (ev.paymentStatus === 'paid' && !isUpgrade) {
      return error('ALREADY_PAID', 'This event has already been paid for', 400);
    }

    if (isUpgrade) {
      if (ev.paymentStatus !== 'paid') {
        return error('NOT_PAID', 'Event must be paid before upgrading', 400);
      }
      const currentRank = TIER_ORDER[ev.tier];
      const targetRank = TIER_ORDER[tier];
      if (currentRank === undefined || targetRank === undefined) {
        return validationError('Invalid tier for upgrade');
      }
      if (targetRank <= currentRank) {
        return validationError('Can only upgrade to a higher tier');
      }
    }

    // ── Calculate pricing ─────────────────────────────────────────────
    let originalAmount;
    if (isUpgrade) {
      const currentPrice = PRICES[ev.tier]?.[currency] || 0;
      const targetPrice = PRICES[tier]?.[currency];
      if (!targetPrice) {
        return validationError('Invalid tier/currency combination');
      }
      originalAmount = targetPrice - currentPrice;
    } else {
      originalAmount = PRICES[tier]?.[currency];
      if (!originalAmount) {
        return validationError('Invalid tier/currency combination');
      }
    }

    let discountAmount = 0;
    let discountType = null;
    let discountValue = null;

    // ── Validate discount code (if provided, not for upgrades) ────────
    if (discountCode && !isUpgrade) {
      try {
        const discountsJson = await getSecret('discounts');
        const discounts = JSON.parse(discountsJson);
        const discount = discounts.find(
          (d) => d.code.toLowerCase() === discountCode.toLowerCase(),
        );

        if (!discount) {
          return validationError('Invalid discount code');
        }

        // Check expiry
        if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
          return validationError('Discount code has expired');
        }

        // Check usage limit
        if (discount.maxUses && (discount.usedCount || 0) >= discount.maxUses) {
          return validationError('Discount code has reached its usage limit');
        }

        // Check tier eligibility
        if (discount.tiers && !discount.tiers.includes(tier)) {
          return validationError(`Discount code is not valid for ${tier} tier`);
        }

        // Calculate discount
        discountType = discount.type;
        discountValue = discount.value;

        if (discount.type === 'percent') {
          discountAmount = Math.floor(originalAmount * (discount.value / 100));
        } else if (discount.type === 'fixed') {
          discountAmount = discount.value;
        }

        // Don't let discount exceed original amount
        if (discountAmount > originalAmount) {
          discountAmount = originalAmount;
        }
      } catch (discountErr) {
        logger.warn('Failed to load or parse discount config', {
          error: discountErr.message,
        });
        // Proceed without discount rather than failing the checkout
        discountAmount = 0;
      }
    }

    const finalAmount = originalAmount - discountAmount;

    // ── Get Recurrente API keys ───────────────────────────────────────
    const [publicKey, secretKey] = await Promise.all([
      getSecret('recurrente-public-key'),
      getSecret('recurrente-secret-key'),
    ]);

    // ── Build checkout request ────────────────────────────────────────
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const itemName = isUpgrade
      ? `Loving Memory Upgrade → ${tierLabel} Plan`
      : `Loving Memory ${tierLabel} Plan`;

    const metadata = {
      event_id: eventId,
      tier,
      host_email: ev.hostEmail,
    };
    if (isUpgrade) {
      metadata.is_upgrade = 'true';
      metadata.previous_tier = ev.tier;
    }

    const checkoutBody = {
      items: [
        {
          name: itemName,
          amount_in_cents: finalAmount,
          currency,
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/e/${eventId}/admin?payment=success`,
      cancel_url: `${FRONTEND_URL}/e/${eventId}/admin?payment=cancelled`,
      metadata,
      expires_at: expiresAt,
    };

    // ── Call Recurrente API ────────────────────────────────────────────
    const response = await fetch(RECURRENTE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PUBLIC-KEY': publicKey,
        'X-SECRET-KEY': secretKey,
      },
      body: JSON.stringify(checkoutBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Recurrente API error', {
        status: response.status,
        body: errorText,
        eventId,
      });
      return error('CHECKOUT_FAILED', 'Failed to create checkout session', 502);
    }

    const checkoutData = await response.json();
    const checkoutId = checkoutData.id;
    const checkoutUrl = checkoutData.checkout_url;

    // ── Update event with checkout info ───────────────────────────────
    if (isUpgrade) {
      // For upgrades: store upgrade checkout ID, keep paymentStatus as 'paid'
      await updateItem(
        `EVENT#${eventId}`,
        'METADATA',
        'SET #upgradeCheckoutId = :checkoutId, #updatedAt = :updatedAt',
        {
          ':checkoutId': checkoutId,
          ':updatedAt': new Date().toISOString(),
        },
        {
          '#upgradeCheckoutId': 'upgradeCheckoutId',
          '#updatedAt': 'updatedAt',
        },
      );
    } else {
      await updateItem(
        `EVENT#${eventId}`,
        'METADATA',
        'SET #checkoutId = :checkoutId, #paymentStatus = :paymentStatus, #updatedAt = :updatedAt',
        {
          ':checkoutId': checkoutId,
          ':paymentStatus': 'pending',
          ':updatedAt': new Date().toISOString(),
        },
        {
          '#checkoutId': 'checkoutId',
          '#paymentStatus': 'paymentStatus',
          '#updatedAt': 'updatedAt',
        },
      );
    }

    logger.info('Checkout created', {
      eventId,
      checkoutId,
      tier,
      currency,
      finalAmount,
    });

    return ok({
      checkoutUrl,
      checkoutId,
      originalAmount,
      discountAmount,
      finalAmount,
      currency,
    });
  } catch (err) {
    logger.error('createCheckout error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
