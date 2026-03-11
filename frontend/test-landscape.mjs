import { chromium } from 'playwright';
import path from 'path';

const BASE = 'https://d1s9zkxvf49wr6.cloudfront.net';
const SHOTS = path.resolve('screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/e/evt_tp99sVPt-yLe`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, 'test-portrait.png'), fullPage: false });
  console.log('Portrait screenshot taken');

  // Switch to landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOTS, 'test-landscape.png'), fullPage: false });
  console.log('Landscape screenshot taken');

  await browser.close();
})();
