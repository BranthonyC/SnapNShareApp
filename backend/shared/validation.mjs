export function validateCreateEvent(body) {
  const errors = [];

  if (!body.title || body.title.length < 2 || body.title.length > 100) {
    errors.push('title must be 2-100 characters');
  }
  if (!body.hostEmail || !isValidEmail(body.hostEmail)) {
    errors.push('Valid hostEmail is required');
  }
  if (!body.hostName || body.hostName.length < 1 || body.hostName.length > 100) {
    errors.push('hostName is required (1-100 characters)');
  }
  if (!body.startDate || !isValidIsoDate(body.startDate)) {
    errors.push('Valid startDate (ISO 8601) is required');
  }
  // endDate is optional — auto-computed as startDate + 24h if not provided
  if (body.endDate && !isValidIsoDate(body.endDate)) {
    errors.push('endDate must be a valid ISO 8601 date if provided');
  }
  if (body.startDate && body.endDate && new Date(body.endDate) <= new Date(body.startDate)) {
    errors.push('endDate must be after startDate');
  }
  // guestPassword is optional — events are public (accessed via QR/link)
  if (body.guestPassword && (body.guestPassword.length < 4 || body.guestPassword.length > 50)) {
    errors.push('guestPassword must be 4-50 characters if provided');
  }
  if (body.tier && !['basic', 'paid', 'premium'].includes(body.tier)) {
    errors.push('tier must be basic, paid, or premium');
  }
  if (body.description && body.description.length > 500) {
    errors.push('description must be <= 500 characters');
  }

  return errors;
}

export function validateAuthEvent(body) {
  // password is no longer required — events are public via QR/link
  return [];
}

export function validateUploadRequest(body) {
  const errors = [];
  if (!body.fileType || !isAllowedMimeType(body.fileType)) {
    errors.push('fileType must be a valid image/video/audio MIME type');
  }
  if (!body.fileSize || typeof body.fileSize !== 'number' || body.fileSize <= 0) {
    errors.push('fileSize must be a positive number');
  }
  return errors;
}

export function validateComment(body) {
  const errors = [];
  if (!body.text || body.text.length < 1 || body.text.length > 500) {
    errors.push('text must be 1-500 characters');
  }
  return errors;
}

const ALLOWED_EMOJIS = ['heart', 'thumbsup', 'party', 'fire', 'laugh', 'wow', 'sad', 'clap'];

export function validateReaction(body) {
  const errors = [];
  if (!body.emoji) {
    errors.push('emoji is required');
  } else if (typeof body.emoji !== 'string' || body.emoji.length > 20) {
    errors.push('emoji must be a string of at most 20 characters');
  } else if (!ALLOWED_EMOJIS.includes(body.emoji)) {
    errors.push(`emoji must be one of: ${ALLOWED_EMOJIS.join(', ')}`);
  }
  return errors;
}

export function validateUpdateEvent(body) {
  const errors = [];
  const allowedFields = ['title', 'description', 'footerText', 'welcomeMessage', 'startDate', 'endDate', 'coverUrl', 'location', 'schedule'];
  const keys = Object.keys(body);

  for (const key of keys) {
    if (!allowedFields.includes(key)) {
      errors.push(`Field "${key}" is not updatable`);
    }
  }
  if (body.title && (body.title.length < 2 || body.title.length > 100)) {
    errors.push('title must be 2-100 characters');
  }
  if (body.description && body.description.length > 2000) {
    errors.push('description must be <= 2000 characters');
  }
  if (body.welcomeMessage && body.welcomeMessage.length > 1000) {
    errors.push('welcomeMessage must be <= 1000 characters');
  }
  if (body.footerText && body.footerText.length > 500) {
    errors.push('footerText must be <= 500 characters');
  }
  if (body.location && body.location.length > 200) {
    errors.push('location must be <= 200 characters');
  }
  if (body.coverUrl && typeof body.coverUrl !== 'string') {
    errors.push('coverUrl must be a string');
  }
  if (body.schedule) {
    if (!Array.isArray(body.schedule)) {
      errors.push('schedule must be an array');
    } else if (body.schedule.length > 20) {
      errors.push('schedule can have at most 20 items');
    } else {
      for (const item of body.schedule) {
        if (!item.time || !item.label) {
          errors.push('Each schedule item must have time and label');
          break;
        }
      }
    }
  }
  return errors;
}

export function validateSettings(body, tier) {
  const errors = [];
  if (body.autoApprove === true && tier !== 'premium') {
    errors.push('autoApprove is only available for premium events');
  }
  if (body.allowVideo === true && tier === 'basic') {
    errors.push('Video uploads require paid or premium tier');
  }
  if (body.colorTheme && !['green', 'blue', 'coral', 'gold'].includes(body.colorTheme)) {
    errors.push('colorTheme must be green, blue, coral, or gold');
  }
  if (body.smsOtp === true && tier !== 'premium') {
    errors.push('SMS OTP is only available for premium events');
  }
  return errors;
}

export function sanitizeHtml(text) {
  return text.replace(/<[^>]*>/g, '').trim();
}

export function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

// Helpers
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidIsoDate(str) {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
]);

function isAllowedMimeType(type) {
  return ALLOWED_MIME_TYPES.has(type);
}
