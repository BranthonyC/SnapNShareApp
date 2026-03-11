import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectHostAuth, waitForSettled } from './helpers';

test.describe('Host Settings — /e/:eventId/admin/settings', () => {
  test.beforeEach(async ({ page }) => {
    await injectHostAuth(page, EVENT_BASIC);
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/settings`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);
  });

  test('toggle switches are visible (multiple)', async ({ page }) => {
    // Toggle switches use role="switch"
    const toggles = page.locator('button[role="switch"]');
    await expect(toggles.first()).toBeVisible({ timeout: 10000 });

    const count = await toggles.count();
    // At least 3 toggles (mobile + desktop may both render; check for >= 3)
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('"Galería privada" toggle is visible', async ({ page }) => {
    const galleryToggle = page.locator('button[role="switch"][aria-label="Galería privada"]').first();
    await expect(galleryToggle).toBeVisible({ timeout: 10000 });
  });

  test('"Mostrar fecha y hora" toggle is visible', async ({ page }) => {
    const dateTimeToggle = page.locator('button[role="switch"][aria-label="Mostrar fecha y hora"]').first();
    await expect(dateTimeToggle).toBeVisible({ timeout: 10000 });
  });

  test('color theme selector shows color swatches', async ({ page }) => {
    // The "Tema de color" label should be visible
    const themeLabel = page.locator('text=Tema de color').first();
    await expect(themeLabel).toBeVisible();

    // There should be 4 color swatch buttons (green, blue, coral, gold)
    const swatches = page.locator('button[aria-label^="Tema "]');
    await expect(swatches.first()).toBeVisible();

    // Mobile + desktop both render = 8 total, or just 4 if single render
    const count = await swatches.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('clicking a toggle changes its state', async ({ page }) => {
    // Use "Galería privada" toggle for this test (available on all tiers)
    const toggle = page.locator('button[role="switch"][aria-label="Galería privada"]').first();
    await expect(toggle).toBeVisible({ timeout: 10000 });

    // Read initial state
    const initialState = await toggle.getAttribute('aria-checked');

    // Click to toggle
    await toggle.click();
    await waitForSettled(page, 1000);

    // State should have changed
    const newState = await toggle.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);

    // Toggle back to restore original state
    await toggle.click();
    await waitForSettled(page, 1000);
  });

  test('"Zona peligrosa" section is visible with delete buttons', async ({ page }) => {
    // Scroll down if needed — the danger zone is at the bottom
    const dangerHeader = page.locator('text=Zona peligrosa').first();
    await dangerHeader.scrollIntoViewIfNeeded();
    await expect(dangerHeader).toBeVisible();

    // Two danger buttons: "Eliminar todo el contenido" and "Eliminar evento"
    const clearButton = page.locator('button', { hasText: 'Eliminar todo el contenido' }).first();
    await expect(clearButton).toBeVisible();

    const deleteButton = page.locator('button', { hasText: 'Eliminar evento' }).first();
    await expect(deleteButton).toBeVisible();
  });
});
