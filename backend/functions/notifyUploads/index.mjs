import { scanItems, queryItems, updateItem } from '/opt/nodejs/dynamodb.mjs';
import { sendUploadNotificationEmail } from '/opt/nodejs/email.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

const NOTIFY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * notifyUploads — EventBridge scheduled job (every 30 min)
 *
 * Scans for active events with emailNotifications=true that have
 * new uploads since lastNotifiedAt, then sends batch email to hosts.
 */
export async function handler(event) {
  try {
    logger.info('notifyUploads triggered', {
      source: event.source || 'unknown',
      time: event.time || new Date().toISOString(),
    });

    // ── Find active events with notifications enabled ──────────────────
    const events = await scanItems({
      filterExpr: 'SK = :meta AND #status = :active AND emailNotifications = :yes AND attribute_exists(hostEmail)',
      exprValues: {
        ':meta': 'METADATA',
        ':active': 'active',
        ':yes': true,
      },
      exprNames: { '#status': 'status' },
    });

    logger.info(`Found ${events.length} active events with notifications`);

    let notified = 0;

    for (const evt of events) {
      try {
        const lastNotified = evt.lastNotifiedAt
          ? new Date(evt.lastNotifiedAt).getTime()
          : 0;
        const now = Date.now();

        // Skip if we notified recently (within interval)
        if (lastNotified && now - lastNotified < NOTIFY_INTERVAL_MS) {
          continue;
        }

        // ── Count new uploads since lastNotifiedAt ────────────────────
        const sinceISO = evt.lastNotifiedAt || evt.createdAt || new Date(0).toISOString();
        const skPrefix = `MEDIA#${sinceISO}`;

        const { items: newMedia } = await queryItems(
          `EVENT#${evt.eventId}`,
          'MEDIA#',
          {
            filterExpr: 'SK > :since AND #status = :visible',
            exprValues: { ':since': skPrefix, ':visible': 'visible' },
            exprNames: { '#status': 'status' },
          },
        );

        if (newMedia.length === 0) continue;

        // ── Gather stats ─────────────────────────────────────────────
        const newPhotos = newMedia.filter((m) => (m.fileType || '').startsWith('image')).length;
        const newVideos = newMedia.filter((m) => (m.fileType || '').startsWith('video')).length;
        const uniqueUploaders = new Set(newMedia.map((m) => m.sessionId).filter(Boolean)).size;

        // ── Send notification email ──────────────────────────────────
        await sendUploadNotificationEmail(evt.hostEmail, {
          eventId: evt.eventId,
          title: evt.title || evt.eventId,
          newCount: newMedia.length,
          totalPhotos: evt.uploadCount || 0,
          totalGuests: uniqueUploaders || 0,
          totalVideos: newVideos,
        });

        // ── Update lastNotifiedAt ────────────────────────────────────
        await updateItem(
          `EVENT#${evt.eventId}`,
          'METADATA',
          'SET lastNotifiedAt = :now',
          { ':now': new Date().toISOString() },
        );

        notified++;
        logger.info('Upload notification sent', {
          eventId: evt.eventId,
          newUploads: newMedia.length,
        });
      } catch (evtErr) {
        logger.error('Failed to process event for notification', {
          eventId: evt.eventId,
          error: evtErr.message,
        });
      }
    }

    logger.info('notifyUploads completed', { notified, total: events.length });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'notifyUploads completed', notified }),
    };
  } catch (err) {
    logger.error('notifyUploads error', { error: err.message, stack: err.stack });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'notifyUploads failed', error: err.message }),
    };
  }
}
