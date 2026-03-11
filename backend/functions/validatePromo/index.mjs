import { ok, validationError, serverError } from '/opt/nodejs/response.mjs';
import { getSecret } from '/opt/nodejs/config.mjs';
import { parseBody } from '/opt/nodejs/validation.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

// Pricing in cents (must match createCheckout)
const PRICES = {
  basic: { GTQ: 800, USD: 100 },
  paid: { GTQ: 11600, USD: 1500 },
  premium: { GTQ: 23200, USD: 3000 },
};

export async function handler(event) {
  try {
    // ── Parse body ────────────────────────────────────────────────────
    const body = parseBody(event);
    const { code, tier, currency } = body;

    if (!code || typeof code !== 'string') {
      return validationError('code is required');
    }
    if (!tier || !['basic', 'paid', 'premium'].includes(tier)) {
      return validationError('tier must be basic, paid, or premium');
    }
    if (!currency || !['GTQ', 'USD'].includes(currency)) {
      return validationError('currency must be GTQ or USD');
    }

    // ── Load discount configs from SSM ────────────────────────────────
    let discounts;
    try {
      const discountsJson = await getSecret('discounts');
      discounts = JSON.parse(discountsJson);
    } catch (loadErr) {
      logger.error('Failed to load discount configs', { error: loadErr.message });
      return ok({ valid: false, reason: 'Unable to validate discount codes at this time' });
    }

    // ── Find matching discount ────────────────────────────────────────
    const discount = discounts.find(
      (d) => d.code.toLowerCase() === code.toLowerCase(),
    );

    if (!discount) {
      return ok({ valid: false, reason: 'Invalid discount code' });
    }

    // ── Check expiry ──────────────────────────────────────────────────
    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return ok({ valid: false, reason: 'Discount code has expired' });
    }

    // ── Check usage limit ─────────────────────────────────────────────
    if (discount.maxUses && (discount.usedCount || 0) >= discount.maxUses) {
      return ok({ valid: false, reason: 'Discount code has reached its usage limit' });
    }

    // ── Check tier eligibility ────────────────────────────────────────
    if (discount.tiers && !discount.tiers.includes(tier)) {
      return ok({ valid: false, reason: `Discount code is not valid for ${tier} tier` });
    }

    // ── Calculate discount ────────────────────────────────────────────
    const originalAmount = PRICES[tier][currency];
    let discountAmount = 0;

    if (discount.type === 'percent') {
      discountAmount = Math.floor(originalAmount * (discount.value / 100));
    } else if (discount.type === 'fixed') {
      discountAmount = discount.value;
    }

    // Don't let discount exceed original amount
    if (discountAmount > originalAmount) {
      discountAmount = originalAmount;
    }

    const finalAmount = originalAmount - discountAmount;

    logger.info('Promo code validated', { code, tier, currency, discountAmount });

    return ok({
      valid: true,
      type: discount.type,
      value: discount.value,
      discountAmount,
      finalAmount,
      currency,
    });
  } catch (err) {
    logger.error('validatePromo error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
