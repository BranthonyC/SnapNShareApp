import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectHostAuth, waitForSettled } from './helpers';

test.describe('Host Moderation — /e/:eventId/admin/moderation', () => {
  test.beforeEach(async ({ page }) => {
    await injectHostAuth(page, EVENT_BASIC);
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/moderation`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);
  });

  test('tab bar with "Pendientes" and "Reportados" tabs is visible', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible({ timeout: 10000 });

    // Verify the individual tabs exist
    const pendingTab = page.locator('[role="tab"]', { hasText: 'Pendientes' });
    await expect(pendingTab).toBeVisible();

    const reportedTab = page.locator('[role="tab"]', { hasText: 'Reportados' });
    await expect(reportedTab).toBeVisible();

    // The "Todos" tab should also be present
    const allTab = page.locator('[role="tab"]', { hasText: 'Todos' });
    await expect(allTab).toBeVisible();
  });

  test('click "Pendientes" tab → shows pending content or empty state', async ({ page }) => {
    const pendingTab = page.locator('[role="tab"]', { hasText: 'Pendientes' });
    await expect(pendingTab).toBeVisible({ timeout: 10000 });

    await pendingTab.click();
    await waitForSettled(page);

    // Should show either moderation tiles or the empty state message
    const hasTiles = await page.locator('button', { hasText: 'Aprobar' }).count() > 0;
    const hasEmptyState = await page.locator('text=No hay contenido pendiente').count() > 0;

    expect(hasTiles || hasEmptyState).toBe(true);
  });

  test('click "Reportados" tab → shows reported content or empty state', async ({ page }) => {
    const reportedTab = page.locator('[role="tab"]', { hasText: 'Reportados' });
    await expect(reportedTab).toBeVisible({ timeout: 10000 });

    await reportedTab.click();
    await waitForSettled(page);

    // Should show either moderation tiles or the empty state message
    const hasTiles = await page.locator('button', { hasText: 'Aprobar' }).count() > 0;
    const hasEmptyState = await page.locator('text=No hay contenido pendiente').count() > 0;

    expect(hasTiles || hasEmptyState).toBe(true);
  });
});
