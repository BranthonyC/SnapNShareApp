import { type Page } from '@playwright/test';

// ── Environment (defaults to production) ────────────────────────────────
export const API = process.env.API_URL || 'https://api.snapnshare.app';
export const BASE = process.env.BASE_URL || 'https://snapnshare.app';

// ── Test events (production) ────────────────────────────────────────────
export const EVENT_BASIC = process.env.EVENT_BASIC || 'evt_Uk5W1MCOMdRt';   // basic tier, guestPassword: test1234
export const EVENT_PAID  = process.env.EVENT_PAID  || 'evt_Pc90Obkk-ewY';   // paid tier, no password, 6 uploads

// ── API helper ──────────────────────────────────────────────────────────
export async function apiCall(
  method: string,
  path: string,
  body?: object | null,
  token?: string | null,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

// ── Host tokens (one per event, since JWT is scoped to eventId) ─────────
export function getHostToken(eventId?: string): string {
  // If eventId matches PAID event, use HOST_TOKEN_PAID; otherwise HOST_TOKEN (basic)
  if (eventId === EVENT_PAID) {
    const token = process.env.HOST_TOKEN_PAID;
    if (!token) throw new Error('HOST_TOKEN_PAID env var is required');
    return token;
  }
  const token = process.env.HOST_TOKEN;
  if (!token) throw new Error('HOST_TOKEN env var is required');
  return token;
}

// ── Inject host auth into browser localStorage ─────────────────────────
export async function injectHostAuth(page: Page, eventId: string) {
  const token = getHostToken(eventId);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ t, eid }) => {
    localStorage.setItem('ea:host:token', t);
    localStorage.setItem('ea:host:eventId', eid);
  }, { t: token, eid: eventId });
}

// ── Create a guest session via API and inject into browser ──────────────
export async function injectGuestAuth(
  page: Page,
  eventId: string,
  nickname = 'E2E Tester',
  { verified = false }: { verified?: boolean } = {},
) {
  const r = await apiCall('POST', `/events/${eventId}/auth`, { nickname });
  if (!r.ok) throw new Error(`Failed to auth guest: ${JSON.stringify(r.data)}`);
  const token = r.data.token;

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ t, eid, nick, v }) => {
    localStorage.setItem(`ea:${eid}:token`, t);
    localStorage.setItem(`ea:${eid}:nickname`, nick);
    localStorage.setItem(`ea:${eid}:verified`, String(v));
  }, { t: token, eid: eventId, nick: nickname, v: verified });
  return token;
}

// ── Wait for network to settle ──────────────────────────────────────────
export async function waitForSettled(page: Page, ms = 2000) {
  await page.waitForTimeout(ms);
}
