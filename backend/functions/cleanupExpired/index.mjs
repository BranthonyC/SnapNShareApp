import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

import { logger } from '../../shared/logger.mjs';

const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;

/**
 * Delete all S3 objects under a given prefix.
 * Uses ListObjectsV2 + DeleteObjects for batch efficiency.
 */
async function deleteS3Prefix(prefix) {
  let deletedCount = 0;
  let continuationToken = undefined;

  do {
    const listResponse = await s3.send(new ListObjectsV2Command({
      Bucket: MEDIA_BUCKET,
      Prefix: prefix,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }));

    const objects = listResponse.Contents || [];
    if (objects.length === 0) break;

    // Delete objects in batches of 1000 (S3 max per request)
    await s3.send(new DeleteObjectsCommand({
      Bucket: MEDIA_BUCKET,
      Delete: {
        Objects: objects.map((obj) => ({ Key: obj.Key })),
        Quiet: true,
      },
    }));

    deletedCount += objects.length;
    continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
  } while (continuationToken);

  return deletedCount;
}

/**
 * cleanupExpired — EventBridge scheduled job (daily)
 *
 * Triggered by CloudWatch Events / EventBridge schedule (not API Gateway).
 * DynamoDB TTL handles record deletion automatically. This function handles
 * S3 cleanup for expired events by deleting all objects under events/${eventId}/.
 *
 * Implementation: queries for events with status='deleted' or expired TTL,
 * then lists and deletes all S3 objects under their prefix.
 */
export async function handler(event) {
  try {
    logger.info('cleanupExpired triggered', {
      source: event.source || 'unknown',
      detailType: event['detail-type'] || 'unknown',
      time: event.time || new Date().toISOString(),
    });

    // Import dynamodb module for querying expired events
    // Using dynamic import since this is a scheduled function
    const { queryItems } = await import('../../shared/dynamodb.mjs');

    // Strategy: DynamoDB TTL deletes records, but we need to find events
    // that are marked as 'deleted' or whose expiresAtTTL has passed.
    // We'll scan for events with status='deleted' using a filter.
    //
    // Note: A full-table scan is expensive but acceptable for a daily cleanup
    // job running outside of request path. In production, consider using
    // a GSI on status or a DynamoDB Stream to trigger cleanup.

    const now = Math.floor(Date.now() / 1000);
    let cleanedEvents = 0;
    let totalObjectsDeleted = 0;

    // Query approach: We need to find expired events. Since we don't have
    // a GSI on status, we check events by looking at their S3 prefixes.
    // For now, we look for events that have status='deleted' by doing
    // a limited scan approach.

    // First, try to find events marked as deleted that still have S3 objects
    // We'll use a different approach: list S3 prefixes under events/ and
    // cross-reference with DynamoDB to see if the event still exists.

    // Simpler approach for MVP: List top-level prefixes in S3 bucket under events/
    let s3ContinuationToken = undefined;
    const processedPrefixes = new Set();

    do {
      const listResponse = await s3.send(new ListObjectsV2Command({
        Bucket: MEDIA_BUCKET,
        Prefix: 'events/',
        Delimiter: '/',
        MaxKeys: 100,
        ContinuationToken: s3ContinuationToken,
      }));

      const prefixes = listResponse.CommonPrefixes || [];

      for (const prefix of prefixes) {
        // Extract eventId from prefix: events/evt_xxx/ -> evt_xxx
        const prefixStr = prefix.Prefix;
        const match = prefixStr.match(/^events\/(evt_[^/]+)\/$/);
        if (!match) continue;

        const eventId = match[1];
        if (processedPrefixes.has(eventId)) continue;
        processedPrefixes.add(eventId);

        // Check if event still exists in DynamoDB
        const { getItem } = await import('../../shared/dynamodb.mjs');
        const eventRecord = await getItem(`EVENT#${eventId}`, 'METADATA');

        // Delete S3 objects if event is deleted, or if event record doesn't exist
        // (TTL already removed it), or if event has expired
        const shouldCleanup =
          !eventRecord ||
          eventRecord.status === 'deleted' ||
          (eventRecord.expiresAtTTL && eventRecord.expiresAtTTL < now);

        if (shouldCleanup) {
          logger.info('Cleaning up expired event S3 objects', {
            eventId,
            reason: !eventRecord ? 'record_missing' : eventRecord.status === 'deleted' ? 'status_deleted' : 'ttl_expired',
          });

          const deleted = await deleteS3Prefix(prefixStr);
          totalObjectsDeleted += deleted;
          cleanedEvents++;

          logger.info('Event S3 cleanup completed', { eventId, objectsDeleted: deleted });
        }
      }

      s3ContinuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (s3ContinuationToken);

    logger.info('cleanupExpired completed', {
      cleanedEvents,
      totalObjectsDeleted,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'cleanupExpired executed successfully',
        cleanedEvents,
        totalObjectsDeleted,
      }),
    };
  } catch (err) {
    logger.error('cleanupExpired error', { error: err.message, stack: err.stack });

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'cleanupExpired failed', error: err.message }),
    };
  }
}
