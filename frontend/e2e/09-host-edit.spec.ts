import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectHostAuth, waitForSettled } from './helpers';

test.describe('Host Edit Event — /e/:eventId/admin/edit', () => {
  test.beforeEach(async ({ page }) => {
    await injectHostAuth(page, EVENT_BASIC);
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/edit`, { waitUntil: 'domcontentloaded' });
    await waitForSettled(page);
  });

  test('title input is pre-filled with event title', async ({ page }) => {
    // Mobile + desktop layouts both render form fields — use .first() (mobile is first in DOM)
    const titleInput = page.locator('input#event-title').first();
    await expect(titleInput).toBeVisible();

    // Should be pre-filled (not empty) once event data loads
    const value = await titleInput.inputValue();
    expect(value.trim().length).toBeGreaterThan(0);
  });

  test('description textarea is visible', async ({ page }) => {
    const descriptionTextarea = page.locator('textarea#event-description').first();
    await expect(descriptionTextarea).toBeVisible();
  });

  test('location input is visible', async ({ page }) => {
    const locationInput = page.locator('input#event-location').first();
    await expect(locationInput).toBeVisible();
  });

  test('"Guardar cambios" button is visible', async ({ page }) => {
    const saveButton = page.locator('button[type="submit"]', { hasText: 'Guardar cambios' }).first();
    await expect(saveButton).toBeVisible();
  });

  test('edit description → save → no error shown', async ({ page }) => {
    const descriptionTextarea = page.locator('textarea#event-description').first();
    await expect(descriptionTextarea).toBeVisible();

    // Append a timestamp to description to make an observable change
    const timestamp = `E2E test ${Date.now()}`;
    await descriptionTextarea.fill(timestamp);

    // Click save
    const saveButton = page.locator('button[type="submit"]', { hasText: 'Guardar cambios' }).first();
    await saveButton.click();
    await waitForSettled(page);

    // No error alert should appear
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toHaveCount(0);

    // Success message should appear
    const successMessage = page.locator('[role="status"]', { hasText: 'Cambios guardados' });
    await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('schedule section visible with "Agregar horario" button', async ({ page }) => {
    const scheduleLabel = page.locator('text=Horario del evento').first();
    await expect(scheduleLabel).toBeVisible();

    const addScheduleButton = page.locator('button', { hasText: 'Agregar horario' }).first();
    await expect(addScheduleButton).toBeVisible();

    // Click to add a schedule item — should show time and label inputs
    await addScheduleButton.click();

    const timeInput = page.locator('input[type="time"]').first();
    await expect(timeInput).toBeVisible();

    const labelInput = page.locator('input[placeholder="Ceremonia"]').first();
    await expect(labelInput).toBeVisible();
  });
});
