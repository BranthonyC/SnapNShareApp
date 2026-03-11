# Updating Plan Limits, Features & Pricing

This guide explains exactly what to update when you change tier limits, features, or pricing for EventAlbum.

---

## Quick Reference: Where Tier Data Lives

| Source | File / Location | What It Controls |
|---|---|---|
| **SSM Parameter Store** | `/eventalbum/config/tiers/{basic,paid,premium}` | Upload limits, file sizes, media types, storage, feature flags |
| **SSM Parameter Store** | `/eventalbum/config/pricing` | Prices in cents (GTQ + USD) |
| **Backend: getConfig** | `backend/functions/getConfig/index.mjs` lines 6-10 | Hardcoded pricing fallback (mirrors SSM) |
| **Backend: createCheckout** | `backend/functions/createCheckout/index.mjs` lines 10-15 | Hardcoded pricing for Recurrente checkout |
| **Frontend: LandingPage** | `frontend/src/pages/landing/LandingPage.tsx` lines 44-97 | Pricing display on landing page |
| **Frontend: CheckoutPage** | `frontend/src/pages/checkout/CheckoutPage.tsx` lines 40-94 | Tier cards in checkout wizard |

---

## Step-by-Step: Changing Upload Limits

### Example: Change Basic from 150 to 200 uploads

**1. Update SSM (source of truth)**

```bash
# First, get current value
aws ssm get-parameter \
  --name "/eventalbum/config/tiers/basic" \
  --region us-east-1 --profile codersatelier \
  --query 'Parameter.Value' --output text | python3 -m json.tool

# Update with new uploadLimit
aws ssm put-parameter \
  --name "/eventalbum/config/tiers/basic" \
  --type String \
  --overwrite \
  --value '{"uploadLimit":200,"maxFileSizeBytes":2097152,"mediaTypes":["image"],"storageDays":15,"requireOtp":false,"features":["image","reactions","comments"]}' \
  --region us-east-1 --profile codersatelier
```

**2. Update getConfig fallback** — `backend/functions/getConfig/index.mjs`

Find the `basic` block (line ~26) and change:
```js
uploadLimit: tiers.basic?.uploadLimit ?? 200,  // was 50
```

**3. Update frontend landing page** — `frontend/src/pages/landing/LandingPage.tsx`

Find the Basic tier in `PRICING` array (line ~52):
```ts
features: [
  '200 fotos por evento',  // was '50 fotos por evento'
  ...
]
```

**4. Update frontend checkout** — `frontend/src/pages/checkout/CheckoutPage.tsx`

Find the Basic tier in `TIERS` array (line ~47):
```ts
uploads: 200,  // was 150
features: [
  '200 fotos por evento',  // was '150 fotos por evento'
  ...
]
```

**5. Deploy changes**

```bash
# Deploy only the changed Lambda function (fast)
cd /Users/branthonycc/Sideprojects/EventAlbum
sam build GetConfigFunction && \
sam deploy --no-confirm-changeset --region us-east-1 --profile codersatelier

# Rebuild and deploy frontend
cd frontend
npm run build
aws s3 sync dist/ s3://eventalbum-frontend-dev --delete --profile codersatelier
aws cloudfront create-invalidation --distribution-id ETD7K4TJ66IK6 --paths "/*" --profile codersatelier
```

> **Note:** SSM changes take effect on next Lambda cold start (typically within 15 min). To force: redeploy the function or update any env var.

---

## Step-by-Step: Changing Pricing

### Example: Change Paid from $15 to $12 USD

**1. Update SSM pricing**

```bash
aws ssm put-parameter \
  --name "/eventalbum/config/pricing" \
  --type String \
  --overwrite \
  --value '{"basic":{"GTQ":800,"USD":100},"paid":{"GTQ":9300,"USD":1200},"premium":{"GTQ":23200,"USD":3000}}' \
  --region us-east-1 --profile codersatelier
```

> Amounts are in **cents**: $12.00 = `1200`, Q93.00 = `9300`

**2. Update backend hardcoded prices**

Edit **two** files:

`backend/functions/getConfig/index.mjs` (line 8):
```js
paid: { GTQ: 9300, USD: 1200 },
```

