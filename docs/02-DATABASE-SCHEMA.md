# Database Schema (DynamoDB Single-Table Design)

## Why Single-Table?

- Fewer tables = fewer on-demand costs
- Enables efficient access patterns with GSIs
- Standard DynamoDB best practice for serverless

## Table: `EventAlbum`

### Primary Key

| Attribute | Type | Description |
|---|---|---|
| `PK` | String | Partition key |
| `SK` | String | Sort key |

### Global Secondary Indexes

| GSI | PK | SK | Purpose |
|---|---|---|---|
| `GSI1` | `GSI1PK` | `GSI1SK` | Query by host email, list events |
| `GSI2` | `GSI2PK` | `GSI2SK` | Query media by event, sorted by upload time |

---

## Entity Definitions

### EVENT

Represents a single event created by a host.

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` |
| `SK` | Key | `METADATA` |
| `eventId` | | `evt_abc123` |
| `title` | | `"Boda de Ana y Carlos"` |
| `description` | | `"Nuestra boda en Antigua"` |
| `hostPasswordHash` | | bcrypt hash |
| `guestPassword` | | `"fiesta2026"` (plaintext for QR sharing) |
| `hostEmail` | | `host@example.com` |
| `hostName` | | `"Carlos Rivera"` |
| `coverUrl` | | S3 key for cover image |
| `footerText` | | `"Gracias por compartir!"` |
| `welcomeMessage` | | `"Welcome to our event!"` |
| `startDate` | | `2026-03-15T16:00:00Z` |
| `endDate` | | `2026-03-16T02:00:00Z` |
| `tier` | | `free` / `paid` / `premium` |
| `status` | | `active` / `ended` / `locked` / `deleted` |
| `uploadCount` | | 47 (atomic counter) |
| `uploadLimit` | | 150 / 500 / 1000 (from tier config) |
| `mediaTypes` | | `["image"]` or `["image","video","audio"]` |
| `colorTheme` | | `green` / `blue` / `coral` / `gold` |
| `showDateTime` | | `true` / `false` |
| `galleryPrivacy` | | `true` (require password to view gallery) |
| `allowDownloads` | | `false` (let guests download photos) |
| `allowVideo` | | `false` (derived from tier, overridable) |
| `emailNotifications` | | `true` (notify host on guest uploads) |
| `autoApprove` | | `false` (Premium only: skip moderation) |
| `totalScans` | | 142 (atomic counter) |
| `uniqueVisitors` | | 87 (atomic counter) |
| `lastScannedAt` | | `2026-03-15T20:30:00Z` |
| `lastNotifiedAt` | | `2026-03-15T19:00:00Z` (for batched notifications) |
| `checkoutId` | | `ch_xxx` (Recurrente checkout ID) |
| `paymentStatus` | | `unpaid` / `paid` |
| `createdAt` | | `2026-02-27T10:00:00Z` |
| `expiresAt` | | `2026-04-15T00:00:00Z` |
| `expiresAtTTL` | | Unix timestamp for DynamoDB TTL |
| `GSI1PK` | Index | `HOST#host@example.com` |
| `GSI1SK` | Index | `EVENT#2026-02-27T10:00:00Z` |

**TTL field:** `expiresAtTTL` — DynamoDB automatically deletes expired items.

**Storage retention by tier:**
- Free: 15 days
- Paid: 6 months (180 days)
- Premium: 1 year (365 days)

### MEDIA

Represents an uploaded file (image, video, audio).

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` |
| `SK` | Key | `MEDIA#2026-03-15T18:30:00Z#med_xyz789` |
| `mediaId` | | `med_xyz789` |
| `eventId` | | `evt_abc123` |
| `s3Key` | | `events/evt_abc123/med_xyz789.jpg` |
| `thumbnailKey` | | `events/evt_abc123/thumbs/med_xyz789.jpg` |
| `mediumKey` | | `events/evt_abc123/thumbs/med_xyz789_md.jpg` |
| `fileType` | | `image/jpeg` |
| `fileSize` | | 2048576 (bytes) |
| `uploadedBy` | | `Guest_42` (session nickname) |
| `uploadedAt` | | `2026-03-15T18:30:00Z` |
| `width` | | 1920 |
| `height` | | 1080 |
| `status` | | `visible` / `hidden` / `pending_review` / `reported` |
| `moderationLabels` | | `[{"Name":"Suggestive","Confidence":72.5}]` (Rekognition) |
| `reportCount` | | 0 |
| `reactionCounts` | | `{"❤️": 5, "🎉": 3, "😂": 1}` |
| `commentCount` | | 2 |
| `GSI2PK` | Index | `EVENT#evt_abc123` |
| `GSI2SK` | Index | `MEDIA#2026-03-15T18:30:00Z` |

### REACTION

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `MEDIA#med_xyz789` |
| `SK` | Key | `REACTION#session_abc#❤️` |
| `emoji` | | `❤️` |
| `sessionId` | | `session_abc` |
| `createdAt` | | `2026-03-15T18:35:00Z` |

**Note:** SK includes sessionId + emoji to enforce one reaction type per session per media.

### COMMENT

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `MEDIA#med_xyz789` |
| `SK` | Key | `COMMENT#2026-03-15T18:40:00Z#cmt_123` |
| `commentId` | | `cmt_123` |
| `text` | | `"Que bonita foto!"` |
| `authorName` | | `Guest_42` |
| `sessionId` | | `session_abc` |
| `createdAt` | | `2026-03-15T18:40:00Z` |

