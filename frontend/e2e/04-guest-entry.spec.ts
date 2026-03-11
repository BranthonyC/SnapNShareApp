import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectGuestAuth, waitForSettled } from './helpers';

test.describe('Guest Entry / Lobby Page', () => {
  // ── Paid event (no password) ────────────────────────────────────────────

  test.describe('Paid event (no password)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/e/${EVENT_PAID}`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);
    });

    test('lobby loads with event title, date, and host name', async ({ page }) => {
      // Hero section shows the event title in h1
      const title = page.locator('h1');
      await expect(title).toBeVisible();
      await expect(title).not.toBeEmpty();

      // Date line visible (formatted in Spanish)
      const dateLine = page.locator('text=/\\d{1,2} de \\w+ de \\d{4}/');
      await expect(dateLine).toBeVisible();

      // Host name line: "Organizado por ..."
      const hostLine = page.locator('text=/Organizado por/');
      await expect(hostLine).toBeVisible();
    });

    test('"Entrar al evento" button is visible', async ({ page }) => {
      const enterButton = page.getByRole('button', { name: 'Entrar al evento' });
      await expect(enterButton).toBeVisible();
    });

    test('clicking "Entrar al evento" opens nickname dialog', async ({ page }) => {
      const enterButton = page.getByRole('button', { name: 'Entrar al evento' });
      await enterButton.click();

      // Dialog heading
      const dialogTitle = page.locator('h3', { hasText: 'Ingresa al evento' });
      await expect(dialogTitle).toBeVisible();

      // Nickname input
      const nicknameInput = page.locator('#guest-nickname');
      await expect(nicknameInput).toBeVisible();

      // Submit button inside the dialog
      const submitButton = page.locator('form button[type="submit"]', { hasText: 'Entrar al evento' });
      await expect(submitButton).toBeVisible();
    });

    test('fill nickname and submit redirects to /gallery', async ({ page }) => {
      // Open dialog
      const enterButton = page.getByRole('button', { name: 'Entrar al evento' });
      await enterButton.click();

      // Fill nickname
      const nicknameInput = page.locator('#guest-nickname');
      await nicknameInput.fill('E2E Entry Test');

      // Submit
      const submitButton = page.locator('form button[type="submit"]', { hasText: 'Entrar al evento' });
      await submitButton.click();

      // Wait for navigation to /gallery
      await page.waitForURL(`**/e/${EVENT_PAID}/gallery`, { timeout: 15_000 });
      expect(page.url()).toContain(`/e/${EVENT_PAID}/gallery`);
    });

    test('after auth, revisiting lobby shows "Ver galeria" button', async ({ page }) => {
      // Inject guest auth so we are already authenticated
      await injectGuestAuth(page, EVENT_PAID, 'E2E Return Visitor');

      // Navigate to the lobby
      await page.goto(`${BASE}/e/${EVENT_PAID}`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      // Should see "Ver galeria" instead of "Entrar al evento"
      const viewGalleryButton = page.getByRole('button', { name: /Ver galería/ });
      await expect(viewGalleryButton).toBeVisible();

      // "Entrar al evento" should NOT be visible
      const enterButton = page.getByRole('button', { name: 'Entrar al evento' });
      await expect(enterButton).not.toBeVisible();
    });
  });

  // ── Basic event (password-protected) ───────────────────────────────────

  test.describe('Basic event (password-protected)', () => {
    test('entering without password shows WRONG_PASSWORD and reveals password field', async ({ page }) => {
      await page.goto(`${BASE}/e/${EVENT_BASIC}`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      // Open dialog
      const enterButton = page.getByRole('button', { name: 'Entrar al evento' });
      await enterButton.click();

      // Fill nickname only (no password)
      const nicknameInput = page.locator('#guest-nickname');
      await nicknameInput.fill('E2E No Password');

      // Submit
      const submitButton = page.locator('form button[type="submit"]', { hasText: 'Entrar al evento' });
      await submitButton.click();

      // Wait for error to appear
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 10_000 });
      await expect(errorAlert).toContainText('Contraseña incorrecta');

      // Password field should now be visible
      const passwordInput = page.locator('#guest-password');
      await expect(passwordInput).toBeVisible();
    });

    test('entering with correct password succeeds and redirects to gallery', async ({ page }) => {
      await page.goto(`${BASE}/e/${EVENT_BASIC}`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      // Open dialog
      const enterButton = page.getByRole('button', { name: 'Entrar al evento' });
      await enterButton.click();

      // Fill nickname (no password first to trigger password field)
      const nicknameInput = page.locator('#guest-nickname');
      await nicknameInput.fill('E2E Password Test');

      const submitButton = page.locator('form button[type="submit"]', { hasText: 'Entrar al evento' });
      await submitButton.click();

      // Wait for password field to appear
      const passwordInput = page.locator('#guest-password');
      await expect(passwordInput).toBeVisible({ timeout: 10_000 });

      // Fill correct password
      await passwordInput.fill('test1234');

      // Submit again
      await submitButton.click();

      // Should redirect to gallery
      await page.waitForURL(`**/e/${EVENT_BASIC}/gallery`, { timeout: 15_000 });
      expect(page.url()).toContain(`/e/${EVENT_BASIC}/gallery`);
    });
  });
});
