import { createHmac, timingSafeEqual, randomBytes, randomInt } from 'node:crypto';
import { getSecret } from './config.mjs';

// JWT implementation (HS256) — no external dependencies
export async function signJwt(payload, expiresInSeconds = 86400) {
  const secret = await getSecret('jwt-secret');
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(claims));
  const signature = hmacSign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyJwt(token) {
  if (!token) return null;
  const secret = await getSecret('jwt-secret');
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = hmacSign(`${encodedHeader}.${encodedPayload}`, secret);

  const sigBuf = Buffer.from(signature, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function extractToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function authenticateRequest(event) {
  const token = extractToken(event);
  return verifyJwt(token);
}

// Password hashing using HMAC-SHA256 (no bcrypt layer needed for guest passwords)
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, expectedHash] = stored.split(':');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  return hashBuf.length === expectedBuf.length && timingSafeEqual(hashBuf, expectedBuf);
}

// OTP generation
export function generateOtp() {
  return String(randomInt(100000, 999999));
}

export function generateSessionId() {
  return `ses_${randomBytes(12).toString('base64url')}`;
}

// Internal helpers
function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function hmacSign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}
