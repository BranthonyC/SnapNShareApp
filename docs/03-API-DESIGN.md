# API Design

## Base URL

```
https://api.eventalbum.app/v1
```

## Authentication Model

Two separate auth flows:

1. **Guest access** — Event password (guest password shared via QR) → JWT with role=guest
2. **Host access** — Email OTP (no event password for host admin) → JWT with role=host

### Session Tokens

After authentication, Lambda returns a **signed JWT** (HS256, secret stored in SSM Parameter Store):

```json
{
  "sub": "session_abc",
  "eventId": "evt_abc123",
  "role": "host" | "guest",
  "nickname": "Guest_42",
  "verified": true | false,
  "exp": 1710572400
}
```

- Guest tokens expire at event end + 2 hours
- Host tokens expire after 24 hours
- Token sent as `Authorization: Bearer <token>` header
- For paid/premium events, guest JWT includes `verified: false` until OTP completed

---

## Endpoints

### Public Configuration

#### `GET /config` — Get Public Configuration

**Auth:** None (public, CloudFront cached 1hr)

**Response (200):**
```json
{
  "tiers": {
    "free": {
      "uploadLimit": 150,
      "storageRetentionDays": 15,
      "features": ["image", "reactions", "comments"]
    },
    "paid": {
      "uploadLimit": 500,
      "storageRetentionDays": 180,
      "features": ["image", "video", "audio", "reactions", "comments", "gifts", "otp", "zip", "customize", "reporting", "analytics", "notifications"]
    },
    "premium": {
      "uploadLimit": 1000,
      "storageRetentionDays": 365,
      "features": ["all paid features", "rekognition", "autoApprove", "4k video"]
    }
  },
  "pricing": {
    "paid": {"GTQ": 7500, "USD": 900},
    "premium": {"GTQ": 20000, "USD": 2500}
  },
  "defaultCountryCode": "+502"
}
```

**Lambda:** Reads from SSM Parameter Store (cached at cold start). Response cached at CloudFront for 1 hour.

---

### Host Authentication (Email OTP)

#### `POST /auth/host/login` — Request Host Login Code

**Auth:** None (public, rate-limited)

**Request:**
```json
{
  "email": "carlos@email.com"
}
```

**Response (200) — ALWAYS the same regardless of whether email exists:**
```json
{
  "message": "If an account exists, we sent a code",
  "expiresIn": 600
}
```

**Logic:**
1. Query GSI1 for `HOST#carlos@email.com`
2. If found: generate 6-digit OTP, store in DynamoDB (TTL 10 min), send via SES email
3. If NOT found: return same response (anti-enumeration), log attempt
4. **Host OTP is email ONLY — never SMS**

**Rate limit:** 3 requests per email per 10 minutes

---

#### `POST /auth/host/verify` — Verify Host Login Code

**Auth:** None (public, rate-limited)

**Request:**
```json
{
  "email": "carlos@email.com",
  "code": "483927"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGci...",
  "role": "host",
  "events": [
    {
      "eventId": "evt_abc123",
      "title": "Boda de Ana y Carlos",
      "status": "active"
    }
  ]
}
```

**Logic:**
1. Look up OTP record by `HOST_OTP#email` + `OTP#email`
2. Timing-safe compare with `crypto.timingSafeEqual`
3. Max 5 attempts per code, then invalidate
4. On success: delete OTP, issue JWT with `role=host` and linked eventIds
5. JWT expiry: 24 hours

**Rate limit:** 10 attempts per IP per 5 minutes

---

### Events

#### `POST /events` — Create Event

**Auth:** None (public, rate-limited)

**Request:**
```json
{
  "title": "Boda de Ana y Carlos",
  "description": "Nuestra boda en Antigua Guatemala",
  "hostEmail": "carlos@email.com",
  "hostName": "Carlos Rivera",
  "guestPassword": "fiesta2026",
  "startDate": "2026-03-15T16:00:00Z",
  "endDate": "2026-03-16T02:00:00Z",
  "tier": "free"
}
```

**Response (201):**
```json
{
  "eventId": "evt_abc123",
  "qrUrl": "https://eventalbum.app/e/evt_abc123",
  "adminUrl": "https://eventalbum.app/admin",
  "tier": "free",
  "uploadLimit": 150,
  "expiresAt": "2026-04-15T00:00:00Z"
}
```

**Validation:**
- `guestPassword`: min 4 chars (simpler for guests)
- `startDate` must be in the future
- `endDate` must be after `startDate`
- `hostEmail`: valid email format
- Rate limit: 5 events per IP per hour

**Note:** No `hostPassword` field — host admin uses email OTP login exclusively.

