import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectHostAuth, waitForSettled } from './helpers';

test.describe('Host QR Page — /e/:eventId/admin/qr', () => {
  test.beforeEach(async ({ page }) => {
    await injectHostAuth(page, EVENT_BASIC);
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/qr`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);
  });

  test('QR code SVG is visible', async ({ page }) => {
    // QRCodeSVG renders a large SVG (220x220). Target it by size to skip small icon SVGs.
    const qrSvg = page.locator('svg[width="220"]').first();
    await expect(qrSvg).toBeVisible({ timeout: 10000 });
  });

  test('event URL text contains the eventId', async ({ page }) => {
    // The URL is displayed in a paragraph with Tailwind class "select-all"
    const urlText = page.locator('.select-all').first();
    await expect(urlText).toBeVisible();
    await expect(urlText).toContainText(EVENT_BASIC);
  });

  test('"Copiar enlace" button is visible', async ({ page }) => {
    const copyButton = page.locator('button', { hasText: 'Copiar enlace' }).first();
    await expect(copyButton).toBeVisible();
  });

  test('"Descargar QR" button is visible', async ({ page }) => {
    const downloadButton = page.locator('button', { hasText: 'Descargar QR' }).first();
    await expect(downloadButton).toBeVisible();
  });

  test('QR stats card shows scan count', async ({ page }) => {
    // QRStatsCard has "Estadisticas del QR" header
    const statsHeader = page.locator('text=Estadisticas del QR').first();
    await expect(statsHeader).toBeVisible({ timeout: 10000 });

    // The StatRow for "Escaneos totales" should be visible
    const scanLabel = page.locator('text=Escaneos totales').first();
    await expect(scanLabel).toBeVisible();
  });
});
