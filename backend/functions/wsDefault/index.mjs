import { logger } from '/opt/nodejs/logger.mjs';

export async function handler(event) {
  // Default route — handles client keep-alive pings
  const connectionId = event.requestContext.connectionId;
  logger.debug('WebSocket default message', { connectionId });
  return { statusCode: 200, body: 'ok' };
}