---

#### `POST /events/{eventId}/auth` — Guest Authentication

**Auth:** None (public, rate-limited)

**Request:**
```json
{
  "password": "fiesta2026",
  "nickname": "Maria"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGci...",
  "role": "guest",
  "nickname": "Guest_42",
  "verified": false,
  "event": {
    "eventId": "evt_abc123",
    "title": "Boda de Ana y Carlos",
    "coverUrl": "https://cdn.eventalbum.app/...",
    "startDate": "2026-03-15T16:00:00Z",
    "endDate": "2026-03-16T02:00:00Z",
    "uploadCount": 47,
    "uploadLimit": 150,
    "colorTheme": "green"
  }
}
```

**Logic:**
1. Compare with `guestPassword` (plaintext compare) → role = `guest`
2. If no match → 401
3. For paid/premium events, `verified` is `false` until OTP completed

**Rate limit:** 10 attempts per IP per 5 minutes

---

#### `GET /events/{eventId}` — Get Event Info

**Auth:** Bearer token (guest or host)

**Response (200):**
```json
{
  "eventId": "evt_abc123",
  "title": "Boda de Ana y Carlos",
  "description": "Nuestra boda en Antigua Guatemala",
  "coverUrl": "https://cdn.eventalbum.app/signed-url...",
  "footerText": "Gracias por compartir!",
  "welcomeMessage": "Welcome to our event!",
  "startDate": "2026-03-15T16:00:00Z",
  "endDate": "2026-03-16T02:00:00Z",
  "tier": "free",
  "uploadCount": 47,
  "uploadLimit": 150,
  "mediaTypes": ["image"],
  "status": "active",
  "colorTheme": "green",
  "showDateTime": true,
  "allowDownloads": false,
  "allowVideo": false
}
```

**Host-only fields** (included when `role=host`):
```json
{
  "hostEmail": "carlos@email.com",
  "hostName": "Carlos Rivera",
  "guestPassword": "fiesta2026",
  "galleryPrivacy": true,
  "emailNotifications": true,
  "autoApprove": false,
  "paymentStatus": "paid",
  "totalScans": 142,
  "uniqueVisitors": 87,
  "lastScannedAt": "2026-03-15T20:30:00Z",
  "createdAt": "2026-02-27T10:00:00Z"
}
```

---

#### `PATCH /events/{eventId}` — Update Event

**Auth:** Bearer token (host only)

**Request:**
```json
{
  "title": "Boda de Ana y Carlos",
  "description": "Updated description",
  "footerText": "Gracias!",
  "welcomeMessage": "Updated welcome",
  "startDate": "2026-03-15T16:00:00Z",
  "endDate": "2026-03-16T02:00:00Z",
  "guestPassword": "newpassword"
}
```

**Updatable fields:** `title`, `description`, `footerText`, `welcomeMessage`, `startDate`, `endDate`, `guestPassword`

**Cover image:** Upload via `POST /events/{eventId}/upload-url` with `type=cover`

---

#### `DELETE /events/{eventId}` — Delete Event

**Auth:** Bearer token (host only)

**Response (200):**
```json
{
  "message": "Event scheduled for deletion",
  "deletesAt": "2026-03-16T20:30:00Z"
}
```

**Logic:**
1. Set `status=deleted`, set `expiresAtTTL` to now + 24 hours (grace period for undo)
2. After TTL: DynamoDB auto-deletes event + S3 lifecycle cleans up media
3. Requires confirmation header: `X-Confirm-Delete: true`

---

#### `PATCH /events/{eventId}/settings` — Update Event Settings

**Auth:** Bearer token (host only)

**Request:**
```json
{
  "galleryPrivacy": true,
  "allowDownloads": true,
  "allowVideo": false,
  "emailNotifications": true,
  "autoApprove": false,
  "colorTheme": "coral",
  "showDateTime": false
}
```

**Validation:**
- `autoApprove` can only be `true` for premium events
- `allowVideo` can only be `true` for paid/premium events
- `colorTheme` must be one of: `green`, `blue`, `coral`, `gold`

**Response (200):**
```json
{
  "message": "Settings updated",
  "settings": { ...updated values }
}
```

---

### Media

#### `POST /events/{eventId}/upload-url` — Get Presigned Upload URL

**Auth:** Bearer token (guest or host). For paid/premium guests, `verified` must be `true`.

**Request:**
```json
{
  "fileType": "image/jpeg",
  "fileSize": 2048576,
  "type": "media"
}
```

