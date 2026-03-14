import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { queryItems, deleteItem } from './dynamodb.mjs';
import { logger } from './logger.mjs';

let wsClient;

function getWsClient() {
  if (!wsClient) {
    const endpoint = process.env.WS_ENDPOINT;
    if (!endpoint) return null;
    wsClient = new ApiGatewayManagementApiClient({ endpoint });
  }
  return wsClient;
}

/**
 * Broadcast a message to all WebSocket connections for a given eventId.
 * Automatically cleans up stale (410 Gone) connections.
 *
 * @param {string} eventId - The event to broadcast to
 * @param {object} message - The message payload to send
 * @param {string} [excludeConnectionId] - Optional connectionId to skip (e.g., the sender)
 */
export async function broadcast(eventId, message, excludeConnectionId) {
  const client = getWsClient();
  if (!client) return; // WebSocket not configured

  const { items } = await queryItems(`WS#EVENT#${eventId}`, 'CONN#');
  if (items.length === 0) return;

  const payload = JSON.stringify(message);

  await Promise.allSettled(
    items
      .filter((conn) => conn.connectionId !== excludeConnectionId)
      .map(async (conn) => {
        try {
          await client.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: payload,
          }));
        } catch (err) {
          const httpStatus = err.statusCode || err.$metadata?.httpStatusCode;
          if (httpStatus === 410) {
            // Stale connection — clean up
            try {
              await deleteItem(`WS#EVENT#${eventId}`, `CONN#${conn.connectionId}`);
              await deleteItem(`WS#CONN#${conn.connectionId}`, 'META');
            } catch {
              // Best effort
            }
          } else {
            logger.warn('Failed to send WebSocket message', {
              connectionId: conn.connectionId,
              error: err.message,
            });
          }
        }
      }),
  );
}
