import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, waitForSettled } from './helpers';

test.describe('Public API Endpoints', () => {
  test.describe('GET /config', () => {
    test('returns tiers with pricing (basic, paid, premium)', async () => {
      const res = await apiCall('GET', '/config');

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);

      const { tiers } = res.data;
      expect(tiers).toBeDefined();

      // All three tiers must be present
      expect(tiers.basic).toBeDefined();
      expect(tiers.paid).toBeDefined();
      expect(tiers.premium).toBeDefined();

      // Each tier should have pricing info
      for (const tierKey of ['basic', 'paid', 'premium']) {
        const tier = tiers[tierKey];
        expect(tier.uploadLimit).toBeGreaterThan(0);
      }
    });
  });

  test.describe('GET /events/:eventId (unauthenticated)', () => {
    test('returns public fields (title, eventId)', async () => {
      const res = await apiCall('GET', `/events/${EVENT_PAID}`);

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data.eventId).toBe(EVENT_PAID);
      expect(res.data.title).toBeTruthy();
    });

    test('does NOT return hostEmail or guestPassword', async () => {
      const res = await apiCall('GET', `/events/${EVENT_BASIC}`);

      expect(res.ok).toBe(true);
      expect(res.data.hostEmail).toBeUndefined();
      expect(res.data.guestPassword).toBeUndefined();
    });
  });

  test.describe('POST /events/:eventId/auth', () => {
    test('with nickname returns token and session', async () => {
      const res = await apiCall('POST', `/events/${EVENT_PAID}/auth`, {
        nickname: 'E2E Public API Test',
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data.token).toBeTruthy();
      expect(typeof res.data.token).toBe('string');
    });

    test('without password on password-protected event returns WRONG_PASSWORD', async () => {
      // EVENT_BASIC has guestPassword: test1234
      const res = await apiCall('POST', `/events/${EVENT_BASIC}/auth`, {
        nickname: 'E2E No Password',
      });

      expect(res.ok).toBe(false);
      expect(res.data.error?.code).toBe('WRONG_PASSWORD');
    });

    test('with correct password on password-protected event returns token', async () => {
      const res = await apiCall('POST', `/events/${EVENT_BASIC}/auth`, {
        nickname: 'E2E Correct Password',
        password: 'test1234',
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data.token).toBeTruthy();
      expect(typeof res.data.token).toBe('string');
    });
  });

  test.describe('POST /events/:eventId/promo', () => {
    test('with valid promo code returns valid=true', async () => {
      const promoCode = process.env.PROMO_CODE || 'EAPRD-A086-ED23-5389';
      const res = await apiCall('POST', `/events/${EVENT_PAID}/promo`, {
        code: promoCode,
        tier: 'paid',
        currency: 'GTQ',
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.data.valid).toBe(true);
    });
  });
});
