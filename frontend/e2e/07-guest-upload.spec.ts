import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectGuestAuth, waitForSettled } from './helpers';

test.describe('Guest Upload Page', () => {
  test.describe('Verified guest — paid event', () => {
    test.beforeEach(async ({ page }) => {
      await injectGuestAuth(page, EVENT_PAID, 'E2E Uploader', { verified: true });
      await page.goto(`${BASE}/e/${EVENT_PAID}/upload`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);
    });

    test('upload page loads with title "Subir fotos"', async ({ page }) => {
      const header = page.locator('header h1');
      await expect(header).toBeVisible();
      await expect(header).toHaveText('Subir fotos');
    });

    test('upload dropzone is visible', async ({ page }) => {
      const dropzone = page.getByRole('button', { name: 'Zona de carga de archivos' });
      await expect(dropzone).toBeVisible();

      const instructions = page.locator('text=Arrastra fotos aquí o toca para seleccionar');
      await expect(instructions).toBeVisible();

      const hint = page.locator('text=/JPEG, PNG, WebP/');
      await expect(hint).toBeVisible();
    });

    test('camera capture button is visible inside dropzone', async ({ page }) => {
      const cameraButton = page.locator('button', { hasText: 'Tomar foto con cámara' });
      await expect(cameraButton).toBeVisible();
    });

    test('back button navigates to gallery', async ({ page }) => {
      const backButton = page.getByRole('button', { name: 'Go back' });
      await expect(backButton).toBeVisible();

      await backButton.click();

      await page.waitForURL(`**/e/${EVENT_PAID}/gallery`, { timeout: 10_000 });
      expect(page.url()).toContain(`/e/${EVENT_PAID}/gallery`);
    });

    test('upload limit counter is shown', async ({ page }) => {
      const counter = page.locator('text=/\\d+\\/\\d+ fotos/');
      await expect(counter).toBeVisible();
    });

    test('hidden file inputs exist for gallery and camera', async ({ page }) => {
      const fileInput = page.locator('input[type="file"][multiple]');
      await expect(fileInput).toBeAttached();

      const cameraInput = page.locator('input[type="file"][capture="environment"]');
      await expect(cameraInput).toBeAttached();
    });
  });

  // ── Unverified guest gets redirected to gallery ───────────────────────
  test.describe('Unverified guest redirect', () => {
    test('visiting /upload as unverified guest redirects to gallery', async ({ page }) => {
      await injectGuestAuth(page, EVENT_PAID, 'E2E Unverified');
      await page.goto(`${BASE}/e/${EVENT_PAID}/upload`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      await page.waitForURL(`**/e/${EVENT_PAID}/gallery`, { timeout: 10_000 });
      expect(page.url()).toContain(`/e/${EVENT_PAID}/gallery`);
    });
  });

  // ── OTP bottom sheet on gallery FAB click ─────────────────────────────
  test.describe('Unverified guest — OTP sheet on gallery', () => {
    test('clicking upload FAB as unverified guest shows OTP verification sheet', async ({ page }) => {
      await injectGuestAuth(page, EVENT_PAID, 'E2E OTP Tester');
      await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      const fab = page.getByRole('button', { name: 'Subir foto' });
      await expect(fab).toBeVisible();
      await fab.click();

      // OTP sheet should appear with verification heading
      const otpHeading = page.getByRole('heading', { name: /Verifica tu identidad/ });
      await expect(otpHeading).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Unauthenticated access ─────────────────────────────────────────────
  test.describe('Unauthenticated access', () => {
    test('visiting /upload without auth redirects to lobby', async ({ page }) => {
      await page.goto(`${BASE}/e/${EVENT_PAID}/upload`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      await page.waitForURL(`**/e/${EVENT_PAID}`, { timeout: 10_000 });
      expect(page.url()).toMatch(new RegExp(`/e/${EVENT_PAID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    });
  });
});