**Validation (Lambda-side before signing):**
1. Event is `active` (between start/end dates or host override)
2. `uploadCount < uploadLimit` (atomic check)
3. `fileType` is in allowed `mediaTypes` for tier
4. `fileSize` <= max for tier (free: 2MB images, paid: 5MB images / 30MB video)
5. Session upload rate < 10/minute
6. For paid/premium guests: JWT `verified === true` required

**Response (200):**
```json
{
  "uploadUrl": "https://event-album-media.s3.amazonaws.com/events/evt_abc123/med_xyz789.jpg?X-Amz-...",
  "mediaId": "med_xyz789",
  "s3Key": "events/evt_abc123/med_xyz789.jpg",
  "expiresIn": 180
}
```

**Presigned URL constraints:**
- Expires in 3 minutes
- Content-Type must match
- Content-Length-Range: 1 byte to max file size
- Scoped to exact S3 key (no traversal)

---

#### `GET /events/{eventId}/media` — List Media

**Auth:** Bearer token (guest or host)

**Query params:**
- `cursor` — pagination cursor (last SK value)
- `limit` — 20 (default), max 50
- `status` — filter by status (host only): `visible`, `hidden`, `pending_review`, `reported`

**Response (200):**
```json
{
  "items": [
    {
      "mediaId": "med_xyz789",
      "thumbnailUrl": "https://cdn.eventalbum.app/signed-url...",
      "fullUrl": "https://cdn.eventalbum.app/signed-url...",
      "fileType": "image/jpeg",
      "uploadedBy": "Guest_42",
      "uploadedAt": "2026-03-15T18:30:00Z",
      "status": "visible",
      "reactionCounts": {"❤️": 5, "🎉": 3},
      "commentCount": 2
    }
  ],
  "nextCursor": "MEDIA#2026-03-15T18:25:00Z#med_abc456",
  "total": 247
}
```

**Note:** Guests only see `status=visible` media. Hosts see all statuses.

---

#### `GET /events/{eventId}/media/search` — Search Media

**Auth:** Bearer token (guest or host)

**Query params:**
- `q` — search query (matches `uploadedBy` name)
- `cursor` — pagination cursor
- `limit` — 20 (default)

**Response:** Same shape as `GET /events/{eventId}/media`.

**Implementation:** DynamoDB filter expression on `uploadedBy` field. For larger datasets, consider DynamoDB Streams → OpenSearch (future optimization).

---

#### `DELETE /events/{eventId}/media/{mediaId}` — Delete Single Media

**Auth:** Bearer token (host only)

**Response (200):**
```json
{
  "message": "Media deleted"
}
```

Deletes: S3 object + thumbnails + DynamoDB MEDIA item + associated reactions/comments. Decrements `uploadCount`.

---

#### `POST /events/{eventId}/media/bulk-delete` — Bulk Delete Media

**Auth:** Bearer token (host only)

**Request:**
```json
{
  "mediaIds": ["med_xyz789", "med_abc456", "med_def012"]
}
```

**Validation:**
- Max 25 items per request (DynamoDB BatchWriteItem limit)

**Response (200):**
```json
{
  "deleted": 3,
  "failed": 0
}
```

---

#### `DELETE /events/{eventId}/media` — Clear All Media

**Auth:** Bearer token (host only)

**Response (200):**
```json
{
  "message": "All media scheduled for deletion",
  "count": 247
}
```

**Logic:**
1. Requires confirmation header: `X-Confirm-Delete: true`
2. Query all MEDIA items for event
3. Delete S3 objects + DynamoDB items in batches
4. Reset `uploadCount` to 0
5. Async processing for large events (returns immediately, deletes in background)

---

#### `POST /events/{eventId}/media/{mediaId}/report` — Report Content

**Auth:** Bearer token (guest)

**Request:**
```json
{
  "reason": "inappropriate",
  "description": "This photo has nothing to do with the event"
}
```

**Validation:**
- `reason` must be: `inappropriate`, `spam`, `other`
- `description` max 500 chars
- One report per session per media (enforced by DynamoDB PK/SK)

**Response (200):**
```json
{
  "message": "Report submitted"
}
```

**Logic:**
1. Create REPORT record in DynamoDB
2. Increment `reportCount` on MEDIA item
3. If `reportCount >= 3`, auto-set `status=reported`
4. Send moderation alert email to host (if emailNotifications enabled)

---

#### `POST /events/{eventId}/media/{mediaId}/moderate` — Moderate Content

**Auth:** Bearer token (host only)

**Request:**
```json
{
  "action": "approve" | "reject"
}
```

**Response (200):**
```json
{
  "message": "Media approved",
  "status": "visible"
}
```

