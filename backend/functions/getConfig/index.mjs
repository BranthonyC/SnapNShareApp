import { getAllTierConfigs } from '../../shared/config.mjs';
import { serverError } from '../../shared/response.mjs';
import { logger } from '../../shared/logger.mjs';

// Pricing in cents (CORRECTED values)
const PRICING = {
  basic: { GTQ: 800, USD: 100 },
  paid: { GTQ: 11600, USD: 1500 },
  premium: { GTQ: 23200, USD: 3000 },
};

const CORS_ORIGIN = process.env.STAGE === 'prod'
  ? 'https://eventalbum.codersatelier.com'
  : '*';

export async function handler(event) {
  try {
    // ── Load all tier configs from SSM ────────────────────────────────
    const tiers = await getAllTierConfigs();

    // ── Build response ────────────────────────────────────────────────
    const config = {
      tiers: {
        basic: {
          name: 'Basic',
          uploadLimit: tiers.basic?.uploadLimit ?? 50,
          maxFileSizeBytes: tiers.basic?.maxFileSizeBytes ?? 5 * 1024 * 1024,
          mediaTypes: tiers.basic?.mediaTypes ?? ['image/jpeg', 'image/png', 'image/webp'],
          storageDays: tiers.basic?.storageDays ?? 15,
          features: {
            otp: false,
            downloads: false,
            video: false,
            audio: false,
            autoApprove: false,
            customBranding: false,
            analytics: false,
            moderation: false,
          },
        },
        paid: {
          name: 'Paid',
          uploadLimit: tiers.paid?.uploadLimit ?? 500,
          maxFileSizeBytes: tiers.paid?.maxFileSizeBytes ?? 25 * 1024 * 1024,
          mediaTypes: tiers.paid?.mediaTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm'],
          storageDays: tiers.paid?.storageDays ?? 180,
          features: {
            otp: true,
            downloads: true,
            video: true,
            audio: false,
            autoApprove: false,
            customBranding: false,
            analytics: true,
            moderation: false,
          },
        },
        premium: {
          name: 'Premium',
          uploadLimit: tiers.premium?.uploadLimit ?? 1000,
          maxFileSizeBytes: tiers.premium?.maxFileSizeBytes ?? 50 * 1024 * 1024,
          mediaTypes: tiers.premium?.mediaTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'],
          storageDays: tiers.premium?.storageDays ?? 730,
          features: {
            otp: true,
            downloads: true,
            video: true,
            audio: true,
            autoApprove: true,
            customBranding: true,
            analytics: true,
            moderation: true,
          },
        },
      },
      pricing: PRICING,
      defaultCountryCode: 'GT',
      currencies: ['GTQ', 'USD'],
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Confirm-Delete,X-Request-Id',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Cache-Control': 'max-age=3600, public',
      },
      body: JSON.stringify(config),
    };
  } catch (err) {
    logger.error('getConfig error', { error: err.message, stack: err.stack });
    return serverError();
  }
}
