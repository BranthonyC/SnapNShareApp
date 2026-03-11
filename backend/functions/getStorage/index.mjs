import { getItem, queryItems } from '/opt/nodejs/dynamodb.mjs';
import { ok, validationError, forbidden, unauthorized, notFound, serverError } from '/opt/nodejs/response.mjs';
import { authenticateRequest } from '/opt/nodejs/auth.mjs';
import { getTierConfig } from '/opt/nodejs/config.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

// Fallback retention days if not in SSM
const RETENTION_DAYS = {
  basic: 15,
  paid: 180,
  premium: 365,
};

export async function handler(event) {
  try {
    // ── Auth: host only ───────────────────────────────────────────────
    const auth = await authenticateRequest(event);
    if (!auth) return unauthorized();
    if (auth.role !== 'host') return forbidden('FORBIDDEN', 'Host access required');

    // ── Path param ────────────────────────────────────────────────────
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return validationError('eventId path parameter is required');
    }

    // ── Cross-check JWT eventId against path eventId ──────────────────
    if (auth.eventIds && !auth.eventIds.includes(eventId)) {
      if (auth.eventId && auth.eventId !== eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
      if (!auth.eventId) {
        return forbidden('FORBIDDEN', 'You do not have access to this event');
      }
    }

    // ── Get event ─────────────────────────────────────────────────────
    const ev = await getItem(`EVENT#${eventId}`, 'METADATA');
    if (!ev || ev.status === 'deleted') {
      return notFound('EVENT_NOT_FOUND', 'Event not found');
    }

    const tier = ev.tier || 'basic';

    // ── Get tier config for retention ─────────────────────────────────
    const tierConfig = await getTierConfig(tier);
    const retentionDays = tierConfig?.storageDays ?? RETENTION_DAYS[tier] ?? 15;

    // ── Query all MEDIA items and aggregate ───────────────────────────
    const byType = {};
    let totalBytes = 0;

    let mediaCursor = null;
    do {
      const result = await queryItems(
        `EVENT#${eventId}`,
        'MEDIA#',
        { limit: 100, cursor: mediaCursor },
      );

      for (const media of result.items) {
        const fileSize = media.fileSize || 0;
        const typeCategory = media.fileType ? media.fileType.split('/')[0] : 'image';

        totalBytes += fileSize;

        if (!byType[typeCategory]) {
          byType[typeCategory] = { count: 0, bytes: 0 };
        }
        byType[typeCategory].count += 1;
        byType[typeCategory].bytes += fileSize;
      }

      mediaCursor = result.nextCursor;
    } while (mediaCursor);

    // ── Determine storage class ───────────────────────────────────────
    let storageClass = 'STANDARD';
    if (tier === 'premium' && retentionDays > 365) {
      storageClass = 'STANDARD'; // Will transition to Glacier via lifecycle policy
    }

    logger.info('Storage info retrieved', {
      eventId,
      tier,
      totalBytes,
      fileCount: Object.values(byType).reduce((sum, t) => sum + t.count, 0),
    });

    return ok({
      totalBytes,
      limitBytes: null,
      byType,
      storageClass,
      retentionDays,
      expiresAt: ev.expiresAt || null,
    });
  } catch (err) {
    logger.error('getStorage error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
