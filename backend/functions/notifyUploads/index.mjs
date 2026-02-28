import { logger } from '../../shared/logger.mjs';

/**
 * notifyUploads — EventBridge scheduled job
 *
 * Triggered by CloudWatch Events / EventBridge schedule (not API Gateway).
 * Queries active events with new uploads since lastNotifiedAt and sends
 * batch email notifications to hosts.
 *
 * For MVP: logs the invocation. Full scan + email logic will be tuned later.
 */
export async function handler(event) {
  try {
    logger.info('notifyUploads triggered', {
      source: event.source || 'unknown',
      detailType: event['detail-type'] || 'unknown',
      time: event.time || new Date().toISOString(),
    });

    // TODO: Full implementation:
    // 1. Scan for active events with emailNotifications=true
    // 2. For each event, check if new uploads exist since lastNotifiedAt
    // 3. If uploads found and lastNotifiedAt > 30 min ago:
    //    a. Compile upload summary (count, thumbnails)
    //    b. Send notification email to host via SES
    //    c. Update lastNotifiedAt on EVENT record
    //
    // For now, this is a stub that logs the trigger for observability.

    logger.info('notifyUploads completed (stub)');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'notifyUploads executed successfully' }),
    };
  } catch (err) {
    logger.error('notifyUploads error', { error: err.message, stack: err.stack });

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'notifyUploads failed', error: err.message }),
    };
  }
}
