import { scanItems, queryItems, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { sendEventSummaryEmail } from '/opt/nodejs/email.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const RETENTION_DAYS = { basic: 15, paid: 180, premium: 365 };

/**
 * eventSummary — EventBridge scheduled job (daily)
 *
 * Finds events that ended in the last 24 hours (endDate < now, status=active)
 * and sends a recap email to the host with stats and download link.
 */
export async function handler(event) {
  try {
    logger.info('eventSummary triggered', {
      source: event.source || 'unknown',
      time: event.time || new Date().toISOString(),
    });

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // ── Find events that ended recently ────────────────────────────────
    const events = await scanItems({
      filterExpr: 'SK = :meta AND attribute_exists(endDate) AND endDate <= :now AND endDate >= :yesterday AND attribute_not_exists(summarySent) AND attribute_exists(hostEmail)',
      exprValues: {
        ':meta': 'METADATA',
        ':now': now.toISOString(),
        ':yesterday': yesterday.toISOString(),
      },
    });

    logger.info(`Found ${events.length} events that ended recently`);

    let sent = 0;

    for (const evt of events) {
      try {
        // ── Count media items ────────────────────────────────────────
        const { items: allMedia } = await queryItems(
          `EVENT#${evt.eventId}`,
          'MEDIA#',
          { filterExpr: '#status = :visible', exprValues: { ':visible': 'visible' }, exprNames: { '#status': 'status' } },
        );

        const totalPhotos = allMedia.filter((m) => (m.fileType || '').startsWith('image')).length;
        const totalVideos = allMedia.filter((m) => (m.fileType || '').startsWith('video')).length;
        const totalGuests = new Set(allMedia.map((m) => m.sessionId).filter(Boolean)).size;

        const storageDays = RETENTION_DAYS[evt.tier] || 15;

        // ── Send summary email ───────────────────────────────────────
        await sendEventSummaryEmail(evt.hostEmail, {
          eventId: evt.eventId,
          title: evt.title || evt.eventId,
          totalPhotos,
          totalVideos,
          totalGuests,
          downloadUrl: (evt.tier === 'paid' || evt.tier === 'premium')
            ? `${process.env.FRONTEND_URL || ''}/e/${evt.eventId}/admin/download`
            : null,
          storageDays,
        });

        // ── Mark as summarySent ──────────────────────────────────────
        await updateItem(
          `EVENT#${evt.eventId}`,
          'METADATA',
          'SET summarySent = :yes, #status = :ended, updatedAt = :now',
          { ':yes': true, ':ended': 'ended', ':now': now.toISOString() },
          { '#status': 'status' },
        );

        sent++;
        logger.info('Event summary sent', {
          eventId: evt.eventId,
          totalPhotos,
          totalVideos,
          totalGuests,
        });
      } catch (evtErr) {
        logger.error('Failed to send event summary', {
          eventId: evt.eventId,
          error: evtErr.message,
        });
      }
    }

    logger.info('eventSummary completed', { sent, total: events.length });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'eventSummary completed', sent }),
    };
  } catch (err) {
    logger.error('eventSummary error', { error: err.message, stack: err.stack });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'eventSummary failed', error: err.message }),
    };
  }
}
