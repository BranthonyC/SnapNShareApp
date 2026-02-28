# Rekognition Configuration

## Purpose

NSFW/content moderation for **Premium events only**. Uses the `DetectModerationLabels` API to automatically detect and flag inappropriate content before it becomes visible to event guests.

---

## API: DetectModerationLabels

### Request

- **Input:** S3 object reference (bucket + key)
- **MinConfidence:** 60
- **Returns:** Array of moderation labels with Parent/Name/Confidence

```bash
aws rekognition detect-moderation-labels \
  --image '{"S3Object":{"Bucket":"eventalbum-prod-media","Name":"events/evt_abc123/img_001.jpg"}}' \
  --min-confidence 60 \
  --profile codersatelier
```

### Response Shape

```json
{
  "ModerationLabels": [
    {
      "Confidence": 95.2,
      "Name": "Explicit Nudity",
      "ParentName": "",
      "TaxonomyLevel": 1
    },
    {
      "Confidence": 95.2,
      "Name": "Nudity",
      "ParentName": "Explicit Nudity",
      "TaxonomyLevel": 2
    }
  ],
  "ModerationModelVersion": "7.0",
  "ContentTypes": [
    {
      "Confidence": 99.8,
      "Name": "Photo"
    }
  ]
}
```

---

## Moderation Labels We Care About

| Label | Confidence | Action |
|---|---|---|
| Explicit Nudity (any sub-label) | >= 80 | Auto-hide, flag for host review |
| Suggestive | >= 80 | Flag for host review |
| Violence | >= 80 | Auto-hide, flag for host review |
| Drugs | >= 80 | Flag for host review |
| Any label | 60-79 | Flag for review but do NOT auto-hide |
| Any label | < 60 | Ignore (below MinConfidence threshold) |

### Full Taxonomy (Relevant Sub-Labels)

```
Explicit Nudity
├── Nudity
├── Graphic Male Nudity
├── Graphic Female Nudity
├── Sexual Activity
├── Illustrated Explicit Nudity
└── Adult Toys

Suggestive
├── Female Swimwear Or Underwear
├── Male Swimwear Or Underwear
├── Partial Nudity
├── Barechested Male
├── Revealing Clothes
└── Sexual Situations

Violence
├── Graphic Violence Or Gore
├── Physical Violence
├── Weapon Violence
├── Weapons
└── Self Injury

Drugs
├── Drug Products
├── Drug Use
├── Pills
└── Drug Paraphernalia
```

---

## Integration Point

Called from `processUpload` Lambda (S3 trigger). Only invoked for events where `tier === 'premium'`.

### Media Status Flow

```
Upload → processUpload Lambda
  ├── if tier !== 'premium':
  │   └── status = 'visible' (no moderation)
  ├── if tier === 'premium' AND autoApprove === true:
  │   └── status = 'visible' (skip Rekognition entirely)
  └── if tier === 'premium' AND autoApprove === false:
      └── Call DetectModerationLabels
          ├── if no flags:
          │   └── status = 'visible'
          ├── if any flag >= 80 confidence (Explicit Nudity or Violence):
          │   └── status = 'hidden', moderationLabels stored in DynamoDB
          ├── if any flag >= 80 confidence (Suggestive or Drugs):
          │   └── status = 'pending_review', moderationLabels stored in DynamoDB
          └── if flags 60-79 confidence only:
              └── status = 'pending_review', moderationLabels stored in DynamoDB
```

### DynamoDB Storage

When moderation flags are detected, store in the media item:

```json
{
  "PK": "EVT#evt_abc123",
  "SK": "MEDIA#img_001",
  "status": "hidden",
  "moderationLabels": [
    {"name": "Explicit Nudity", "confidence": 95.2},
    {"name": "Nudity", "confidence": 95.2}
  ],
  "moderatedAt": "2026-03-15T16:00:00Z"
}
```

### Lambda Code (processUpload)

