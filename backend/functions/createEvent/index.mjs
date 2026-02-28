import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';

import { getItem, putItem, updateItem } from '../../shared/dynamodb.mjs';
import { created, validationError, serverError, error } from '../../shared/response.mjs';
import { signJwt, hashPassword, generateSessionId } from '../../shared/auth.mjs';
import { getTierConfig, getFeatureFlag } from '../../shared/config.mjs';
import { sendEventCreatedEmail } from '../../shared/email.mjs';
import { validateCreateEvent, parseBody, sanitizeHtml } from '../../shared/validation.mjs';
import { logger } from '../../shared/logger.mjs';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://eventalbum.codersatelier.com';

// Storage retention in days by tier (used to compute expiresAtTTL on the EVENT record itself)
const RETENTION_DAYS = {
  basic: 15,
  paid: 180,
  premium: 365,
};

// Session TTL: host session lives 30 days
const HOST_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function handler(event) {
  try {
    // ── Parse & validate body ──────────────────────────────────────────────
    const body = parseBody(event);
    const validationErrors = validateCreateEvent(body);
    if (validationErrors.length > 0) {
      return validationError('Invalid request body', { fields: validationErrors });
    }

    const {
      title,
      description = '',
      hostEmail,
      hostName,
      guestPassword,
      hostPassword,      // optional: host sets their own admin password
      startDate,
      endDate,
      tier = 'basic',
    } = body;

    // ── Feature flag: maintenance mode ─────────────────────────────────────
    const maintenance = await getFeatureFlag('maintenance-mode');
    if (maintenance) {
      return error('MAINTENANCE', 'The platform is temporarily under maintenance. Please try again later.', 503);
    }

    // ── Tier config from SSM ───────────────────────────────────────────────
    const tierConfig = await getTierConfig(tier);
    if (!tierConfig) {
      return validationError('Unknown tier', { tier });
    }

    const {
      uploadLimit,
      maxFileSizeBytes,
      mediaTypes,
      storageDays,
      requireOtp,
    } = tierConfig;

    // ── Generate IDs ───────────────────────────────────────────────────────
    const eventId = `evt_${nanoid(12)}`;
    const now = new Date().toISOString();
    const nowUnix = Math.floor(Date.now() / 1000);

    // Storage expiry: use SSM value if present, fall back to hardcoded map
    const retentionDays = storageDays ?? RETENTION_DAYS[tier] ?? 15;
    const expiresAtDate = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    const expiresAt = expiresAtDate.toISOString();
    const expiresAtTTL = Math.floor(expiresAtDate.getTime() / 1000);

    // ── Hash host password (if provided) ──────────────────────────────────
    const hostPasswordHash = hostPassword ? hashPassword(hostPassword) : null;

    // ── IP hash for audit (optional header from API GW) ───────────────────
    const ip = event.requestContext?.http?.sourceIp || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    // ── Build EVENT item ───────────────────────────────────────────────────
    const eventItem = {
      // Keys
      PK: `EVENT#${eventId}`,
      SK: 'METADATA',
      GSI1PK: `HOST#${hostEmail.toLowerCase()}`,
      GSI1SK: `EVENT#${now}`,

      // Core fields
      eventId,
      title: sanitizeHtml(title),
      description: sanitizeHtml(description),
      hostEmail: hostEmail.toLowerCase(),
      hostName: sanitizeHtml(hostName),
      guestPassword,            // stored plaintext — shared via QR
      hostPasswordHash: hostPasswordHash ?? undefined,

      // Media / cover
      coverUrl: null,
      footerText: null,
      welcomeMessage: null,

      // Dates
      startDate,
      endDate,
      createdAt: now,
      expiresAt,
      expiresAtTTL,

      // Tier / limits
      tier,
      status: 'active',
      uploadCount: 0,
      uploadLimit,
      maxFileSizeBytes,
      mediaTypes,

      // Settings (defaults)
      colorTheme: 'green',
      showDateTime: true,
      galleryPrivacy: true,
      allowDownloads: tier !== 'basic',
      allowVideo: tier !== 'basic',
      emailNotifications: true,
      autoApprove: tier === 'premium',

      // Payment
      paymentStatus: tier === 'basic' ? 'free' : 'unpaid',
      checkoutId: null,

      // Analytics
      totalScans: 0,
      uniqueVisitors: 0,
      lastScannedAt: null,
      lastNotifiedAt: null,
    };

    // ── Persist event ──────────────────────────────────────────────────────
    await putItem(eventItem);

    logger.info('Event created', { eventId, tier, hostEmail: hostEmail.toLowerCase() });

    // ── Create host session ────────────────────────────────────────────────
    const sessionId = generateSessionId();
    const sessionExpiresAt = new Date(Date.now() + HOST_SESSION_TTL_SECONDS * 1000).toISOString();
    const sessionExpiresAtTTL = nowUnix + HOST_SESSION_TTL_SECONDS;

    const sessionItem = {
      PK: `EVENT#${eventId}`,
      SK: `SESSION#${sessionId}`,
      sessionId,
      eventId,
      role: 'host',
      nickname: sanitizeHtml(hostName),
      ipHash,
      verified: true,          // host is always verified
      verifiedVia: null,
      createdAt: now,
      expiresAt: sessionExpiresAt,
      expiresAtTTL: sessionExpiresAtTTL,
      uploadCount: 0,
    };

    await putItem(sessionItem);

    // ── Sign host JWT ──────────────────────────────────────────────────────
    const token = await signJwt(
      { sub: sessionId, eventId, role: 'host', verified: true },
      HOST_SESSION_TTL_SECONDS,
    );

    // ── Build URLs ─────────────────────────────────────────────────────────
    const qrUrl = `${FRONTEND_URL}/e/${eventId}`;
    const adminUrl = `${FRONTEND_URL}/e/${eventId}/admin`;

    // ── Send confirmation email (fire-and-forget — do not block response) ──
    sendEventCreatedEmail(hostEmail, { eventId, title, qrUrl, tier }).catch((err) => {
      logger.warn('Failed to send event creation email', { eventId, error: err.message });
    });

    // ── Response ───────────────────────────────────────────────────────────
    return created({
      eventId,
      qrUrl,
      adminUrl,
      tier,
      uploadLimit,
      expiresAt,
      token,
    });
  } catch (err) {
    logger.error('createEvent error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