### SESSION

Tracks authenticated guest/host sessions.

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` |
| `SK` | Key | `SESSION#session_abc` |
| `sessionId` | | `session_abc` |
| `role` | | `guest` / `host` |
| `nickname` | | `Guest_42` |
| `ipHash` | | SHA-256 hash of IP |
| `verified` | | `true` / `false` (OTP verified) |
| `verifiedVia` | | `sms` / `email` / `null` |
| `createdAt` | | `2026-03-15T16:00:00Z` |
| `expiresAt` | | `2026-03-16T04:00:00Z` |
| `expiresAtTTL` | | Unix timestamp for TTL |
| `uploadCount` | | 5 |

### PAYMENT

Records payment events from Recurrente webhooks.

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` |
| `SK` | Key | `PAYMENT#pa_abc123` |
| `paymentIntentId` | | `pa_abc123` |
| `checkoutId` | | `ch_xxx` |
| `status` | | `succeeded` / `failed` |
| `amountInCents` | | 7500 |
| `currency` | | `GTQ` |
| `customerEmail` | | `host@example.com` |
| `recurrenteFee` | | 450 |
| `discountCode` | | `LAUNCH50` (if applied) |
| `discountAmount` | | 3750 (amount discounted in cents) |
| `createdAt` | | `2026-02-27T10:05:00Z` |

### OTP

Temporary OTP records for guest verification and host login.

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` (guest) or `HOST_OTP#email` (host) |
| `SK` | Key | `OTP#50212345678` or `OTP#user@email.com` |
| `otpCode` | | `483927` |
| `otpId` | | UUID |
| `channel` | | `sms` / `email` |
| `destination` | | phone number or email |
| `attempts` | | 0 (max 5) |
| `sendCount` | | 1 (max 3 per 10 min) |
| `createdAt` | | ISO timestamp |
| `expiresAtTTL` | | Unix timestamp (5 min guest, 10 min host) |

**Guest OTP:** PK = `EVENT#eventId`, allows per-event scoping.
**Host OTP:** PK = `HOST_OTP#email`, independent of events (host may manage multiple).

### REPORT

Tracks guest content reports.

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `MEDIA#med_xyz789` |
| `SK` | Key | `REPORT#session_abc` |
| `sessionId` | | `session_abc` |
| `reason` | | `inappropriate` / `spam` / `other` |
| `description` | | `"This photo has nothing to do with the event"` |
| `createdAt` | | `2026-03-15T19:00:00Z` |

**Note:** SK includes sessionId to enforce one report per session per media.

### SCAN

Tracks QR code scan IP hashes for unique visitor counting.

| Attribute | Key | Value Example |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` |
| `SK` | Key | `SCAN#a1b2c3d4...` (IP hash) |
| `ipHash` | | `a1b2c3d4...` (SHA-256) |
| `firstSeenAt` | | `2026-03-15T16:05:00Z` |
| `expiresAtTTL` | | Unix timestamp (event end + 30 days) |

---

## Access Patterns

| Access Pattern | Key Condition | Index |
|---|---|---|
| Get event by ID | PK=`EVENT#id`, SK=`METADATA` | Table |
| List events by host | GSI1PK=`HOST#email` | GSI1 |
| List media for event (sorted) | PK=`EVENT#id`, SK begins_with `MEDIA#` | Table |
| List media for event (by time) | GSI2PK=`EVENT#id` | GSI2 |
| Search media (by uploader) | PK=`EVENT#id`, SK begins_with `MEDIA#`, filter `uploadedBy` | Table |
| Get reactions for media | PK=`MEDIA#id`, SK begins_with `REACTION#` | Table |
| Get comments for media | PK=`MEDIA#id`, SK begins_with `COMMENT#` | Table |
| Get reports for media | PK=`MEDIA#id`, SK begins_with `REPORT#` | Table |
| Check if session reported | PK=`MEDIA#id`, SK=`REPORT#sessionId` | Table |
| Get sessions for event | PK=`EVENT#id`, SK begins_with `SESSION#` | Table |
| Get payments for event | PK=`EVENT#id`, SK begins_with `PAYMENT#` | Table |
| Check session exists | PK=`EVENT#id`, SK=`SESSION#id` | Table |
| Get OTP (guest) | PK=`EVENT#id`, SK=`OTP#destination` | Table |
| Get OTP (host) | PK=`HOST_OTP#email`, SK=`OTP#email` | Table |
| Check unique scan | PK=`EVENT#id`, SK=`SCAN#ipHash` | Table |
| Count media by status | PK=`EVENT#id`, SK begins_with `MEDIA#`, filter `status` | Table |

## S3 Key Structure

```
event-album-media-{env}/
├── events/
│   ├── {eventId}/
│   │   ├── cover.jpg              (event cover image)
│   │   ├── {mediaId}.jpg          (original upload)
│   │   ├── {mediaId}.mp4          (video)
│   │   ├── {mediaId}.mp3          (audio)
│   │   └── thumbs/
│   │       ├── {mediaId}.jpg      (thumbnail, 300px)
│   │       └── {mediaId}_md.jpg   (medium, 800px)
├── exports/
│   └── {eventId}/
│       └── {eventId}_photos.zip   (ZIP download, 7-day TTL)
```

- `eventId` = `evt_` + nanoid (URL-safe, 12 chars)
- `mediaId` = `med_` + uuid v4
- File extensions validated server-side
- No user-controlled path components
- S3 object tags: `tier=free|paid|premium`, `eventId=evt_xxx`
