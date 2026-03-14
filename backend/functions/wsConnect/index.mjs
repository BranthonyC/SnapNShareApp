import { verifyJwt } from '/opt/nodejs/auth.mjs';
import { putItem } from '/opt/nodejs/dynamodb.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

export async function handler(event) {
  const token = event.queryStringParameters?.token;
  const queryEventId = event.queryStringParameters?.eventId;

  if (!token) {
    logger.warn('WebSocket connect rejected: no token');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const claims = await verifyJwt(token);
  if (!claims) {
    logger.warn('WebSocket connect rejected: invalid token');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Determine eventId from JWT claims — this is the ONLY source of truth
  // for event isolation. Guests have `eventId`, hosts have `eventIds[]`.
  let eventId;
  if (claims.eventId) {
    // Guest token — eventId is baked into the JWT
    eventId = claims.eventId;
  } else if (claims.eventIds && queryEventId && claims.eventIds.includes(queryEventId)) {
    // Host token — eventId from query param, validated against JWT's eventIds array
    eventId = queryEventId;
  } else {
    logger.warn('WebSocket connect rejected: no valid eventId in token');
    return { statusCode: 403, body: 'Forbidden' };
  }

  const connectionId = event.requestContext.connectionId;
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 86400; // 24h TTL safety net

  // Store event → connection mapping (for broadcast queries)
  await putItem({
    PK: `WS#EVENT#${eventId}`,
    SK: `CONN#${connectionId}`,
    connectionId,
    eventId,
    connectedAt: now,
    expiresAtTTL: ttl,
  });

  // Store reverse lookup (for disconnect cleanup)
  await putItem({
    PK: `WS#CONN#${connectionId}`,
    SK: 'META',
    connectionId,
    eventId,
    connectedAt: now,
    expiresAtTTL: ttl,
  });

  logger.info('WebSocket connected', { connectionId, eventId, role: claims.role });

  return { statusCode: 200, body: 'Connected' };
}
