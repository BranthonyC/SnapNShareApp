import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectGuestAuth, waitForSettled } from './helpers';

test.describe('Guest Gallery Page', () => {
  // ── Authenticated gallery (paid event with 5+ uploads) ─────────────────

  test.describe('Authenticated — paid event', () => {
    test.beforeEach(async ({ page }) => {
      await injectGuestAuth(page, EVENT_PAID, 'E2E Gallery Tester');
      await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);
    });

    test('gallery loads and photos render', async ({ page }) => {
      // The gallery grid should have media tiles (links with aria-label starting with "Foto subida por")
      const photos = page.locator('a[aria-label^="Foto subida por"]');
      await expect(photos.first()).toBeVisible({ timeout: 15_000 });

      // Should have at least 1 photo
      const count = await photos.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('photo counter shows "X fotos" with visible count', async ({ page }) => {
      // Wait for photos to load
      const photos = page.locator('a[aria-label^="Foto subida por"]');
      await expect(photos.first()).toBeVisible({ timeout: 15_000 });

      // Counter text in format "N/M fotos"
      const counter = page.locator('text=/\\d+\\/\\d+ fotos/');
      await expect(counter).toBeVisible();
    });

    test('upload FAB button is visible with camera icon', async ({ page }) => {
      const fab = page.getByRole('button', { name: 'Subir foto' });
      await expect(fab).toBeVisible();
    });

    test('clicking a photo navigates to /media/:mediaId', async ({ page }) => {
      // Wait for photos
      const photos = page.locator('a[aria-label^="Foto subida por"]');
      await expect(photos.first()).toBeVisible({ timeout: 15_000 });

      // Click first photo
      await photos.first().click();

      // URL should change to /media/<something>
      await page.waitForURL(`**/e/${EVENT_PAID}/media/**`, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/e\/[^/]+\/media\/[^/]+/);
    });

    test('back button in header navigates to lobby', async ({ page }) => {
      // The PageLayout back button has aria-label "Go back"
      const backButton = page.getByRole('button', { name: 'Go back' });
      await expect(backButton).toBeVisible();

      await backButton.click();

      // Should navigate to the lobby /e/:eventId (not redirect away)
      await page.waitForURL(`**/e/${EVENT_PAID}`, { timeout: 10_000 });
      // Ensure we are on the lobby, not /gallery
      expect(page.url()).toMatch(new RegExp(`/e/${EVENT_PAID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    });

    test('header shows event title', async ({ page }) => {
      // PageLayout renders the title in an h1 inside the header
      const header = page.locator('header');
      await expect(header).toBeVisible();

      const headerTitle = header.locator('h1');
      await expect(headerTitle).toBeVisible();
      await expect(headerTitle).not.toBeEmpty();
    });
  });

  // ── Unauthenticated access ─────────────────────────────────────────────

  test.describe('Unauthenticated access', () => {
    test('visiting /gallery without auth redirects to lobby', async ({ page }) => {
      // Go directly to gallery without injecting auth
      await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      // Should redirect back to the event lobby
      await page.waitForURL(`**/e/${EVENT_PAID}`, { timeout: 10_000 });
      expect(page.url()).toMatch(new RegExp(`/e/${EVENT_PAID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    });
  });
});
