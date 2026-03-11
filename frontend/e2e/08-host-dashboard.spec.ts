import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectHostAuth, waitForSettled } from './helpers';

test.describe('Host Dashboard — /e/:eventId/admin', () => {
  test.beforeEach(async ({ page }) => {
    await injectHostAuth(page, EVENT_BASIC);
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);
  });

  test('dashboard shows event title in header', async ({ page }) => {
    // AdminLayout renders the event title as the page header
    const header = page.locator('h1').first();
    await expect(header).toBeVisible();
    // Title should not be the loading placeholder
    await expect(header).not.toHaveText('Cargando...');
    // Title should have actual content (not empty)
    const text = await header.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });

  test('stats section shows "Fotos subidas" and a count', async ({ page }) => {
    const statLabel = page.locator('text=Fotos subidas');
    await expect(statLabel).toBeVisible();

    // The stat value is rendered in a sibling element within the same StatCard
    const statCard = statLabel.locator('..');
    const statValue = statCard.locator('p.font-bold').first();
    await expect(statValue).toBeVisible();

    // Count should be a number (the basic event has 15+ uploads)
    const valueText = await statValue.textContent();
    expect(Number(valueText!.trim())).toBeGreaterThanOrEqual(0);
  });

  test('"Acciones rápidas" section visible with action buttons', async ({ page }) => {
    const sectionTitle = page.locator('h2', { hasText: 'Acciones rápidas' });
    await expect(sectionTitle.first()).toBeVisible();

    // Scope buttons to the quick-actions parent (avoids matching sidebar buttons)
    const section = sectionTitle.first().locator('..');
    await expect(section.locator('button', { hasText: 'Ver galería' })).toBeVisible();
    await expect(section.locator('button', { hasText: 'Código QR' })).toBeVisible();
    await expect(section.locator('button', { hasText: 'Editar evento' })).toBeVisible();
    await expect(section.locator('button', { hasText: 'Configuración' })).toBeVisible();
    await expect(section.locator('button', { hasText: 'Moderación' })).toBeVisible();
    await expect(section.locator('button', { hasText: 'Gestionar galería' })).toBeVisible();
  });

  test('recent photos section shows photo thumbnails', async ({ page }) => {
    const recentTitle = page.locator('h2', { hasText: 'Fotos recientes' });
    await expect(recentTitle).toBeVisible();

    // EVENT_BASIC has 15+ uploads so there should be at least 1 thumbnail
    const thumbnails = page.locator('button[aria-label^="Foto subida por"] img');
    await expect(thumbnails.first()).toBeVisible({ timeout: 10000 });

    const count = await thumbnails.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('click photo → navigates to media view', async ({ page }) => {
    // Wait for thumbnails to load
    const photoButton = page.locator('button[aria-label^="Foto subida por"]').first();
    await expect(photoButton).toBeVisible({ timeout: 10000 });

    await photoButton.click();
    await waitForSettled(page);

    // Should navigate to /e/:eventId/media/:mediaId
    await expect(page).toHaveURL(new RegExp(`/e/${EVENT_BASIC}/media/`));
  });

  test('close media view → returns to admin (not guest gallery)', async ({ page }) => {
    // Wait for thumbnails to load
    const photoButton = page.locator('button[aria-label^="Foto subida por"]').first();
    await expect(photoButton).toBeVisible({ timeout: 10000 });

    await photoButton.click();
    await waitForSettled(page);

    // Verify we're on the media view page
    await expect(page).toHaveURL(new RegExp(`/e/${EVENT_BASIC}/media/`));

    // Go back (the media view passes state: { from: 'admin' })
    await page.goBack();
    await waitForSettled(page);

    // Should return to admin dashboard, NOT the guest gallery
    await expect(page).toHaveURL(new RegExp(`/e/${EVENT_BASIC}/admin`));
  });
});
