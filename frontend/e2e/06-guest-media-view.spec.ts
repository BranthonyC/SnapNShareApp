import { test, expect } from '@playwright/test';
import { BASE, EVENT_PAID, EVENT_BASIC, injectGuestAuth, waitForSettled } from './helpers';

test.describe('Guest Media View Page', () => {
  test.describe('Viewing a photo from gallery', () => {
    test.beforeEach(async ({ page }) => {
      // Authenticate and navigate to gallery
      await injectGuestAuth(page, EVENT_PAID, 'E2E Media Viewer');
      await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'domcontentloaded' });
      await waitForSettled(page);

      // Wait for photos and click the first one
      const photos = page.locator('a[aria-label^="Foto subida por"]');
      await expect(photos.first()).toBeVisible({ timeout: 15_000 });
      await photos.first().click();

      // Wait for the media view page to load
      await page.waitForURL(`**/e/${EVENT_PAID}/media/**`, { timeout: 10_000 });
      await waitForSettled(page);
    });

    test('full-screen viewer loads with image', async ({ page }) => {
      // The viewer renders an img with alt "Foto subida por ..."
      const image = page.locator('img[alt^="Foto subida por"]');
      await expect(image).toBeVisible({ timeout: 10_000 });
    });

    test('3 reaction buttons are visible', async ({ page }) => {
      // Three reaction buttons: "Me encanta" (heart), "Me gusta" (thumbsup), "Fiesta" (party)
      const heartButton = page.getByRole('button', { name: 'Me encanta' });
      const thumbsButton = page.getByRole('button', { name: 'Me gusta' });
      const partyButton = page.getByRole('button', { name: 'Fiesta' });

      await expect(heartButton).toBeVisible();
      await expect(thumbsButton).toBeVisible();
      await expect(partyButton).toBeVisible();
    });

    test('comment button is visible', async ({ page }) => {
      const commentButton = page.getByRole('button', { name: 'Comentarios' });
      await expect(commentButton).toBeVisible();
    });

    test('clicking comment button opens comment sheet', async ({ page }) => {
      const commentButton = page.getByRole('button', { name: 'Comentarios' });
      await commentButton.click();

      // Comment sheet heading
      const sheetTitle = page.locator('h3', { hasText: 'Comentarios' });
      await expect(sheetTitle).toBeVisible({ timeout: 5_000 });

      // Comment input placeholder
      const commentInput = page.locator('input[placeholder="Escribe un comentario..."]');
      await expect(commentInput).toBeVisible();

      // Send button
      const sendButton = page.getByRole('button', { name: 'Enviar comentario' });
      await expect(sendButton).toBeVisible();
    });

    test('closing comment sheet returns to media view', async ({ page }) => {
      // Open comments
      const commentButton = page.getByRole('button', { name: 'Comentarios' });
      await commentButton.click();

      const sheetTitle = page.locator('h3', { hasText: 'Comentarios' });
      await expect(sheetTitle).toBeVisible({ timeout: 5_000 });

      // Close via the X button inside the comment sheet header
      const closeButton = page.locator('.animate-slide-up button[aria-label="Cerrar"]');
      await closeButton.click();

      // Comment sheet should be gone
      await expect(sheetTitle).not.toBeVisible();

      // The image should still be visible (still on media view)
      const image = page.locator('img[alt^="Foto subida por"]');
      await expect(image).toBeVisible();
    });

    test('close button returns to gallery', async ({ page }) => {
      // The top-bar close button (X) with aria-label "Cerrar"
      const closeButton = page.locator('div.absolute.top-0 button[aria-label="Cerrar"]');
      await expect(closeButton).toBeVisible();

      await closeButton.click();

      // Should navigate back to gallery
      await page.waitForURL(`**/e/${EVENT_PAID}/gallery`, { timeout: 10_000 });
      expect(page.url()).toContain(`/e/${EVENT_PAID}/gallery`);
    });

    test('image has anti-save protections (no-drag, no-select, contextmenu prevention)', async ({ page }) => {
      const image = page.locator('img[alt^="Foto subida por"]');
      await expect(image).toBeVisible({ timeout: 10_000 });

      // Verify the image is not draggable
      const draggable = await image.getAttribute('draggable');
      expect(draggable).toBe('false');

      // Verify the image has select-none class (user-select: none)
      const hasSelectNone = await image.evaluate(
        (el) => el.classList.contains('select-none'),
      );
      expect(hasSelectNone).toBe(true);

      // Verify contextmenu event is prevented (onContextMenu handler)
      const defaultPrevented = await image.evaluate((el) => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        return !el.dispatchEvent(event); // returns false if preventDefault was called
      });
      expect(defaultPrevented).toBe(true);
    });

    test('uploader info is shown (subida por ... )', async ({ page }) => {
      // Bottom bar shows "Subida por <name> . hace ..."
      const uploaderInfo = page.locator('text=/Subida por/');
      await expect(uploaderInfo).toBeVisible();
    });

    test('photo counter shows position (e.g. "1 / 5")', async ({ page }) => {
      // Top bar counter "N / M"
      const counter = page.locator('text=/\\d+ \\/ \\d+/');
      await expect(counter).toBeVisible();
    });
  });
});