`backend/functions/createCheckout/index.mjs` (line 13):
```js
paid: { GTQ: 9300, USD: 1200 },
```

**3. Update frontend**

`frontend/src/pages/landing/LandingPage.tsx` (line ~62):
```ts
price: '$12',
```

`frontend/src/pages/checkout/CheckoutPage.tsx` (line ~60):
```ts
priceUSD: 12,
priceGTQ: 93,
```

**4. Deploy**

```bash
# Backend (both functions)
cd /Users/branthonycc/Sideprojects/EventAlbum
sam build GetConfigFunction CreateCheckoutFunction && \
sam deploy --no-confirm-changeset --region us-east-1 --profile codersatelier

# Frontend
cd frontend && npm run build
aws s3 sync dist/ s3://eventalbum-frontend-dev --delete --profile codersatelier
aws cloudfront create-invalidation --distribution-id ETD7K4TJ66IK6 --paths "/*" --profile codersatelier
```

---

## Step-by-Step: Changing Features per Tier

### Example: Enable video uploads for Basic tier

**1. Update SSM tier config**

```bash
aws ssm get-parameter --name "/eventalbum/config/tiers/basic" \
  --region us-east-1 --profile codersatelier \
  --query 'Parameter.Value' --output text | python3 -m json.tool

# Add "video" media types and feature
aws ssm put-parameter \
  --name "/eventalbum/config/tiers/basic" \
  --type String --overwrite \
  --value '{"uploadLimit":150,"maxFileSizeBytes":5242880,"mediaTypes":["image","video"],"storageDays":15,"requireOtp":false,"features":["image","video","reactions","comments"]}' \
  --region us-east-1 --profile codersatelier
```

**2. Update getConfig** — `backend/functions/getConfig/index.mjs`

In the `basic` block, update:
```js
mediaTypes: tiers.basic?.mediaTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
// ...
features: {
  // ...
  video: true,  // was false
}
```

**3. Update frontend feature lists**

`frontend/src/pages/landing/LandingPage.tsx` — add "Videos incluidos" to Basic features
`frontend/src/pages/checkout/CheckoutPage.tsx` — add "Videos incluidos" to Basic features

**4. Update SettingsPage tier gating** — `frontend/src/pages/host/SettingsPage.tsx`

If you want Basic hosts to toggle video in settings, update line ~287:
```ts
// Remove the tier gate for allowVideo
disabled={false}  // was: disabled={!isPaidOrPremium}
```

**5. Deploy** (same pattern as above)

---

## Step-by-Step: Adding a New Tier

### Example: Add "Pro" tier between Paid and Premium

**1. Create SSM parameter**

```bash
aws ssm put-parameter \
  --name "/eventalbum/config/tiers/pro" \
  --type String \
  --value '{"uploadLimit":750,"maxFileSizeBytes":31457280,"mediaTypes":["image","video"],"storageDays":365,"requireOtp":true,"features":["image","video","reactions","comments","downloads","otp","analytics"]}' \
  --region us-east-1 --profile codersatelier
```

**2. Update SSM pricing**

```bash
aws ssm put-parameter --name "/eventalbum/config/pricing" --type String --overwrite \
  --value '{"basic":{"GTQ":800,"USD":100},"paid":{"GTQ":11600,"USD":1500},"pro":{"GTQ":17400,"USD":2250},"premium":{"GTQ":23200,"USD":3000}}' \
  --region us-east-1 --profile codersatelier
```

**3. Update backend files**

- `backend/shared/nodejs/config.mjs` — add `pro` to `getTierConfig()` Promise.all
- `backend/functions/getConfig/index.mjs` — add `pro` tier block + pricing entry
- `backend/functions/createCheckout/index.mjs` — add `pro` to PRICES + tier validation
- `backend/functions/getUploadUrl/index.mjs` — no changes needed (reads tier from event)
- `backend/functions/downloadZip/index.mjs` — add `pro` to allowed tiers check

**4. Update frontend files**

- `frontend/src/pages/landing/LandingPage.tsx` — add Pro card to PRICING array
- `frontend/src/pages/checkout/CheckoutPage.tsx` — add Pro card to TIERS array
- `frontend/src/pages/host/SettingsPage.tsx` — add `isProOrHigher` gate if needed

