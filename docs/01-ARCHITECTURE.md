# Architecture

## High-Level Architecture

```
                         ┌─────────────────┐
                         │   CloudFront     │
                         │   (CDN + WAF)    │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐
              │  S3 Static │ │ API GW  │ │ S3 Media    │
              │  Website   │ │ HTTP    │ │ (Private)   │
              │  (React)   │ │ API     │ │             │
              └────────────┘ └────┬────┘ └─────────────┘
                                  │
                           ┌──────▼──────┐
                           │   Lambda    │
                           │  Functions  │
                           └──────┬──────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐
              │ DynamoDB   │ │   S3    │ │ Recurrente  │
              │ (metadata) │ │ (media) │ │  (payments) │
              └────────────┘ └─────────┘ └─────────────┘
```

## Component Details

### 1. Frontend (S3 + CloudFront)

- **React SPA** built with Vite (smallest bundle, fast builds)
- Static export deployed to S3
- CloudFront distribution with custom domain
- Service Worker for offline support / local-first uploads
- Client-side image compression (browser-image-compression library)
- IndexedDB for queue-based upload (retry on failure)

**Cost when idle:** $0.00 (S3 static hosting is pennies, CloudFront free tier: 1TB/month)

### 2. API Gateway (HTTP API)

- **HTTP API** (not REST API) — 70% cheaper
- Routes:
  - `POST /events` — create event (host)
  - `POST /events/{id}/auth` — authenticate (host or guest)
  - `POST /events/{id}/upload-url` — get presigned upload URL
  - `GET /events/{id}` — get event metadata
  - `PATCH /events/{id}` — update event (host only)
  - `GET /events/{id}/media` — list media items
  - `POST /events/{id}/media/{mediaId}/reactions` — add reaction
  - `POST /events/{id}/media/{mediaId}/comments` — add comment
  - `POST /events/{id}/checkout` — create payment checkout
  - `POST /webhooks/recurrente` — payment webhook handler

**Cost when idle:** $0.00

### 3. Lambda Functions

- **Runtime:** Node.js 22.x (or Python 3.12)
- **Memory:** 128MB default (256MB for image processing)
- **Architecture:** ARM64 (Graviton2) — 20% cheaper
- **Bundling:** ESBuild for minimal cold starts

Functions:
| Function | Purpose | Memory |
|---|---|---|
| createEvent | Create event + hash password | 128MB |
| authEvent | Validate password, issue session token | 128MB |
| getUploadUrl | Generate presigned S3 PUT URL | 128MB |
| getEvent | Return event metadata | 128MB |
| updateEvent | Update event details (host) | 128MB |
| listMedia | Paginated media listing | 128MB |
| addReaction | Add emoji/sticker reaction | 128MB |
| addComment | Add comment to media | 128MB |
| createCheckout | Create Recurrente checkout | 128MB |
| handleWebhook | Process payment webhooks | 128MB |
| processUpload | S3 trigger: generate thumbnail | 256MB |

**Cost when idle:** $0.00

### 4. DynamoDB

- **Billing mode:** On-demand (pay per request)
- **Tables:** Single-table design (see `02-DATABASE-SCHEMA.md`)
- **Streams:** Enabled for media count tracking
- **TTL:** Enabled for auto-deletion of free-tier events

**Cost when idle:** $0.00 (on-demand = zero base cost)

### 5. S3 Media Bucket

- **Block Public Access:** ALL enabled
- **Encryption:** SSE-S3 (free)
- **Versioning:** Disabled (saves cost)
- **Lifecycle rules:**
  - Free tier: delete 30 days after event end
  - Paid tier: transition to S3 Glacier after 90 days
  - Premium: transition to Glacier Deep Archive after 180 days
- **CORS:** Configured for presigned PUT uploads from frontend origin

**Cost when idle:** Storage cost only ($0.023/GB/month Standard, $0.004/GB Glacier)

### 6. CloudFront (Media Distribution)

- Serves media via **signed URLs** (not public)
- Origin Access Control (OAC) to S3
- Cache policy: 24h for media, 5min for API
- Custom error pages for 403/404

### 7. AWS WAF

- Attached to CloudFront distribution
- Rules:
  - Rate limiting (100 requests/5min per IP)
  - Bot control (managed rule group)
  - IP reputation list
  - Size restriction rule (block requests > 10MB body)

**Cost:** $5/month base + $0.60/million requests (consider skipping at MVP if budget-tight)

## Near-Zero Idle Cost Breakdown

| Service | Idle Cost |
|---|---|
| S3 (static site) | ~$0.01/month |
| CloudFront | $0.00 (free tier) |
| API Gateway | $0.00 |
| Lambda | $0.00 |
| DynamoDB | $0.00 (on-demand) |
| S3 (media) | $0.023/GB stored |
| WAF | ~$5/month (optional at MVP) |
| **Total idle** | **~$0.01 + storage** |

## Scaling Model

At 1,000 events/month with 200 guests each:
- API calls: ~2M/month → ~$2
- Lambda: ~2M invocations → ~$0.40
- DynamoDB: ~10M reads, 5M writes → ~$15
- S3 storage: ~3TB → ~$70
- CloudFront transfer: ~1TB → free tier
- **Total: ~$90/month**
- **Revenue at $9/event: $9,000/month**
- **Margin: >98%**