```javascript
import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';

const rekognition = new RekognitionClient();

export async function moderateImage(bucket, key) {
  const command = new DetectModerationLabelsCommand({
    Image: {
      S3Object: { Bucket: bucket, Name: key }
    },
    MinConfidence: 60
  });

  const response = await rekognition.send(command);
  const labels = response.ModerationLabels || [];

  if (labels.length === 0) {
    return { status: 'visible', labels: [] };
  }

  const highConfidence = labels.filter(l => l.Confidence >= 80);
  const autoHideCategories = ['Explicit Nudity', 'Violence', 'Graphic Violence Or Gore'];
  const shouldAutoHide = highConfidence.some(l =>
    autoHideCategories.includes(l.Name) || autoHideCategories.includes(l.ParentName)
  );

  return {
    status: shouldAutoHide ? 'hidden' : 'pending_review',
    labels: labels.map(l => ({
      name: l.Name,
      parent: l.ParentName,
      confidence: Math.round(l.Confidence * 10) / 10
    }))
  };
}
```

---

## Host Review Workflow

1. Host receives email notification: "1 new photo flagged for review"
2. Host opens event dashboard, sees flagged media with blur overlay
3. Host sees moderation labels and confidence scores
4. Host chooses: **Approve** (status -> 'visible') or **Delete** (hard delete from S3 + DynamoDB)
5. If host takes no action within 7 days, auto-delete hidden items

---

## IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "rekognition:DetectModerationLabels",
      "Resource": "*"
    }
  ]
}
```

Note: Rekognition does not support resource-level permissions for `DetectModerationLabels`. The `*` resource is required and acceptable here.

### SAM Template

```yaml
ProcessUploadFunction:
  Type: AWS::Serverless::Function
  Properties:
    Policies:
      - Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action: rekognition:DetectModerationLabels
            Resource: '*'
```

---

## Pricing

| Tier | Cost per Image | Notes |
|---|---|---|
| First 1M images/month | $0.001 | Standard pricing |
| 1M-10M images/month | $0.0008 | Volume discount |
| Free tier | 5,000 images/month | First 12 months of AWS account only |

### Video Moderation (Not Using)

- $0.10/minute — too expensive for MVP
- Future: Consider for Premium video uploads if demand exists

### Cost Projections

| Scenario | Monthly Images | Monthly Cost |
|---|---|---|
| Idle (no events) | 0 | $0.00 |
| 10 Premium events, 200 uploads each | 2,000 | $2.00 |
| 50 Premium events, 500 uploads each | 25,000 | $25.00 |
| 100 Premium events, 1000 uploads each | 100,000 | $100.00 |

---

## Cost at Idle

**$0.00/month** — pay per API call only. No provisioned capacity, no minimum charges.

---

## Limits & Quotas

| Limit | Value | Adjustable |
|---|---|---|
| Max image size | 5 MB (S3) / 5 MB (bytes) | No |
| Min image dimension | 80 x 80 pixels | No |
| Max image dimension | 4096 x 4096 pixels | No |
| Supported formats | JPEG, PNG | No |
| Transactions per second | 5 (default) | Yes — request increase |
| Max images per DetectModerationLabels call | 1 | No |

### TPS Scaling

Default TPS is 5. For event bursts (many simultaneous uploads), request a quota increase:

```bash
aws service-quotas request-service-quota-increase \
  --service-code rekognition \
  --quota-code L-5765E3E4 \
  --desired-value 20 \
  --profile codersatelier
```

---

## Error Handling

| Error | Cause | Handling |
|---|---|---|
| `ImageTooLargeException` | Image > 5 MB | Should not happen (client compresses). Set status = 'visible', log warning |
| `InvalidImageFormatException` | Not JPEG/PNG | Set status = 'visible', log warning |
| `ProvisionedThroughputExceededException` | TPS exceeded | Retry with exponential backoff (3 attempts) |
| `ThrottlingException` | Regional throttle | Retry with exponential backoff (3 attempts) |
| Any other error | Service issue | Set status = 'visible', log error. Do not block upload |

**Principle:** Never block an upload because moderation failed. Default to visible and log the error for manual review.
