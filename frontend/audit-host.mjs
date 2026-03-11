/**
 * Host Pages Audit Script — Playwright (v2)
 * Uses real host auth token. Correct localStorage keys from authStore.ts.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://d1s9zkxvf49wr6.cloudfront.net';
const HOST_TOKEN = process.env.HOST_TOKEN;
const EVENT_ID = process.env.EVENT_ID || 'evt_tp99sVPt-yLe';
const SHOTS = path.resolve('screenshots');
const REPORT = [];

if (!HOST_TOKEN) { console.error('HOST_TOKEN env var required'); process.exit(1); }

fs.mkdirSync(SHOTS, { recursive: true });
// Clean old screenshots
for (const f of fs.readdirSync(SHOTS)) { if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f)); }

let stepNum = 0;
async function shot(page, name, note) {
  stepNum++;
  const filename = `${String(stepNum).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, filename), fullPage: true });
  REPORT.push({ step: stepNum, name, file: filename, note, url: page.url() });
  console.log(`  [${stepNum}] ${name} — ${note}`);
}

async function injectHostAuth(page, token, eventId) {
  await page.evaluate(({ token, eventId }) => {
    // authStore.ts uses these exact keys
    localStorage.setItem('ea:host:token', token);
    localStorage.setItem('ea:host:eventId', eventId);
  }, { token, eventId });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: PUBLIC PAGES
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== PHASE 1: PUBLIC PAGES ===');

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await shot(page, 'landing-top', 'Landing page — hero section');

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await shot(page, 'landing-how', 'Landing — how it works');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'landing-pricing', 'Landing — pricing section');

    await page.goto(`${BASE}/auth/host`, { waitUntil: 'networkidle' });
    await shot(page, 'host-login', 'Host login page');

    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, 'checkout-step1', 'Checkout — step 1 contact info');

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: INJECT HOST AUTH + ADMIN PAGES
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== PHASE 2: HOST ADMIN PAGES ===');

    // Navigate to base first, inject auth, then go to admin
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await injectHostAuth(page, HOST_TOKEN, EVENT_ID);

    // Dashboard
    await page.goto(`${BASE}/e/${EVENT_ID}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await shot(page, 'dashboard-top', 'Host dashboard — lobby preview + stats');

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    await shot(page, 'dashboard-photos', 'Dashboard — recent photos section');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'dashboard-actions', 'Dashboard — quick actions grid');

    // Edit Event
    console.log('\n--- Edit Event ---');
    await page.goto(`${BASE}/e/${EVENT_ID}/admin/edit`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await shot(page, 'edit-top', 'Edit event — title + cover upload area');

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    await shot(page, 'edit-description', 'Edit — description + welcome message textareas');

    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    await shot(page, 'edit-footer-location', 'Edit — footer text + location + start date');

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);
    await shot(page, 'edit-schedule-duration', 'Edit — schedule editor + duration selector');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'edit-preview', 'Edit — lobby preview panel at bottom');

    // Test focus persistence: click textarea, type, take screenshot
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(300);
    const textareas = page.locator('textarea');
    const taCount = await textareas.count();
    console.log(`  Found ${taCount} textareas`);
    if (taCount > 0) {
      await textareas.first().click();
      await page.keyboard.type('Probando foco...');
      await shot(page, 'edit-focus-test', 'Edit — textarea focus test (typing maintains focus)');
    }

    // QR Page
    console.log('\n--- QR Page ---');
    await page.goto(`${BASE}/e/${EVENT_ID}/admin/qr`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await shot(page, 'qr-top', 'QR code page — QR display');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'qr-bottom', 'QR page — share/download options');

    // Settings
    console.log('\n--- Settings ---');
    await page.goto(`${BASE}/e/${EVENT_ID}/admin/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await shot(page, 'settings-top', 'Settings — top toggles (privacy, downloads, video)');

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    await shot(page, 'settings-mid', 'Settings — email notifications, auto-approve, theme');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'settings-bottom', 'Settings — danger zone (delete event)');

    // Moderation
    console.log('\n--- Moderation ---');
    await page.goto(`${BASE}/e/${EVENT_ID}/admin/moderation`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await shot(page, 'moderation-top', 'Moderation page — pending items');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'moderation-bottom', 'Moderation — bottom');

    // Gallery Management
    console.log('\n--- Gallery Management ---');
    await page.goto(`${BASE}/e/${EVENT_ID}/admin/gallery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await shot(page, 'gallery-manage-top', 'Gallery management — top');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'gallery-manage-bottom', 'Gallery management — bottom actions');

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: GUEST FLOW
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== PHASE 3: GUEST FLOW ===');

    // Clear auth to become unauthenticated visitor
    await page.evaluate(() => localStorage.clear());

    // Guest lobby
    await page.goto(`${BASE}/e/${EVENT_ID}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'guest-lobby-hero', 'Guest lobby — hero (iPhone lock-screen style)');

    await page.evaluate(() => window.scrollTo(0, window.innerHeight));
    await page.waitForTimeout(500);
    await shot(page, 'guest-lobby-about', 'Guest lobby — about / description section');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, 'guest-lobby-footer', 'Guest lobby — footer + enter button');

    // Open enter dialog
    const enterBtn = page.locator('button').filter({ hasText: 'Entrar al evento' }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'guest-enter-dialog', 'Guest — enter dialog with nickname input');

      // Fill nickname and enter
      const nicknameInput = page.locator('#guest-nickname');
      if (await nicknameInput.isVisible()) {
        await nicknameInput.fill('Auditor Bot');
        await shot(page, 'guest-nickname-filled', 'Guest — nickname filled');

        // Submit
        const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /Entrar/ });
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await shot(page, 'guest-gallery', 'Guest gallery after entering event');

        // Check back button goes to lobby
        const backBtn = page.locator('button').filter({ hasText: '' }).first();
        // Look for the chevron-left back button in header
        const headerBack = page.locator('header button, nav button').first();
        if (await headerBack.isVisible()) {
          console.log('  Back button found in header');
        }
      }
    }

    // Guest upload page
    await page.goto(`${BASE}/e/${EVENT_ID}/upload`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'guest-upload', 'Guest upload page');

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: MOBILE PROTECTIONS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== PHASE 4: MOBILE PROTECTIONS ===');

    // Landscape orientation test
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(800);
    await shot(page, 'landscape-blocked', 'Landscape mode — portrait-lock overlay shown');

    // Back to portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: HOST PHOTO CLICK → BACK NAVIGATION TEST
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== PHASE 5: NAVIGATION TESTS ===');

    await injectHostAuth(page, HOST_TOKEN, EVENT_ID);
    await page.goto(`${BASE}/e/${EVENT_ID}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Try clicking a photo in recent uploads
    const photoBtn = page.locator('button[aria-label^="Foto subida"]').first();
    if (await photoBtn.isVisible()) {
      await photoBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, 'host-media-view', 'Host clicked photo → media view page');

      // Click close (X button)
      const closeBtn = page.locator('button[aria-label="Cerrar"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(2000);
        await shot(page, 'host-after-close', 'After closing media → should be admin dashboard (not guest gallery)');
        console.log(`  Current URL after close: ${page.url()}`);
      }
    } else {
      console.log('  No photos in recent uploads to test click navigation');
    }

    // ═══════════════════════════════════════════════════════════════════
    // WRITE REPORT
    // ═══════════════════════════════════════════════════════════════════
    const reportMd = [
      '# EventAlbum Full Audit Report',
      `\n**Date:** ${new Date().toISOString()}`,
      `**Event:** ${EVENT_ID}`,
      `**Base URL:** ${BASE}`,
      '\n## All Screenshots\n',
      '| # | Page | Notes | URL |',
      '|---|------|-------|-----|',
      ...REPORT.map(r => `| ${r.step} | ${r.name} | ${r.note} | \`${r.url}\` |`),
      `\n**Total screenshots:** ${REPORT.length}`,
    ].join('\n');

    fs.writeFileSync(path.join(SHOTS, 'AUDIT-REPORT.md'), reportMd);
    console.log(`\n✅ Audit complete! ${REPORT.length} screenshots in ${SHOTS}/`);

  } catch (err) {
    console.error('AUDIT ERROR:', err.message);
    await shot(page, 'error', `Error: ${err.message}`).catch(() => {});
  } finally {
    await browser.close();
  }
})();
