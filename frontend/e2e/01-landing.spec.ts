import { test, expect } from '@playwright/test';
import { API, BASE, EVENT_PAID, EVENT_BASIC, apiCall, waitForSettled } from './helpers';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  });

  test('page loads with title "Loving Memory"', async ({ page }) => {
    await expect(page).toHaveTitle(/Loving Memory/);
  });

  test('hero section is visible with CTA buttons', async ({ page }) => {
    // Main heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('momento');

    // CTA buttons: "Crea tu evento" (hero) and "Cómo funciona"
    // Hero CTA is first; pricing section also has "Crea tu evento" — use .first()
    const ctaCreate = page.locator('a[href="/create"] button', { hasText: 'Crea tu evento' }).first();
    await expect(ctaCreate).toBeVisible();

    const ctaHowItWorks = page.locator('a[href="#como-funciona"] button', { hasText: 'Cómo funciona' });
    await expect(ctaHowItWorks).toBeVisible();
  });

  test('pricing section shows 3 tiers (Básico, Estándar, Premium)', async ({ page }) => {
    const pricingSection = page.locator('section#precios');
    await expect(pricingSection).toBeVisible();

    // Verify the three tier names are present
    await expect(pricingSection.locator('h3', { hasText: 'Básico' })).toBeVisible();
    await expect(pricingSection.locator('h3', { hasText: 'Estándar' })).toBeVisible();
    await expect(pricingSection.locator('h3', { hasText: 'Premium' })).toBeVisible();
  });

  test('"Crear evento" buttons link to /create or /checkout', async ({ page }) => {
    const pricingSection = page.locator('section#precios');

    // Basic tier links to /create
    const basicLink = pricingSection.locator('a[href="/create"]');
    await expect(basicLink).toBeVisible();

    // Paid tier links to /checkout?tier=paid
    const paidLink = pricingSection.locator('a[href="/checkout?tier=paid"]');
    await expect(paidLink).toBeVisible();

    // Premium tier links to /checkout?tier=premium
    const premiumLink = pricingSection.locator('a[href="/checkout?tier=premium"]');
    await expect(premiumLink).toBeVisible();
  });

  test('footer is visible with branding and links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Footer has Loving Memory branding (logo text + copyright both contain it — use first)
    await expect(footer.locator('text=Loving Memory').first()).toBeVisible();

    // Footer nav links
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="mailto:hola@snapnshare.app"]')).toBeVisible();

    // Copyright text
    await expect(footer.locator('text=Todos los derechos reservados')).toBeVisible();
  });
});
