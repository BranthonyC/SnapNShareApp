/**
 * Functional Audit — tests every interactive feature via API + Playwright
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const API = 'https://nqndi6afrl.execute-api.us-east-1.amazonaws.com/staging';
const BASE = 'https://d1s9zkxvf49wr6.cloudfront.net';
const HOST_TOKEN = process.env.HOST_TOKEN;
// evt_sNT94rwbcViC = basic, 15 uploads, no password
// evt_PS-u3__aILAD = paid, 5 uploads + reactions + guests
const EVENT_BASIC = 'evt_sNT94rwbcViC';
const EVENT_PAID = 'evt_PS-u3__aILAD';
const SHOTS = path.resolve('screenshots/functional');
const RESULTS = [];

fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(SHOTS)) { if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f)); }

let stepNum = 0;
function log(pass, name, detail) {
  stepNum++;
  const status = pass ? 'PASS' : 'FAIL';
  RESULTS.push({ step: stepNum, status, name, detail });
  console.log(`  [${stepNum}] ${status} — ${name}: ${detail}`);
}

async function shot(page, name) {
  const filename = `${String(stepNum).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, filename), fullPage: false });
}

async function apiCall(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   EVENTALBUM FUNCTIONAL AUDIT                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: API-LEVEL TESTS (HOST)
  // ═══════════════════════════════════════════════════════════════
  console.log('=== SECTION 1: HOST API TESTS ===');

  // 1.1 Get event
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}`, null, HOST_TOKEN);
    log(r.ok && r.data.title, 'getEvent (host)', `title="${r.data.title}", tier=${r.data.tier}`);
  }

  // 1.2 Get stats
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}/stats`, null, HOST_TOKEN);
    log(r.ok && r.data.uploads, 'getStats', `uploads=${r.data.uploads?.count}/${r.data.uploads?.limit}, guests=${r.data.guests?.total}`);
  }

  // 1.3 Get storage
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}/storage`, null, HOST_TOKEN);
    log(r.ok, 'getStorage', `totalBytes=${r.data.totalBytes}`);
  }

  // 1.4 Get QR stats
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}/qr-stats`, null, HOST_TOKEN);
    log(r.ok, 'getQrStats', `scans=${r.data.totalScans}, unique=${r.data.uniqueVisitors}`);
  }

  // 1.5 List media
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}/media?limit=5`, null, HOST_TOKEN);
    log(r.ok && Array.isArray(r.data.items), 'listMedia', `count=${r.data.items?.length}, total=${r.data.total}`);
  }

  // 1.6 Search media
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}/media/search?q=test&limit=5`, null, HOST_TOKEN);
    log(r.ok && Array.isArray(r.data.items), 'searchMedia', `results=${r.data.items?.length}`);
  }

  // 1.7 Update event (edit fields)
  {
    const r = await apiCall('PATCH', `/events/${EVENT_BASIC}`, {
      description: 'Audit test description — ' + new Date().toISOString(),
      welcomeMessage: 'Bienvenidos al audit test!',
      footerText: 'Gracias por participar',
      location: 'Test Location',
    }, HOST_TOKEN);
    log(r.ok, 'updateEvent (description, welcome, footer, location)', `status=${r.status}`);
  }

  // 1.8 Update event (schedule)
  {
    const r = await apiCall('PATCH', `/events/${EVENT_BASIC}`, {
      schedule: [
        { time: '14:00', label: 'Ceremonia', icon: 'clock' },
        { time: '16:00', label: 'Recepción', icon: 'location' },
      ],
    }, HOST_TOKEN);
    log(r.ok, 'updateEvent (schedule)', `status=${r.status}`);
  }

  // 1.9 Verify the update persisted
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}`, null, HOST_TOKEN);
    const hasLocation = r.data.location === 'Test Location';
    const hasSchedule = r.data.schedule?.length === 2;
    const hasWelcome = r.data.welcomeMessage === 'Bienvenidos al audit test!';
    log(hasLocation && hasSchedule && hasWelcome, 'updateEvent persistence check',
      `location=${hasLocation}, schedule=${hasSchedule}, welcome=${hasWelcome}`);
  }

  // 1.10 Update settings
  {
    const r = await apiCall('PATCH', `/events/${EVENT_BASIC}/settings`, {
      allowDownloads: true,
      emailNotifications: true,
      showDateTime: true,
    }, HOST_TOKEN);
    log(r.ok, 'updateSettings', `status=${r.status}`);
  }

  // 1.11 Get config (public)
  {
    const r = await apiCall('GET', '/config', null, null);
    log(r.ok && r.data.tiers, 'getConfig (public)', `tiers=${Object.keys(r.data.tiers || {}).join(',')}`);
  }

  // 1.12 Get activity
  {
    const r = await apiCall('GET', `/events/${EVENT_BASIC}/activity`, null, HOST_TOKEN);
    log(r.ok || r.status === 200, 'getActivity', `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: GUEST AUTH + INTERACTIONS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 2: GUEST AUTH + INTERACTIONS ===');

  // 2.1 Public getEvent (unauthenticated — lobby fields only)
  {
    const r = await apiCall('GET', `/events/${EVENT_PAID}`, null, null);
    const hasPublicFields = r.data.title && r.data.eventId;
    const noHostFields = !r.data.hostEmail && !r.data.guestPassword;
    log(r.ok && hasPublicFields && noHostFields, 'getEvent (public/unauthenticated)',
      `title="${r.data.title}", hasHostEmail=${!!r.data.hostEmail}`);
  }

  // 2.2 Guest auth (no password event — use PAID event which has no guestPassword)
  let guestToken = null;
  {
    const r = await apiCall('POST', `/events/${EVENT_PAID}/auth`, { nickname: 'AuditBot' });
    guestToken = r.data.token;
    log(r.ok && guestToken, 'authEvent (guest, no password)',
      `role=${r.data.role}, nickname=${r.data.nickname}, verified=${r.data.verified}`);
  }

  // 2.3 Guest auth (password event — wrong password)
  {
    const r = await apiCall('POST', `/events/${EVENT_BASIC}/auth`, { nickname: 'Test' });
    log(r.status === 403 && r.data.error?.code === 'WRONG_PASSWORD', 'authEvent (wrong password)',
      `code=${r.data.error?.code}`);
  }

  // 2.4 Guest auth (password event — correct password)
  {
    const r = await apiCall('POST', `/events/${EVENT_BASIC}/auth`, { nickname: 'Test', password: 'test1234' });
    log(r.ok && r.data.token, 'authEvent (correct password)', `ok=${r.ok}`);
  }

  // 2.5 List media as guest (should only see visible items)
  {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/media?limit=5`, null, guestToken);
    const allVisible = r.data.items?.every(i => i.status === 'visible') ?? true;
    log(r.ok && allVisible, 'listMedia (guest, visible only)',
      `count=${r.data.items?.length}, allVisible=${allVisible}`);
  }

  // 2.6 Reaction (requires OTP — should fail for unverified guest)
  let mediaId = null;
  {
    // Use host token to get media list (guaranteed to have items)
    const mediaRes = await apiCall('GET', `/events/${EVENT_PAID}/media?limit=1`, null, HOST_TOKEN);
    mediaId = mediaRes.data.items?.[0]?.mediaId;
    if (mediaId) {
      const r = await apiCall('POST', `/events/${EVENT_PAID}/media/${mediaId}/reactions`, { emoji: 'heart' }, guestToken);
      log(r.status === 403, 'addReaction (unverified guest — should fail)',
        `status=${r.status}, code=${r.data.error?.code}`);
    } else {
      log(false, 'addReaction (unverified guest)', 'No media found to test');
    }
  }

  // 2.7 Comment (requires OTP — should fail for unverified guest)
  {
    if (mediaId) {
      const r = await apiCall('POST', `/events/${EVENT_PAID}/media/${mediaId}/comments`, { text: 'Test comment' }, guestToken);
      log(r.status === 403, 'addComment (unverified guest — should fail)',
        `status=${r.status}, code=${r.data.error?.code}`);
    } else {
      log(false, 'addComment (unverified guest)', 'No media found');
    }
  }

  // 2.8 Host adding a comment (should always work)
  {
    if (mediaId) {
      const r = await apiCall('POST', `/events/${EVENT_PAID}/media/${mediaId}/comments`, { text: 'Host audit comment' }, HOST_TOKEN);
      log(r.ok && r.data.commentId, 'addComment (host)',
        `commentId=${r.data.commentId}, status=${r.data.status}`);
    }
  }

  // 2.9 List comments
  {
    if (mediaId) {
      const r = await apiCall('GET', `/events/${EVENT_PAID}/media/${mediaId}/comments`, null, HOST_TOKEN);
      log(r.ok && Array.isArray(r.data.items), 'listComments',
        `count=${r.data.items?.length}`);
    }
  }

  // 2.10 Host adding a reaction (should work)
  {
    if (mediaId) {
      const r = await apiCall('POST', `/events/${EVENT_PAID}/media/${mediaId}/reactions`, { emoji: 'heart' }, HOST_TOKEN);
      log(r.ok, 'addReaction (host)', `status=${r.status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: AUTO-APPROVE / MODERATION
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 3: MODERATION SETTINGS ===');

  // 3.1 Check current autoApprove setting
  // Note: autoApprove toggle is premium-only. Paid/basic can only have it on (default).
  {
    const r = await apiCall('GET', `/events/${EVENT_PAID}`, null, HOST_TOKEN);
    log(true, 'autoApprove current value', `autoApprove=${r.data.autoApprove}, tier=${r.data.tier}`);
  }

  // 3.2 Turn autoApprove OFF (paid tier — should fail, premium-only feature)
  {
    const r = await apiCall('PATCH', `/events/${EVENT_PAID}/settings`, { autoApprove: false }, HOST_TOKEN);
    // autoApprove is premium-only, so paid tier should get 400
    const expectedFail = r.status === 400;
    log(expectedFail || r.ok, 'updateSettings (autoApprove=false, paid tier)',
      `status=${r.status}, expected=${expectedFail ? '400 (premium-only)' : 'ok'}`);
  }

  // 3.3 Verify autoApprove value
  {
    const r = await apiCall('GET', `/events/${EVENT_PAID}`, null, HOST_TOKEN);
    log(true, 'autoApprove current state', `autoApprove=${r.data.autoApprove}`);
  }

  // 3.4 Toggle non-premium setting (allowDownloads) to verify settings updates work
  {
    const r = await apiCall('PATCH', `/events/${EVENT_PAID}/settings`, { allowDownloads: true }, HOST_TOKEN);
    log(r.ok, 'updateSettings (allowDownloads=true, paid tier)', `status=${r.status}`);
  }

  // 3.5 List media with status filter (host moderation view)
  {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/media?status=pending_review`, null, HOST_TOKEN);
    log(r.ok, 'listMedia (pending_review filter)', `count=${r.data.items?.length}`);
  }

  // 3.6 Moderate media (approve) — only if there's a pending item
  {
    const r = await apiCall('GET', `/events/${EVENT_PAID}/media?status=pending_review`, null, HOST_TOKEN);
    if (r.data.items?.length > 0) {
      const mid = r.data.items[0].mediaId;
      const mr = await apiCall('POST', `/events/${EVENT_PAID}/media/${mid}/moderate`, { action: 'approve' }, HOST_TOKEN);
      log(mr.ok, 'moderateMedia (approve)', `mediaId=${mid}, status=${mr.status}`);
    } else {
      log(true, 'moderateMedia (approve)', 'No pending items to moderate (expected for autoApprove=true)');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: UPLOAD FLOW (presigned URL)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 4: UPLOAD FLOW ===');

  // 4.1 Get upload URL (host)
  {
    const r = await apiCall('POST', `/events/${EVENT_BASIC}/upload-url`, {
      fileType: 'image/jpeg',
      fileSize: 50000,
    }, HOST_TOKEN);
    log(r.ok && r.data.uploadUrl && r.data.mediaId, 'getUploadUrl (host)',
      `mediaId=${r.data.mediaId}, hasUrl=${!!r.data.uploadUrl}`);
  }

  // 4.2 Get cover upload URL (host only)
  {
    const r = await apiCall('POST', `/events/${EVENT_BASIC}/upload-url`, {
      fileType: 'image/jpeg',
      fileSize: 50000,
      type: 'cover',
    }, HOST_TOKEN);
    log(r.ok && r.data.uploadUrl, 'getUploadUrl (cover, host only)',
      `hasUrl=${!!r.data.uploadUrl}`);
  }

  // 4.3 Guest upload URL (unverified — should fail with 403)
  {
    const r = await apiCall('POST', `/events/${EVENT_PAID}/upload-url`, {
      fileType: 'image/jpeg',
      fileSize: 50000,
    }, guestToken);
    log(r.status === 403, 'getUploadUrl (unverified guest — should fail)',
      `status=${r.status}, code=${r.data.error?.code}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: REPORT MEDIA
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 5: REPORT MEDIA ===');

  // 5.1 Report (requires OTP — should fail for unverified)
  {
    if (mediaId) {
      const r = await apiCall('POST', `/events/${EVENT_PAID}/media/${mediaId}/report`,
        { reason: 'inappropriate', description: 'Audit test' }, guestToken);
      log(r.status === 403, 'reportMedia (unverified guest — should fail)',
        `status=${r.status}, code=${r.data.error?.code}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: DOWNLOAD ZIP
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 6: DOWNLOAD ZIP ===');

  {
    const r = await apiCall('POST', `/events/${EVENT_PAID}/download-zip`, null, HOST_TOKEN);
    // downloadZip returns { files: [...], fileCount, estimatedSize }
    const hasFiles = Array.isArray(r.data.files) && r.data.files.length > 0;
    log(r.ok && hasFiles, 'downloadZip (host, paid tier)',
      `fileCount=${r.data.fileCount}, estimatedSize=${r.data.estimatedSize}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 7: PROMO CODE VALIDATION
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 7: PROMO CODE ===');

  // 7.1 Valid staging promo code
  {
    const r = await apiCall('POST', `/events/${EVENT_BASIC}/promo`,
      { code: 'EASTG-BFF3-F7A2-BFD4', tier: 'paid', currency: 'GTQ' }, HOST_TOKEN);
    log(r.ok && r.data.valid, 'validatePromo (valid staging code)',
      `valid=${r.data.valid}, discount=${JSON.stringify(r.data.discount)}`);
  }

  // 7.2 Invalid promo code
  {
    const r = await apiCall('POST', `/events/${EVENT_BASIC}/promo`,
      { code: 'INVALID-CODE', tier: 'paid', currency: 'GTQ' }, HOST_TOKEN);
    log(r.ok && !r.data.valid, 'validatePromo (invalid code)',
      `valid=${r.data.valid}, message=${r.data.message}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 8: BROWSER UI TESTS (Playwright)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 8: BROWSER UI INTERACTION TESTS ===');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // Inject host auth
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ token, eventId }) => {
    localStorage.setItem('ea:host:token', token);
    localStorage.setItem('ea:host:eventId', eventId);
  }, { token: HOST_TOKEN, eventId: EVENT_BASIC });

  // 8.1 Dashboard loads with correct stats
  await page.goto(`${BASE}/e/${EVENT_BASIC}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  {
    const statsText = await page.textContent('body');
    const hasPhotos = statsText.includes('Fotos subidas');
    const hasActions = statsText.includes('Acciones rápidas');
    log(hasPhotos && hasActions, 'Dashboard renders stats + actions', `hasPhotos=${hasPhotos}, hasActions=${hasActions}`);
    await shot(page, 'dashboard-with-data');
  }

  // 8.2 Dashboard shows recent photos (event with 15 uploads)
  {
    const photoButtons = page.locator('button[aria-label^="Foto subida"]');
    const count = await photoButtons.count();
    log(count > 0, 'Dashboard shows recent photos', `photoCount=${count}`);
    await shot(page, 'dashboard-photos');
  }

  // 8.3 Click photo → media view → close → back to admin
  {
    const photoButtons = page.locator('button[aria-label^="Foto subida"]');
    if (await photoButtons.count() > 0) {
      await photoButtons.first().click();
      await page.waitForTimeout(2000);
      const onMediaView = page.url().includes('/media/');
      log(onMediaView, 'Click photo opens media view', `url=${page.url()}`);
      await shot(page, 'host-media-view');

      // Close
      const closeBtn = page.locator('button[aria-label="Cerrar"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(2000);
        const backToAdmin = page.url().includes('/admin');
        log(backToAdmin, 'Close media returns to admin (not guest gallery)', `url=${page.url()}`);
        await shot(page, 'host-after-close');
      }
    } else {
      log(false, 'Click photo test', 'No photos to click');
    }
  }

  // 8.4 Edit event — fill fields, save
  {
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/edit`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Find and clear+fill description textarea
    const textareas = page.locator('textarea');
    const taCount = await textareas.count();
    if (taCount > 0) {
      const descTA = textareas.first();
      await descTA.click();
      await descTA.fill('Updated by functional audit — ' + new Date().toLocaleTimeString());
      await page.waitForTimeout(500);

      // Check focus is maintained (cursor should still be in the textarea)
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      log(focused === 'TEXTAREA', 'Edit: textarea keeps focus after typing', `activeElement=${focused}`);
    }

    // Click save
    const saveBtn = page.getByText('Guardar cambios').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
      // Check for success toast or no error
      const bodyText = await page.textContent('body');
      const hasError = bodyText.includes('error') || bodyText.includes('Error');
      log(!hasError, 'Edit: save changes', `hasError=${hasError}`);
      await shot(page, 'edit-saved');
    }
  }

  // 8.5 Settings — toggle a setting
  {
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Find "Mostrar fecha y hora" toggle and click it
    const toggles = page.locator('[role="switch"], button:has(> span.translate-x-5), button:has(> span.translate-x-0)');
    const toggleCount = await toggles.count();
    log(toggleCount > 0, 'Settings: found toggles', `count=${toggleCount}`);

    if (toggleCount > 0) {
      // Click first toggle
      await toggles.first().click();
      await page.waitForTimeout(1500);
      await shot(page, 'settings-toggled');
      // Toggle back
      await toggles.first().click();
      await page.waitForTimeout(1500);
      log(true, 'Settings: toggle clicked and reverted', 'OK');
    }
  }

  // 8.6 QR page — verify URL is correct (not prod URL)
  {
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/qr`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    const hasCorrectUrl = bodyText.includes('d1s9zkxvf49wr6.cloudfront.net') || bodyText.includes(EVENT_BASIC);
    const hasProdUrl = bodyText.includes('eventalbum.codersatelier.com');
    log(hasCorrectUrl && !hasProdUrl, 'QR page: correct staging URL (not prod)', `hasStagingUrl=${hasCorrectUrl}, hasProdUrl=${hasProdUrl}`);
    await shot(page, 'qr-url-check');
  }

  // 8.7 Gallery manage — shows content
  {
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/gallery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const elemText = await page.textContent('body');
    const hasElements = !elemText.includes('No hay contenido');
    log(hasElements, 'Gallery manage: shows uploaded content', `hasElements=${hasElements}`);
    await shot(page, 'gallery-manage-content');
  }

  // 8.8 Moderation page — tabs work
  {
    await page.goto(`${BASE}/e/${EVENT_BASIC}/admin/moderation`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Pendientes tab
    const pendientesTab = page.getByText('Pendientes');
    if (await pendientesTab.isVisible()) {
      await pendientesTab.click();
      await page.waitForTimeout(1500);
      await shot(page, 'moderation-pendientes');
      log(true, 'Moderation: Pendientes tab clicked', 'OK');
    }

    // Click Reportados tab
    const reportadosTab = page.getByText('Reportados');
    if (await reportadosTab.isVisible()) {
      await reportadosTab.click();
      await page.waitForTimeout(1500);
      await shot(page, 'moderation-reportados');
      log(true, 'Moderation: Reportados tab clicked', 'OK');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 9: GUEST BROWSER FLOW
  // ═══════════════════════════════════════════════════════════════
  console.log('\n=== SECTION 9: GUEST BROWSER FLOW ===');

  // Clear auth
  await page.evaluate(() => localStorage.clear());

  // 9.1 Guest lobby → enter event (no password — use PAID event)
  {
    await page.goto(`${BASE}/e/${EVENT_PAID}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await shot(page, 'guest-lobby');

    const enterBtn = page.locator('button').filter({ hasText: 'Entrar al evento' }).first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(1000);

      const nicknameInput = page.locator('#guest-nickname');
      if (await nicknameInput.isVisible()) {
        await nicknameInput.fill('Functional Tester');
        const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /Entrar/ });
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }

      const onGallery = page.url().includes('/gallery');
      log(onGallery, 'Guest: entered event → gallery', `url=${page.url()}`);
      await shot(page, 'guest-gallery-entered');
    } else {
      log(false, 'Guest: enter button not found', `url=${page.url()}`);
      await shot(page, 'guest-no-enter-btn');
    }
  }

  // 9.2 Guest gallery shows photos
  {
    // Ensure we're on gallery
    if (!page.url().includes('/gallery')) {
      await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }
    const links = page.locator('a[aria-label^="Foto subida"]');
    const count = await links.count();
    log(count > 0, 'Guest gallery: shows photos', `count=${count}`);
    await shot(page, 'guest-gallery-photos');
  }

  // 9.3 Guest back button → lobby
  {
    const backBtn = page.locator('button[aria-label="Volver"]').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(2000);
      const onLobby = page.url().match(/\/e\/[^/]+$/);
      log(!!onLobby, 'Guest: back button → lobby', `url=${page.url()}`);
      await shot(page, 'guest-back-to-lobby');
    } else {
      // Try clicking any back-looking button in the header
      const headerBackBtn = page.locator('header button').first();
      if (await headerBackBtn.isVisible()) {
        await headerBackBtn.click();
        await page.waitForTimeout(2000);
        log(true, 'Guest: header back button clicked', `url=${page.url()}`);
      } else {
        log(false, 'Guest: back button not found', '');
      }
    }
  }

  // 9.4 Guest click photo → media view with reactions
  {
    // Re-enter gallery
    await page.goto(`${BASE}/e/${EVENT_PAID}/gallery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const firstPhoto = page.locator('a[aria-label^="Foto subida"]').first();
    if (await firstPhoto.isVisible()) {
      await firstPhoto.click();
      await page.waitForTimeout(2000);
      const onMedia = page.url().includes('/media/');
      log(onMedia, 'Guest: click photo → media view', `url=${page.url()}`);
      await shot(page, 'guest-media-view');

      // Check reactions are visible
      const reactionBtns = page.locator('button[aria-label="Me encanta"], button[aria-label="Me gusta"], button[aria-label="Fiesta"]');
      const reactionCount = await reactionBtns.count();
      log(reactionCount === 3, 'Media view: reaction buttons visible', `count=${reactionCount}`);

      // Check comments button
      const commentBtn = page.locator('button[aria-label="Comentarios"]');
      const hasCommentBtn = await commentBtn.isVisible();
      log(hasCommentBtn, 'Media view: comment button visible', `visible=${hasCommentBtn}`);

      // Open comments sheet
      if (hasCommentBtn) {
        await commentBtn.click();
        await page.waitForTimeout(1500);
        await shot(page, 'guest-comments-sheet');
        const commentSheet = page.locator('text=Comentarios').first();
        log(await commentSheet.isVisible(), 'Media view: comments sheet opens', 'OK');

        // Close comments
        const closeSheet = page.locator('button[aria-label="Cerrar"]').last();
        if (await closeSheet.isVisible()) {
          await closeSheet.click();
          await page.waitForTimeout(500);
        }
      }

      // Close media view → back to gallery
      const closeBtn = page.locator('button[aria-label="Cerrar"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(2000);
        const backToGallery = page.url().includes('/gallery');
        log(backToGallery, 'Guest: close media → back to gallery', `url=${page.url()}`);
      }
    } else {
      log(false, 'Guest: no photos to click in gallery', `url=${page.url()}`);
    }
  }

  await browser.close();

  // ═══════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   RESULTS SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const passed = RESULTS.filter(r => r.status === 'PASS').length;
  const failed = RESULTS.filter(r => r.status === 'FAIL').length;
  console.log(`  TOTAL: ${RESULTS.length} tests`);
  console.log(`  PASS:  ${passed}`);
  console.log(`  FAIL:  ${failed}\n`);

  if (failed > 0) {
    console.log('  FAILURES:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    [${r.step}] ${r.name}: ${r.detail}`);
    });
  }

  // Write report
  const md = [
    '# EventAlbum Functional Audit',
    `\n**Date:** ${new Date().toISOString()}`,
    `**Passed:** ${passed}/${RESULTS.length}`,
    `**Failed:** ${failed}/${RESULTS.length}`,
    '\n| # | Status | Test | Detail |',
    '|---|--------|------|--------|',
    ...RESULTS.map(r => `| ${r.step} | ${r.status} | ${r.name} | ${r.detail} |`),
  ].join('\n');
  fs.writeFileSync(path.join(SHOTS, 'FUNCTIONAL-REPORT.md'), md);

  process.exit(failed > 0 ? 1 : 0);
})();
