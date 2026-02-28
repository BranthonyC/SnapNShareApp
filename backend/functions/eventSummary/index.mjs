import { logger } from '../../shared/logger.mjs';

/**
 * eventSummary — EventBridge scheduled job (daily)
 *
 * Triggered by CloudWatch Events / EventBridge schedule (not API Gateway).
 * Finds events that ended in the last 24 hours, compiles a summary
 * (total uploads, guests, reactions), and sends a summary email to the host.
 *
 * For MVP: logs the invocation. Full implementation will be added later.
 */
export async function handler(event) {
  try {
    logger.info('eventSummary triggered', {
      source: event.source || 'unknown',
      detailType: event['detail-type'] || 'unknown',
      time: event.time || new Date().toISOString(),
    });

    // TODO: Full implementation:
    // 1. Scan/query for events where endDate is within the last 24 hours
    // 2. For each ended event:
    //    a. Count total MEDIA items (uploadCount from EVENT record)
    //    b. Count unique sessions (guest count)
    //    c. Count total reactions across all media
    //    d. Compile summary data
    //    e. Send summary email to hostEmail via SES
    // 3. Mark event as summary_sent to avoid duplicate emails
    //
    // For now, this is a stub that logs the trigger for observability.

    logger.info('eventSummary completed (stub)');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'eventSummary executed successfully' }),
    };
  } catch (err) {
    logger.error('eventSummary error', { error: err.message, stack: err.stack });

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'eventSummary failed', error: err.message }),
    };
  }
}
