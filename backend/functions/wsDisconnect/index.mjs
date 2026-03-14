import { getItem, deleteItem } from '/opt/nodejs/dynamodb.mjs';
import { logger } from '/opt/nodejs/logger.mjs';

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;

  try {
    // Reverse lookup to find eventId
    const meta = await getItem(`WS#CONN#${connectionId}`, 'META');

    if (meta) {
      await Promise.all([
        deleteItem(`WS#EVENT#${meta.eventId}`, `CONN#${connectionId}`),
        deleteItem(`WS#CONN#${connectionId}`, 'META'),
      ]);
      logger.info('WebSocket disconnected', { connectionId, eventId: meta.eventId });
    } else {
      logger.warn('WebSocket disconnect: no meta record found', { connectionId });
    }
  } catch (err) {
    logger.error('WebSocket disconnect error', { connectionId, error: err.message });
  }

  return { statusCode: 200, body: 'Disconnected' };
}