**Logic:**
- `approve`: Set `status=visible`
- `reject`: Set `status=hidden`, optionally delete from S3

---

### Reactions

#### `POST /events/{eventId}/media/{mediaId}/reactions` — Add Reaction

**Auth:** Bearer token

**Request:**
```json
{
  "emoji": "❤️"
}
```

**Allowed emojis (free):** `❤️`, `👍`, `🎉`
**Allowed emojis (paid/premium):** Full sticker set + custom

**Logic:**
- Upsert `REACTION#sessionId#emoji` in DynamoDB
- Update `reactionCounts` map on MEDIA item (atomic increment)
- One reaction type per session per media (toggle on/off)

---

### Comments

#### `POST /events/{eventId}/media/{mediaId}/comments` — Add Comment

**Auth:** Bearer token

**Request:**
```json
{
  "text": "Que bonita foto!"
}
```

**Validation:**
- Max 500 characters
- Sanitize HTML (strip all tags)
- Rate limit: 5 comments/minute per session

#### `GET /events/{eventId}/media/{mediaId}/comments` — List Comments

**Auth:** Bearer token

Paginated, sorted by `createdAt` ascending.

---

### OTP Verification (Paid & Premium Only)

#### `POST /events/{eventId}/otp/send` — Send Guest OTP

**Auth:** Bearer token (temporary, verified=false)

**Request:**
```json
{
  "channel": "sms",
  "destination": "+50212345678"
}
```

or

```json
{
  "channel": "email",
  "destination": "maria@email.com"
}
```

**Logic:**
1. Validate event tier is paid/premium
2. Rate limit: 3 sends per destination per 10 minutes
3. Generate 6-digit OTP (`crypto.randomInt`)
4. Store in DynamoDB (TTL 5 minutes)
5. Send via SNS SMS (primary) or SES email (fallback)
6. If SMS fails, return `{sent: false, fallback: true}` so frontend can offer email

**Response (200):**
```json
{
  "sent": true,
  "channel": "sms",
  "expiresIn": 300
}
```

#### `POST /events/{eventId}/otp/verify` — Verify Guest OTP

**Auth:** Bearer token (temporary)

**Request:**
```json
{
  "code": "483927",
  "destination": "+50212345678"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGci... (new JWT with verified=true)",
  "verified": true
}
```

**Logic:**
1. Get OTP record, check attempts < 5
2. Timing-safe compare
3. On success: delete OTP, issue new JWT with `verified=true`

---

### Payments

#### `POST /events/{eventId}/checkout` — Create Payment Checkout

**Auth:** Bearer token (host only)

**Request:**
```json
{
  "tier": "paid",
  "currency": "GTQ",
  "discountCode": "LAUNCH50"
}
```

**Logic:**
1. If `discountCode` provided, validate and calculate discount
2. Create Recurrente checkout via `POST https://app.recurrente.com/api/checkouts/`
3. Store `checkoutId` on event record
4. Return checkout URL

**Response (200):**
```json
{
  "checkoutUrl": "https://app.recurrente.com/checkout-session/ch_xxx",
  "checkoutId": "ch_xxx",
  "originalAmount": 7500,
  "discountAmount": 3750,
  "finalAmount": 3750,
  "currency": "GTQ"
}
```

---

#### `POST /events/{eventId}/promo` — Validate Promo Code

**Auth:** None (public, rate-limited)

**Request:**
```json
{
  "code": "LAUNCH50",
  "tier": "paid",
  "currency": "GTQ"
}
```

**Response (200):**
```json
{
  "valid": true,
  "type": "percent",
  "value": 50,
  "discountAmount": 3750,
  "finalAmount": 3750,
  "currency": "GTQ"
}
```

**Error (400):**
```json
{
  "valid": false,
  "reason": "Code has expired"
}
```

**Logic:** Reads discount config from SSM Parameter Store. Validates: exists, not expired, usedCount < maxUses.

---

#### `POST /webhooks/recurrente` — Payment Webhook

**Auth:** Recurrente webhook — verify via API callback (no HMAC available)

**Handles:**
- `payment_intent.succeeded` → upgrade event tier, extend limits, send receipt + event created emails
- `payment_intent.failed` → log failure, notify host

**Idempotent:** Checks `paymentStatus` before processing. If already `paid`, returns 200 without action.

---

### Host Dashboard

#### `GET /events/{eventId}/stats` — Get Event Statistics

**Auth:** Bearer token (host only)

