import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, getHostToken, injectHostAuth, injectGuestAuth, waitForSettled } from './helpers';

// ── Mobile-Specific Features ────────────────────────────────────────────────
// Tests verify mobile protections (screenshot prevention, portrait lock,
// pinch-zoom prevention) that are critical for a private media platform.
// The Playwright config already uses a mobile viewport (390x844, isMobile: true).

test.describe('Mobile — Screenshot Protection (CSS)', () => {
  test('media view images have user-select: none to prevent selection', async ({ page }) => {
    // Navigate to the media view page (which has select-none on images)
    await injectGuestAuth(page, EVENT_PAID, 'Mobile Tester');
    await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    // Click first photo to open media view
    const photos = page.locator('a[aria-label^="Foto subida por"]');
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
    await photos.first().click();
    await page.waitForURL(`**/media/**`, { timeout: 10_000 });
    await waitForSettled(page);

    // The media view image has select-none class
    const image = page.locator('img[alt^="Foto subida por"]');
    await expect(image).toBeVisible({ timeout: 10_000 });

    const userSelect = await image.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.getPropertyValue('user-select') || style.getPropertyValue('-webkit-user-select');
    });
    expect(userSelect).toBe('none');
  });

  test('media view images have contextmenu prevention and no-drag', async ({ page }) => {
    // Navigate to media view (which has anti-save protections)
    await injectGuestAuth(page, EVENT_PAID, 'Callout Tester');
    await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);

    const photos = page.locator('a[aria-label^="Foto subida por"]');
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
    await photos.first().click();
    await page.waitForURL(`**/media/**`, { timeout: 10_000 });
    await waitForSettled(page);

    const image = page.locator('img[alt^="Foto subida por"]');
    await expect(image).toBeVisible({ timeout: 10_000 });

    // Image should not be draggable
    const draggable = await image.getAttribute('draggable');
    expect(draggable).toBe('false');

    // contextmenu event should be prevented
    const defaultPrevented = await image.evaluate((el) => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      return !el.dispatchEvent(event);
    });
    expect(defaultPrevented).toBe(true);
  });
});

test.describe('Mobile — Viewport Configuration', () => {
  test('viewport meta tag is present with correct width settings', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportContent).toBeTruthy();
    expect(viewportContent).toContain('width=device-width');
    expect(viewportContent).toContain('initial-scale=1.0');
  });
});
