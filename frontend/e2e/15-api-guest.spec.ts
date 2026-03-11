import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, getHostToken, injectHostAuth, injectGuestAuth, waitForSettled } from './helpers';

// ── Guest API Endpoints ─────────────────────────────────────────────────────
// Tests exercise guest-level API routes. Each test creates its own guest
// session so there is no shared state between tests.

test.describe('Guest API — Authentication', () => {
  test('POST /events/{eventId}/auth with nickname creates guest session', async () => {
    const r = await apiCall('POST', `/events/${EVENT_PAID}/auth`, {
      nickname: 'E2E Guest Auth Test',
    });

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('token');
    expect(typeof r.data.token).toBe('string');
    // Auth response nests role/verified inside session object
    expect(r.data).toHaveProperty('session');
    expect(r.data.session).toHaveProperty('role', 'guest');
    expect(r.data.session).toHaveProperty('verified', false);
    expect(r.data).toHaveProperty('event');
    expect(r.data.event.eventId).toBe(EVENT_PAID);
  });
});

test.describe('Guest API — Media Access', () => {
  test('GET /events/{eventId}/media as guest returns only visible items', async () => {
    // Create a fresh guest session
    const auth = await apiCall('POST', `/events/${EVENT_PAID}/auth`, {
      nickname: 'E2E Media Reader',
    });
    expect(auth.ok).toBe(true);
    const guestToken = auth.data.token;

    const r = await apiCall('GET', `/events/${EVENT_PAID}/media`, null, guestToken);

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('items');
    expect(Array.isArray(r.data.items)).toBe(true);

    // Guests should only see visible items
    for (const item of r.data.items) {
      expect(item.status).toBe('visible');
    }
  });
});

test.describe('Guest API — OTP-Gated Actions (unverified guest)', () => {
  let guestToken: string;
  let sampleMediaId: string;

  test.beforeAll(async () => {
    // Create a fresh unverified guest session
    const auth = await apiCall('POST', `/events/${EVENT_PAID}/auth`, {
      nickname: 'E2E Unverified Guest',
    });
    if (!auth.ok) throw new Error(`Guest auth failed: ${JSON.stringify(auth.data)}`);
    guestToken = auth.data.token;

    // Fetch a media item to use in subsequent tests
    const media = await apiCall('GET', `/events/${EVENT_PAID}/media`, null, guestToken);
    if (media.data.items?.length > 0) {
      sampleMediaId = media.data.items[0].mediaId;
    }
  });

  test('POST /events/{eventId}/media/{mediaId}/reactions as unverified guest returns 403 OTP_REQUIRED', async () => {
    test.skip(!sampleMediaId, 'No media items available for testing');

    const r = await apiCall(
      'POST',
      `/events/${EVENT_PAID}/media/${sampleMediaId}/reactions`,
      { emoji: 'heart' },
      guestToken,
    );

    expect(r.status).toBe(403);
    expect(r.data.error?.code).toBe('OTP_REQUIRED');
  });

  test('POST /events/{eventId}/media/{mediaId}/comments as unverified guest returns 403 OTP_REQUIRED', async () => {
    test.skip(!sampleMediaId, 'No media items available for testing');

    const r = await apiCall(
      'POST',
      `/events/${EVENT_PAID}/media/${sampleMediaId}/comments`,
      { text: 'E2E test comment' },
      guestToken,
    );

    expect(r.status).toBe(403);
    expect(r.data.error?.code).toBe('OTP_REQUIRED');
  });

  test('POST /events/{eventId}/media/{mediaId}/report as unverified guest returns 403 OTP_REQUIRED', async () => {
    test.skip(!sampleMediaId, 'No media items available for testing');

    const r = await apiCall(
      'POST',
      `/events/${EVENT_PAID}/media/${sampleMediaId}/report`,
      { reason: 'inappropriate', description: 'E2E test report' },
      guestToken,
    );

    expect(r.status).toBe(403);
    expect(r.data.error?.code).toBe('OTP_REQUIRED');
  });

  test('POST /events/{eventId}/upload-url as unverified guest returns 403 OTP_REQUIRED', async () => {
    const r = await apiCall(
      'POST',
      `/events/${EVENT_PAID}/upload-url`,
      { fileType: 'image/jpeg', fileSize: 100_000 },
      guestToken,
    );

    expect(r.status).toBe(403);
    expect(r.data.error?.code).toBe('OTP_REQUIRED');
  });
});