**Response (200):**
```json
{
  "uploads": {
    "count": 47,
    "limit": 150,
    "byType": {"image": 40, "video": 5, "audio": 2}
  },
  "guests": {
    "total": 23,
    "verified": 18
  },
  "reactions": {
    "total": 156,
    "byEmoji": {"❤️": 89, "🎉": 45, "👍": 22}
  },
  "storage": {
    "totalBytes": 47433728,
    "byType": {"image": 38000000, "video": 8000000, "audio": 1433728}
  },
  "moderation": {
    "pending": 3,
    "approved": 42,
    "rejected": 2,
    "reported": 1
  }
}
```

---

#### `GET /events/{eventId}/activity` — Get Activity Feed

**Auth:** Bearer token (host only)

**Query params:**
- `cursor` — pagination cursor
- `limit` — 20 (default)

**Response (200):**
```json
{
  "items": [
    {
      "type": "upload",
      "actor": "Guest_42",
      "detail": "uploaded a photo",
      "mediaId": "med_xyz789",
      "thumbnailUrl": "https://cdn.eventalbum.app/...",
      "timestamp": "2026-03-15T18:30:00Z"
    },
    {
      "type": "reaction",
      "actor": "Guest_15",
      "detail": "reacted ❤️",
      "mediaId": "med_abc456",
      "timestamp": "2026-03-15T18:25:00Z"
    }
  ],
  "nextCursor": "..."
}
```

**Implementation:** Query recent MEDIA, REACTION, COMMENT items for the event, merge and sort by timestamp.

---

#### `GET /events/{eventId}/qr-stats` — Get QR Scan Statistics

**Auth:** Bearer token (host only)

**Response (200):**
```json
{
  "totalScans": 142,
  "uniqueVisitors": 87,
  "lastScannedAt": "2026-03-15T20:30:00Z"
}
```

---

#### `GET /events/{eventId}/storage` — Get Storage Breakdown

**Auth:** Bearer token (host only)

**Response (200):**
```json
{
  "totalBytes": 47433728,
  "limitBytes": null,
  "byType": {
    "image": {"count": 40, "bytes": 38000000},
    "video": {"count": 5, "bytes": 8000000},
    "audio": {"count": 2, "bytes": 1433728}
  },
  "storageClass": "STANDARD",
  "retentionDays": 180,
  "expiresAt": "2026-09-15T00:00:00Z"
}
```

---

#### `POST /events/{eventId}/download-zip` — Generate ZIP Download

**Auth:** Bearer token (host only, paid/premium)

**Response (200):**
```json
{
  "downloadUrl": "https://cdn.eventalbum.app/exports/evt_abc123/evt_abc123_photos.zip?...",
  "expiresIn": 3600,
  "fileCount": 47,
  "estimatedSize": 47433728
}
```

**Logic:**
1. Query all MEDIA items for event
2. Stream S3 objects → archiver → ZIP → upload to `exports/{eventId}/`
3. Return presigned download URL (1hr expiry)
4. S3 lifecycle auto-deletes exports after 7 days

**Limits:** Max 1 ZIP generation per event per hour.

---

## Error Response Format

All errors follow:

```json
{
  "error": {
    "code": "UPLOAD_LIMIT_REACHED",
    "message": "This event has reached its upload limit of 150 files.",
    "details": {}
  }
}
```

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `INVALID_PASSWORD` | 401 | Wrong password |
| `TOKEN_EXPIRED` | 401 | Session token expired |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient role |
| `EVENT_NOT_FOUND` | 404 | Event doesn't exist |
| `MEDIA_NOT_FOUND` | 404 | Media item doesn't exist |
| `EVENT_LOCKED` | 403 | Event has ended and is locked |
| `EVENT_DELETED` | 410 | Event has been deleted |
| `UPLOAD_LIMIT_REACHED` | 429 | Max uploads for tier |
| `FILE_TOO_LARGE` | 413 | Exceeds max file size |
| `INVALID_FILE_TYPE` | 415 | File type not allowed |
| `RATE_LIMITED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `OTP_NOT_AVAILABLE` | 403 | Free tier, OTP not supported |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests |
| `OTP_EXPIRED` | 400 | Code expired or not found |
| `OTP_INVALID` | 400 | Wrong code |
| `OTP_MAX_ATTEMPTS` | 429 | 5 failed attempts, must request new |
| `OTP_NOT_VERIFIED` | 403 | Upload requires OTP verification |
| `PROMO_INVALID` | 400 | Promo code not found or expired |
| `ZIP_IN_PROGRESS` | 409 | ZIP generation already running |
| `FEATURE_NOT_AVAILABLE` | 403 | Feature not available for this tier |
| `ALREADY_REPORTED` | 409 | Already reported this media |
| `CONFIRMATION_REQUIRED` | 400 | Missing X-Confirm-Delete header |
