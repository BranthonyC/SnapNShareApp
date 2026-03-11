import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectHostAuth, waitForSettled } from './helpers';

test.describe('Host Gallery Manage — /e/:eventId/admin/gallery', () => {
  test.beforeEach(async ({ page }) => {
    await injectHostAuth(page, EVENT_BASIC);
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/gallery`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);
  });

  test('media grid shows photo thumbnails', async ({ page }) => {
    // The grid uses role="list" with aria-label="Galeria de fotos"
    const gallery = page.locator('[role="list"][aria-label="Galeria de fotos"]');
    await expect(gallery).toBeVisible({ timeout: 15000 });

    // EVENT_BASIC has 15+ uploads, so there should be images
    const images = gallery.locator('[role="listitem"] img');
    await expect(images.first()).toBeVisible({ timeout: 10000 });

    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('search input is visible', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await expect(searchInput).toBeVisible();
  });

  test('selection mode button ("Seleccionar") is visible', async ({ page }) => {
    const selectButton = page.locator('button', { hasText: 'Seleccionar' });
    await expect(selectButton).toBeVisible();
  });

  test('click "Seleccionar" enters selection mode with checkboxes', async ({ page }) => {
    // Wait for the gallery to load first
    const gallery = page.locator('[role="list"][aria-label="Galeria de fotos"]');
    await expect(gallery).toBeVisible({ timeout: 15000 });

    // Click the "Seleccionar" button to enter selection mode
    const selectButton = page.locator('button', { hasText: 'Seleccionar' });
    await selectButton.click();
    await waitForSettled(page, 500);

    // In selection mode, each tile gets a selection overlay with a checkbox icon
    // The selection buttons have aria-label "Seleccionar" or "Deseleccionar"
    const selectionOverlays = page.locator('button[aria-label="Seleccionar"]');
    const count = await selectionOverlays.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Toolbar should show "Seleccionar todo", "Deseleccionar", and "Cancelar" buttons
    await expect(page.locator('button', { hasText: 'Seleccionar todo' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Deseleccionar' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Cancelar' })).toBeVisible();

    // Exit selection mode
    await page.locator('button', { hasText: 'Cancelar' }).click();
    await waitForSettled(page, 500);

    // "Seleccionar" button should reappear
    await expect(page.locator('button', { hasText: /^Seleccionar$/ })).toBeVisible();
  });
});
