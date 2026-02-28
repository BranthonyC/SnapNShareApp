# Content Moderation — AWS Rekognition (Premium Tier)

## Overview

Premium ($25) events include automatic NSFW content detection using AWS Rekognition. All uploaded images and video thumbnails are automatically scanned. Flagged content is hidden from the gallery and tagged for host review.

**Free tier:** No moderation — host can manually delete.
**Paid tier:** No auto-moderation — host can manually delete.
**Premium tier:** Auto-moderation with Rekognition + host review panel.

---

## How It Works

```
Guest uploads image/video
        │
        ▼
S3 trigger → processUpload Lambda
        │
        ├── Generate thumbnail (all tiers)
        ├── Validate file magic bytes (all tiers)
        │
        ├── [Premium only] Call Rekognition DetectModerationLabels
        │       │
        │       ├── SAFE → media.status = "visible"
        │       │
        │       └── FLAGGED → media.status = "hidden"
        │                     media.moderationLabels = [...]
        │                     media.nsfwScore = 0.92
        │
        ▼
Media appears in gallery (if visible)
or hidden with "Under review" placeholder (if flagged)
```

---

## AWS Rekognition Pricing

| API | Cost |
|---|---|
| DetectModerationLabels (images) | $1.00/1,000 images (first 1M) |
| Per image | $0.001 |
| Video moderation (StartContentModeration) | $0.10/minute of video |

### Cost Per Premium Event

| Scenario | Images | Videos (avg 30s) | Rekognition Cost |
|---|---|---|---|
| Small event (200 uploads) | 180 images | 20 videos (10 min) | $0.18 + $1.00 = **$1.18** |
| Medium event (500 uploads) | 400 images | 100 videos (50 min) | $0.40 + $5.00 = **$5.40** |
| Large wedding (1000 uploads) | 800 images | 200 videos (100 min) | $0.80 + $10.00 = **$10.80** |

### Impact on Premium Margins

| Premium Event | Revenue | Rekognition | Other AWS | OTP (email) | Total Cost | Margin |
|---|---|---|---|---|---|---|
| 200 uploads | $25.00 | $1.18 | ~$5.00 | $0.02 | ~$6.20 | ~75% |
| 500 uploads | $25.00 | $5.40 | ~$5.00 | $0.02 | ~$10.42 | ~58% |
| 1000 uploads | $25.00 | $10.80 | ~$5.00 | $0.02 | ~$15.82 | ~37% |

**Optimization:** Only scan images, skip video moderation at launch. Video moderation is 100x more expensive per item. Add it later if needed.

### Image-Only Strategy (Recommended for MVP)

| Premium Event | Revenue | Rekognition (images only) | Other AWS | Margin |
|---|---|---|---|---|
| 200 uploads | $25.00 | $0.18 | ~$5.02 | ~79% |
| 500 uploads | $25.00 | $0.40 | ~$5.02 | ~78% |
| 1000 uploads | $25.00 | $0.80 | ~$5.02 | ~77% |

Much healthier margins. Video thumbnails can still be scanned as images.

---

## Rekognition Moderation Labels

AWS Rekognition returns hierarchical moderation labels:

| Top Level | Second Level | Description |
|---|---|---|
| **Explicit Nudity** | Nudity, Graphic Male Nudity, Graphic Female Nudity, Sexual Activity | Hard NSFW |
| **Suggestive** | Female Swimwear/Underwear, Male Swimwear/Underwear, Partial Nudity | Soft NSFW |
| **Violence** | Graphic Violence, Physical Violence, Weapon Violence, Self Injury | Violence |
| **Visually Disturbing** | Emaciated Bodies, Corpses, Hanging, Air Crash | Disturbing |
| **Drugs** | Drug Products, Drug Use, Pills, Drug Paraphernalia | Drugs |
| **Tobacco** | Tobacco Products, Smoking | Tobacco |
| **Alcohol** | Drinking, Alcoholic Beverages | Alcohol |
| **Gambling** | Gambling | Gambling |
| **Hate Symbols** | Nazi Party, White Supremacy, Extremist | Hate |

### Our Flagging Rules

**Auto-hide (status = "hidden"):**
- Any label with confidence >= 80% in categories:
  - Explicit Nudity
  - Violence
  - Visually Disturbing
  - Drugs
  - Hate Symbols

**Flag for review (status = "flagged"):**
- Any label with confidence >= 60% in categories:
  - Suggestive
  - Explicit Nudity (lower confidence)