**5. Deploy everything** (full `sam build && sam deploy` + frontend rebuild)

---

## Deploying a Single Lambda Function

You do NOT need to deploy the entire stack for a single function fix:

```bash
# Build only the function you changed
cd /Users/branthonycc/Sideprojects/EventAlbum
sam build <FunctionLogicalId>

# Deploy (only changed resources update)
sam deploy --no-confirm-changeset --region us-east-1 --profile codersatelier
```

**Function logical IDs** (from template.yaml):

| Function | Logical ID |
|---|---|
| getConfig | `GetConfigFunction` |
| createCheckout | `CreateCheckoutFunction` |
| createEvent | `CreateEventFunction` |
| authEvent | `AuthEventFunction` |
| getEvent | `GetEventFunction` |
| getUploadUrl | `GetUploadUrlFunction` |
| listMedia | `ListMediaFunction` |
| processUpload | `ProcessUploadFunction` |
| updateEvent | `UpdateEventFunction` |
| deleteEvent | `DeleteEventFunction` |
| updateSettings | `UpdateSettingsFunction` |
| sendOtp | `SendOtpFunction` |
| verifyOtp | `VerifyOtpFunction` |
| hostLogin | `HostLoginFunction` |
| hostVerify | `HostVerifyFunction` |
| downloadZip | `DownloadZipFunction` |
| addReaction | `AddReactionFunction` |
| addComment | `AddCommentFunction` |
| listComments | `ListCommentsFunction` |
| getStats | `GetStatsFunction` |
| getActivity | `GetActivityFunction` |
| validatePromo | `ValidatePromoFunction` |
| handleWebhook | `WebhookFunction` |
| moderateMedia | `ModerateMediaFunction` |
| reportMedia | `ReportMediaFunction` |
| deleteMedia | `DeleteMediaFunction` |
| bulkDeleteMedia | `BulkDeleteMediaFunction` |
| clearAllMedia | `ClearAllMediaFunction` |
| searchMedia | `SearchMediaFunction` |
| getStorage | `GetStorageFunction` |
| getQrStats | `GetQrStatsFunction` |
| cleanupExpired | `CleanupExpiredFunction` |
| notifyUploads | `NotifyUploadsFunction` |
| eventSummary | `EventSummaryFunction` |

**Even faster — update just the code** (skips CloudFormation):

```bash
# Zip and upload directly (no SAM build/deploy needed)
cd backend/functions/getConfig
zip -j /tmp/func.zip index.mjs
aws lambda update-function-code \
  --function-name EventAlbum-dev-getConfig \
  --zip-file fileb:///tmp/func.zip \
  --region us-east-1 --profile codersatelier
```

---

## Current Tier Values (as of 2026-02-28)

| | Basic | Paid | Premium |
|---|---|---|---|
| **Price (USD)** | $1 | $15 | $30 |
| **Price (GTQ)** | Q8 | Q116 | Q232 |
| **Upload limit** | 150 | 500 | 1,000 |
| **Max file size** | 2 MB | 25 MB | 50 MB |
| **Media types** | Images only | Images + Video | Images + Video + Audio |
| **Storage** | 15 days | 180 days (6 mo) | 730 days (2 yr, Glacier) |
| **OTP required** | No | Yes | Yes |
| **Downloads** | No | Yes | Yes |
| **Auto-approve** | No | No | Yes |
| **NSFW moderation** | No | No | Yes |
| **Analytics** | No | Yes | Yes |
| **Custom branding** | No | No | Yes |

---

## Checklist: After Any Plan Change

- [ ] SSM parameter updated (source of truth)
- [ ] `getConfig/index.mjs` fallback values updated
- [ ] `createCheckout/index.mjs` PRICES updated (if pricing changed)
- [ ] `LandingPage.tsx` PRICING array updated
- [ ] `CheckoutPage.tsx` TIERS array updated
- [ ] `SettingsPage.tsx` tier gates updated (if features changed)
- [ ] Backend deployed (`sam build && sam deploy`)
- [ ] Frontend rebuilt and deployed (`npm run build` + S3 sync + CloudFront invalidation)
- [ ] Docs updated (`docs/07-FREEMIUM-MODEL.md` if you want to keep docs in sync)
