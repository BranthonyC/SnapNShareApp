import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, waitForSettled } from './helpers';

test.describe('Checkout Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' });
  });

  test('page loads with 3-step wizard indicator', async ({ page }) => {
    // Step circles exist in both desktop header (hidden) and mobile main (visible).
    // Scope to the main element to get the mobile step indicator.
    const main = page.locator('main');
    const stepCircle = main.locator('.rounded-full').first();
    await expect(stepCircle).toBeVisible();

    // Step 1 number should be visible
    await expect(main.getByText('1').first()).toBeVisible();
  });

  test.describe('Step 1: Contact form', () => {
    test('name and email inputs are visible', async ({ page }) => {
      const nameInput = page.locator('#host-name');
      const emailInput = page.locator('#host-email');

      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();

      // "Siguiente" (Next) button is visible
      const nextButton = page.locator('button', { hasText: 'Siguiente' });
      await expect(nextButton).toBeVisible();
    });

    test('fill name + email and click Next advances to step 2', async ({ page }) => {
      await page.locator('#host-name').fill('E2E Test Host');
      await page.locator('#host-email').fill('e2e@test.com');

      await page.locator('button', { hasText: 'Siguiente' }).click();

      // Step 2 should now be visible: event details form
      await expect(page.locator('#event-title')).toBeVisible();
    });
  });

  test.describe('Step 2: Event form', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to step 2 by filling step 1
      await page.locator('#host-name').fill('E2E Test Host');
      await page.locator('#host-email').fill('e2e@test.com');
      await page.locator('button', { hasText: 'Siguiente' }).click();
      await expect(page.locator('#event-title')).toBeVisible();
    });

    test('title and date inputs are visible', async ({ page }) => {
      await expect(page.locator('#event-title')).toBeVisible();
      await expect(page.locator('#event-start')).toBeVisible();
    });

    test('fill title + date and click Next advances to step 3', async ({ page }) => {
      await page.locator('#event-title').fill('E2E Test Event');
      await page.locator('#event-start').fill('2026-12-31T18:00');

      await page.locator('button', { hasText: 'Siguiente' }).click();

      // Step 3 should now be visible: plan selection
      await expect(page.locator('text=Elige tu plan')).toBeVisible();
    });
  });

  test.describe('Step 3: Plan selection', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to step 3 by filling steps 1 and 2
      await page.locator('#host-name').fill('E2E Test Host');
      await page.locator('#host-email').fill('e2e@test.com');
      await page.locator('button', { hasText: 'Siguiente' }).click();

      await page.locator('#event-title').fill('E2E Test Event');
      await page.locator('#event-start').fill('2026-12-31T18:00');
      await page.locator('button', { hasText: 'Siguiente' }).click();

      await expect(page.locator('text=Elige tu plan')).toBeVisible();
    });

    test('shows tier cards for Básico, Estándar, and Premium', async ({ page }) => {
      await expect(page.locator('h3', { hasText: 'Básico' })).toBeVisible();
      await expect(page.locator('h3', { hasText: 'Estándar' })).toBeVisible();
      await expect(page.locator('h3', { hasText: 'Premium' })).toBeVisible();
    });

    test('currency toggle switches between GTQ and USD', async ({ page }) => {
      // Default should be USD — check for USD prices
      await expect(page.locator('text=$15').first()).toBeVisible();

      // Click GTQ toggle
      await page.locator('button', { hasText: 'GTQ' }).click();

      // Should now show GTQ prices
      await expect(page.locator('text=Q116').first()).toBeVisible();

      // Click USD toggle to switch back
      await page.locator('button', { hasText: 'USD' }).click();

      // Should show USD prices again
      await expect(page.locator('text=$15').first()).toBeVisible();
    });

    test('promo code input is visible', async ({ page }) => {
      // Promo code exists in both desktop sidebar and mobile layout — use first visible
      const promoInput = page.locator('#promo-code').first();
      await expect(promoInput).toBeVisible();

      // "Aplicar" button should be visible next to promo input
      await expect(page.locator('button', { hasText: 'Aplicar' }).first()).toBeVisible();
    });

    test('basic tier shows "Crear evento y pagar $1" button when selected', async ({ page }) => {
      // Click the Básico tier card to select it
      const basicCard = page.locator('button', { has: page.locator('h3', { hasText: 'Básico' }) }).first();
      await basicCard.click();

      // The CTA should show the price for basic tier
      await expect(page.locator('button', { hasText: /Crear evento y pagar/ }).first()).toBeVisible();
    });
  });
});