**Allow (status = "visible"):**
- No moderation labels detected
- Labels with confidence < 60%
- Alcohol, Tobacco, Gambling (allowed at events)

---

## Lambda Implementation

### processUpload (Updated for Premium)

```javascript
import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';

const rekognition = new RekognitionClient();

// Inside processUpload handler, after thumbnail generation:

async function moderateContent(bucketName, s3Key, eventTier) {
  // Only run for Premium tier
  if (eventTier !== 'premium') {
    return { status: 'visible', moderationLabels: [], nsfwScore: 0 };
  }

  try {
    const result = await rekognition.send(new DetectModerationLabelsCommand({
      Image: {
        S3Object: {
          Bucket: bucketName,
          Name: s3Key
        }
      },
      MinConfidence: 60 // Only return labels with >= 60% confidence
    }));

    const labels = result.ModerationLabels || [];

    if (labels.length === 0) {
      return { status: 'visible', moderationLabels: [], nsfwScore: 0 };
    }

    // Check for auto-hide categories
    const autoHideCategories = [
      'Explicit Nudity', 'Violence', 'Visually Disturbing', 'Drugs', 'Hate Symbols'
    ];

    const highConfidenceFlags = labels.filter(l =>
      l.Confidence >= 80 &&
      autoHideCategories.some(cat =>
        l.ParentName === cat || l.Name === cat
      )
    );

    if (highConfidenceFlags.length > 0) {
      return {
        status: 'hidden',
        moderationLabels: labels.map(l => ({
          name: l.Name,
          parentName: l.ParentName,
          confidence: l.Confidence
        })),
        nsfwScore: Math.max(...labels.map(l => l.Confidence)) / 100
      };
    }

    // Check for flagged (lower confidence or suggestive)
    const flaggedLabels = labels.filter(l => l.Confidence >= 60);
    if (flaggedLabels.length > 0) {
      return {
        status: 'flagged',
        moderationLabels: labels.map(l => ({
          name: l.Name,
          parentName: l.ParentName,
          confidence: l.Confidence
        })),
        nsfwScore: Math.max(...labels.map(l => l.Confidence)) / 100
      };
    }

    return { status: 'visible', moderationLabels: [], nsfwScore: 0 };

  } catch (error) {
    console.error('Rekognition error:', error);
    // On Rekognition failure, allow the image (don't block uploads due to service issues)
    return { status: 'visible', moderationLabels: [], nsfwScore: 0, moderationError: true };
  }
}

// Store moderation result on MEDIA record:
await dynamodb.update({
  TableName: process.env.TABLE_NAME,
  Key: { PK: `EVENT#${eventId}`, SK: `MEDIA#${timestamp}#${mediaId}` },
  UpdateExpression: `
    SET moderationStatus = :status,
        moderationLabels = :labels,
        nsfwScore = :score
  `,
  ExpressionAttributeValues: {
    ':status': moderation.status,
    ':labels': moderation.moderationLabels,
    ':score': moderation.nsfwScore
  }
});
```

### Comment Moderation (Text)

For comments on Premium events, use basic text filtering (no Rekognition needed for text):

```javascript
// Simple profanity filter for comments
const BLOCKED_PATTERNS = [
  // Add regex patterns for inappropriate words
  // Keep this simple — a word list, not AI
];

function moderateComment(text) {
  const lowerText = text.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(lowerText)) {
      return { allowed: false, reason: 'inappropriate_content' };
    }
  }
  return { allowed: true };
}
```

---

## DynamoDB Schema Updates

### MEDIA Record (New Fields)

| Attribute | Type | Description |
|---|---|---|
| `moderationStatus` | String | `visible` / `hidden` / `flagged` / `approved` / `rejected` |
| `moderationLabels` | List | Array of `{name, parentName, confidence}` |
| `nsfwScore` | Number | 0.0 to 1.0, highest confidence label score |
| `moderatedAt` | String | ISO timestamp of moderation scan |
| `reviewedBy` | String | `auto` or `host` (who decided final status) |
| `reviewedAt` | String | ISO timestamp of host review |

### Moderation Status Flow

```
Upload → processUpload Lambda
    │
    ├── No Rekognition flags → status: "visible"
    │
    ├── Low confidence flags → status: "flagged"
    │   → Host reviews → "approved" or "rejected"
    │
    └── High confidence flags → status: "hidden"
        → Host reviews → "approved" or "rejected"
