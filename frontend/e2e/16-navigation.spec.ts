import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, getHostToken, injectHostAuth, injectGuestAuth, waitForSettled } from './helpers';

// ── Navigation Flows ────────────────────────────────────────────────────────
// Tests verify in-browser navigation patterns for both guest and host flows.
// Each test is independent — auth is injected fresh per test.

test.describe('Navigation — 404 Page', () => {
  test('invalid route shows 404 page', async ({ page }) => {
    await page.goto(`${BASE}/nonexistent`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page, 1000);

    // 404 page should display the error heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('404');

    // Should show the "page not found" message
    const subheading = page.locator('h2');
    await expect(subheading).toContainText('Pagina no encontrada');

    // Should have a link back to home
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });
});

test.describe('Navigation — Guest Flows', () => {
  test('gallery back button navigates to lobby page', async ({ page }) => {
    // Inject verified guest auth and navigate to gallery
    await injectGuestAuth(page, EVENT_PAID, 'Nav Tester', { verified: true });
    await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    // Click the back button (aria-label "Go back")
    const backButton = page.locator('button[aria-label="Go back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should navigate to the event lobby page, not redirect elsewhere
    await page.waitForURL(`**/${EVENT_PAID}`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}`);
    expect(page.url()).not.toContain('/gallery');
  });

  test('lobby to gallery to upload and back to gallery', async ({ page }) => {
    // Inject verified guest auth (unverified guests get OTP sheet instead of navigating to upload)
    await injectGuestAuth(page, EVENT_PAID, 'Flow Tester', { verified: true });

    // Step 1: Start at lobby
    await page.goto(`${BASE}/e/${EVENT_PAID}`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    // Step 2: Navigate to gallery (button with "Ver galería" text for authenticated guests)
    const galleryButton = page.locator('button', { hasText: 'Ver galería' });
    await expect(galleryButton).toBeVisible({ timeout: 10_000 });
    await galleryButton.click();
    await page.waitForURL(`**/gallery`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/gallery`);

    // Step 3: Navigate to upload via FAB
    const uploadFab = page.locator('button[aria-label="Subir foto"]');
    await expect(uploadFab).toBeVisible({ timeout: 10_000 });
    await uploadFab.click();
    await page.waitForURL(`**/upload`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/upload`);

    // Step 4: Go back to gallery
    const backButton = page.locator('button[aria-label="Go back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await page.waitForURL(`**/gallery`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/gallery`);
  });
});

test.describe('Navigation — Host Flows', () => {
  test('dashboard photo click opens media view and close returns to dashboard', async ({ page }) => {
    // Inject host auth and navigate to dashboard
    await injectHostAuth(page, EVENT_PAID);
    await page.goto(`${BASE}/e/${EVENT_PAID}/admin`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    // Find and click a photo link (media tiles are <a> elements linking to /media/)
    const mediaLink = page.locator('a[href*="/media/"]').first();
    const mediaLinkExists = await mediaLink.count();

    if (mediaLinkExists > 0) {
      await mediaLink.click();
      await page.waitForURL(`**/media/**`, { timeout: 10_000 });
      expect(page.url()).toContain('/media/');

      // Go back (use browser back since MediaViewPage may use different nav)
      await page.goBack();
      await page.waitForURL(`**/admin`, { timeout: 10_000 });
      expect(page.url()).toContain(`/e/${EVENT_PAID}/admin`);
    }
  });

  test('admin sidebar/nav links navigate to correct pages', async ({ page }) => {
    await injectHostAuth(page, EVENT_PAID);
    await page.goto(`${BASE}/e/${EVENT_PAID}/admin`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    // Mobile nav uses AdminNav pill buttons — Sidebar also has this aria-label (hidden on mobile)
    // Use .last() to get the visible mobile AdminNav (Sidebar comes first in DOM)
    const adminNav = page.locator('nav[aria-label="Navegación de administración"]');
    await expect(adminNav.last()).toBeVisible();

    // Navigate to Edit page
    const editButton = adminNav.last().locator('button', { hasText: 'Editar' });
    await expect(editButton).toBeVisible();
    await editButton.click();
    await page.waitForURL(`**/admin/edit`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/admin/edit`);

    // Navigate to QR page
    const qrButton = adminNav.last().locator('button', { hasText: 'QR' });
    await expect(qrButton).toBeVisible();
    await qrButton.click();
    await page.waitForURL(`**/admin/qr`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/admin/qr`);

    // Navigate to Settings page
    const settingsButton = adminNav.last().locator('button', { hasText: 'Ajustes' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await page.waitForURL(`**/admin/settings`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/admin/settings`);

    // Navigate to Moderation page
    const moderationButton = adminNav.last().locator('button', { hasText: /Moderaci/});
    await expect(moderationButton).toBeVisible();
    await moderationButton.click();
    await page.waitForURL(`**/admin/moderation`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/admin/moderation`);

    // Navigate to Gallery page
    const galleryButton = adminNav.last().locator('button', { hasText: /Galer/});
    await expect(galleryButton).toBeVisible();
    await galleryButton.click();
    await page.waitForURL(`**/admin/gallery`, { timeout: 10_000 });
    expect(page.url()).toContain(`/e/${EVENT_PAID}/admin/gallery`);

    // Navigate back to Panel (dashboard)
    const panelButton = adminNav.last().locator('button', { hasText: 'Panel' });
    await expect(panelButton).toBeVisible();
    await panelButton.click();
    await page.waitForURL(new RegExp(`/e/${EVENT_PAID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/admin$`), { timeout: 10_000 });
    expect(page.url()).toMatch(new RegExp(`/e/${EVENT_PAID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/admin$`));
  });
});
