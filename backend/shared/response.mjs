const CORS_ORIGIN = process.env.STAGE === 'prod'
  ? 'https://eventalbum.codersatelier.com'
  : '*';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Confirm-Delete,X-Request-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

export function ok(body, statusCode = 200) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

export function created(body) {
  return ok(body, 201);
}

export function error(code, message, statusCode = 400, details = {}) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      error: { code, message, details },
    }),
  };
}

export function unauthorized(message = 'Missing or invalid token') {
  return error('UNAUTHORIZED', message, 401);
}

export function forbidden(code = 'FORBIDDEN', message = 'Insufficient permissions') {
  return error(code, message, 403);
}

export function notFound(code = 'EVENT_NOT_FOUND', message = 'Resource not found') {
  return error(code, message, 404);
}

export function rateLimited(message = 'Too many requests') {
  return error('RATE_LIMITED', message, 429);
}

export function validationError(message, details = {}) {
  return error('VALIDATION_ERROR', message, 400, details);
}

export function serverError(message = 'Internal server error') {
  return error('INTERNAL_ERROR', message, 500);
}