```

---

## API Endpoints (New/Updated)

### `GET /events/{eventId}/media` — List Media (Updated)

For Premium events, the response now includes moderation info (host only):

**Guest view:** Hidden/flagged media is excluded from results.
**Host view:** All media shown, with moderation status and labels.

### `PATCH /events/{eventId}/media/{mediaId}/moderate` — Host Moderation Action

**Auth:** Bearer token (host only, Premium events)

**Request:**
```json
{
  "action": "approve"
}
```
or
```json
{
  "action": "reject"
}
```

**Logic:**
- `approve` → sets `moderationStatus = "approved"`, media becomes visible in gallery
- `reject` → sets `moderationStatus = "rejected"`, media stays hidden, optionally delete S3 object

**Response (200):**
```json
{
  "mediaId": "med_xyz789",
  "moderationStatus": "approved",
  "reviewedBy": "host",
  "reviewedAt": "2026-03-15T19:00:00Z"
}
```

### `GET /events/{eventId}/moderation` — Moderation Dashboard

**Auth:** Bearer token (host only, Premium events)

Returns all flagged/hidden media for review:

**Response (200):**
```json
{
  "pending": [
    {
      "mediaId": "med_xyz789",
      "thumbnailUrl": "https://cdn.eventalbum.app/signed-url...",
      "moderationStatus": "hidden",
      "moderationLabels": [
        { "name": "Nudity", "parentName": "Explicit Nudity", "confidence": 92.5 }
      ],
      "nsfwScore": 0.925,
      "uploadedBy": "Guest_42",
      "uploadedAt": "2026-03-15T18:30:00Z"
    }
  ],
  "stats": {
    "totalUploads": 500,
    "visible": 485,
    "flagged": 10,
    "hidden": 3,
    "approved": 2,
    "rejected": 0
  }
}
```

---

## Frontend: Host Moderation Panel

### Moderation Review Screen (`/e/:eventId/admin/moderation`)

Premium hosts get a moderation tab in the admin panel:

```
┌─────────────────────────────────────────┐
│ Moderation Review           3 pending   │
├─────────────────────────────────────────┤
│                                         │
│  [Blurred thumbnail]  Flagged: Nudity   │
│  Confidence: 92%      By: Guest_42      │
│  [Approve] [Reject]   2 min ago         │
│                                         │
│  [Blurred thumbnail]  Flagged: Violence │
│  Confidence: 78%      By: Guest_15      │
│  [Approve] [Reject]   5 min ago         │
│                                         │
│  Stats: 485 visible | 10 flagged |      │
│         3 hidden | 2 approved           │
└─────────────────────────────────────────┘
```

**Key UX details:**
- Flagged thumbnails are **blurred by default** (CSS filter: blur)
- Host clicks "View" to unblur and review
- Approve/Reject buttons with confirmation
- Batch actions for multiple items
- Real-time count badge on moderation tab

---

## IAM Policy (processUpload Lambda — Updated)

```json
{
  "Effect": "Allow",
  "Action": "rekognition:DetectModerationLabels",
  "Resource": "*"
}
```

Rekognition doesn't use resource-level permissions — the `*` is required.

---

## SAM Template Addition

```yaml
ProcessUploadFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: backend/functions/processUpload/
    Handler: index.handler
    MemorySize: 256
    Timeout: 30
    Policies:
      - S3CrudPolicy:
          BucketName: !Ref MediaBucket
      - DynamoDBCrudPolicy:
          TableName: !Ref EventAlbumTable
      - Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action: rekognition:DetectModerationLabels
            Resource: '*'
```

---

## Cost Control

1. **Premium only:** Never run Rekognition on free/paid events
2. **Images only at MVP:** Skip video moderation ($0.10/min is expensive)
3. **Scan thumbnails, not originals:** Use the 800px medium thumbnail — faster, cheaper, same accuracy
4. **Cache results:** Store labels in DynamoDB, never re-scan the same image
5. **MinConfidence: 60:** Reduces API response size and processing
6. **Graceful degradation:** If Rekognition fails/throttles, allow the image (don't block uploads)

---

## Testing

- [ ] Upload known NSFW test image → verify it gets `status: "hidden"`
- [ ] Upload normal event photo → verify it gets `status: "visible"`
- [ ] Upload borderline image → verify it gets `status: "flagged"`
- [ ] Test host approve action → media becomes visible
- [ ] Test host reject action → media stays hidden
- [ ] Test Rekognition failure → media defaults to visible
- [ ] Verify free/paid events skip Rekognition entirely
- [ ] Check moderation dashboard shows correct counts
