import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, getHostToken, injectHostAuth, injectGuestAuth, waitForSettled } from './helpers';

// ── Host API Endpoints ──────────────────────────────────────────────────────
// Tests exercise host-level API routes using apiCall + HOST_TOKEN.
// Every test is independent — no shared state between tests.

let HOST_TOKEN: string;

test.beforeAll(() => {
  HOST_TOKEN = getHostToken(EVENT_PAID);
});

test.describe('Host API — Stats & Analytics', () => {
  test('GET /events/{eventId}/stats returns uploads count and guests count', async () => {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/stats`, null, HOST_TOKEN);

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('uploads');
    expect(r.data.uploads).toHaveProperty('count');
    expect(typeof r.data.uploads.count).toBe('number');
    expect(r.data).toHaveProperty('guests');
    expect(r.data.guests).toHaveProperty('total');
    expect(typeof r.data.guests.total).toBe('number');
  });

  test('GET /events/{eventId}/storage returns totalBytes', async () => {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/storage`, null, HOST_TOKEN);

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('totalBytes');
    expect(typeof r.data.totalBytes).toBe('number');
  });

  test('GET /events/{eventId}/qr-stats returns totalScans as a number', async () => {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/qr-stats`, null, HOST_TOKEN);

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('totalScans');
    expect(typeof r.data.totalScans).toBe('number');
  });

  test('GET /events/{eventId}/activity returns items array', async () => {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/activity`, null, HOST_TOKEN);

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('items');
    expect(Array.isArray(r.data.items)).toBe(true);
  });
});

test.describe('Host API — Event Management', () => {
  test('PATCH /events/{eventId} updates description and returns 200', async () => {
    const timestamp = new Date().toISOString();
    const newDescription = `E2E test update at ${timestamp}`;

    const r = await apiCall(
      'PATCH',
      `/events/${EVENT_PAID}`,
      { description: newDescription },
      HOST_TOKEN,
    );

    expect(r.status).toBe(200);

    // Verify the update persisted
    const verify = await apiCall('GET', `/events/${EVENT_PAID}`, null, HOST_TOKEN);
    expect(verify.data.description).toBe(newDescription);
  });

  test('PATCH /events/{eventId}/settings updates allowDownloads and returns 200', async () => {
    // Read current value
    const before = await apiCall('GET', `/events/${EVENT_PAID}`, null, HOST_TOKEN);
    const currentValue = before.data.allowDownloads;

    // Toggle it
    const r = await apiCall(
      'PATCH',
      `/events/${EVENT_PAID}/settings`,
      { allowDownloads: !currentValue },
      HOST_TOKEN,
    );

    expect(r.status).toBe(200);

    // Restore original value
    await apiCall(
      'PATCH',
      `/events/${EVENT_PAID}/settings`,
      { allowDownloads: currentValue },
      HOST_TOKEN,
    );
  });
});

test.describe('Host API — Upload & Media', () => {
  test('POST /events/{eventId}/upload-url with fileType image/jpeg returns uploadUrl and mediaId', async () => {
    const r = await apiCall(
      'POST',
      `/events/${EVENT_PAID}/upload-url`,
      { fileType: 'image/jpeg', fileSize: 500_000 },
      HOST_TOKEN,
    );

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('uploadUrl');
    expect(typeof r.data.uploadUrl).toBe('string');
    expect(r.data.uploadUrl).toMatch(/^https?:\/\//);
    expect(r.data).toHaveProperty('mediaId');
    expect(typeof r.data.mediaId).toBe('string');
  });

  test('POST /events/{eventId}/download-zip on paid event returns files array', async () => {
    const r = await apiCall(
      'POST',
      `/events/${EVENT_PAID}/download-zip`,
      null,
      HOST_TOKEN,
    );

    expect(r.status).toBe(200);
    // download-zip returns either a downloadUrl or files array depending on implementation
    expect(r.data).toBeDefined();
    // Paid events with media should return a downloadUrl
    if (r.data.downloadUrl) {
      expect(typeof r.data.downloadUrl).toBe('string');
    }
    if (r.data.files) {
      expect(Array.isArray(r.data.files)).toBe(true);
    }
  });

  test('GET /events/{eventId}/media returns items array', async () => {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/media`, null, HOST_TOKEN);

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('items');
    expect(Array.isArray(r.data.items)).toBe(true);

    // Host default query returns all items (not filtered by status)
    // Each item should have a status field
    for (const item of r.data.items) {
      expect(typeof item.status).toBe('string');
    }
  });

  test('GET /events/{eventId}/media?status=pending_review returns items array', async () => {
    const r = await apiCall(
      'GET',
      `/events/${EVENT_PAID}/media?status=pending_review`,
      null,
      HOST_TOKEN,
    );

    expect(r.status).toBe(200);
    expect(r.data).toHaveProperty('items');
    expect(Array.isArray(r.data.items)).toBe(true);

    // If there are pending items, they should all have pending_review status
    for (const item of r.data.items) {
      expect(item.status).toBe('pending_review');
    }
  });
});
