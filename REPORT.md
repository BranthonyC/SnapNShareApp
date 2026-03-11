# EventAlbum — Final Build Report

**Date:** 2026-02-28
**Stack:** `eventalbum-dev` | **Region:** `us-east-1` | **Profile:** `codersatelier`

---

## What Works

### Infrastructure (AWS)
- **34 Lambda functions** deployed and reachable via API Gateway HTTP API
- **DynamoDB** table `EventAlbum-dev` (single-table, on-demand, GSI1 + GSI2)
- **S3 buckets:** `eventalbum-media-dev` (private, OAC) + `eventalbum-frontend-dev` (private, OAC)
- **2 CloudFront distributions:** frontend (`ETD7K4TJ66IK6`) + media CDN (`E23ZDLZ79SPU31`)
- **Custom domains:** `eventalbum.codersatelier.com` (frontend) + `eventalbum-cdn.codersatelier.com` (media)
- **ACM certificate** wildcard `*.codersatelier.com` attached to both distributions
- **SES** domain verified (`codersatelier.com` with DKIM)
- **SSM parameters:** JWT secret, CloudFront key pair, tier configs, pricing, Recurrente keys
- **EventBridge schedules:** `notifyUploads` (30min), `eventSummary` (daily), `cleanupExpired` (daily)
- **API Gateway** access logging to CloudWatch (`/aws/apigateway/EventAlbum-dev`)

### Frontend (React 19 + Vite + Tailwind)
- **14 pages** fully implemented in Spanish (Guatemala market)
- **141KB gzipped** total bundle (code-split: vendor 17KB, react-query 11KB, app 107KB)
- TypeScript strict mode — **zero errors**
- Mobile-first (390x844 viewport base)
- Landing page with hero, how-it-works, pricing ($1/$15/$30)
- Guest flow: event entry, gallery (masonry + infinite scroll), upload (drag-drop + camera), media view
- Host flow: OTP login, dashboard, edit event, QR, moderation, gallery management, settings
- Checkout: 3-step wizard with tier selection and promo codes
- Client-side image compression (browser-image-compression)
- IndexedDB upload queue with retry
- Error boundary, toast notifications, 404 page, scroll-to-top

### Backend (Node.js 22, ARM64, ESM)
- All 34 Lambda functions pass `node --check`
- Shared layer with: DynamoDB client, JWT auth, SES email, SSM config loader, validation
- Email-first OTP (SES) with SMS fallback (SNS) after 3 failed verifications
- Recurrente payment integration (GTQ + USD)
- Content moderation support (Rekognition ready in `processUpload`)
- Presigned S3 URLs for uploads, CloudFront signed URLs for media
- Cursor-based pagination on all list endpoints

### Cypress E2E Tests
- **21 test specs** covering all 14 sequence diagrams from docs
- Support file with custom commands (`setToken`, `visitAdmin`, `stubApi`)
- 4 fixture files (event, media, stats, config)
- Flow tests trace full user journeys: guest lifecycle, OTP verification, host admin, checkout

---

## What Needs Manual Testing / Attention

### DNS (Resolving Now)
- Route53 alias records just created — propagation takes 1-5 minutes
- `eventalbum.codersatelier.com` → CloudFront frontend
- `eventalbum-cdn.codersatelier.com` → CloudFront media CDN
- Flush local DNS if needed: `sudo dscacheutil -flushcache`

### SES Sandbox
- SES is in **sandbox mode** — can only send to verified email addresses
- To send OTP emails to any address: request production access in AWS Console → SES → Account Dashboard → Request Production Access
- Until then, verify test email addresses: `aws sesv2 create-email-identity --email-identity test@example.com --region us-east-1 --profile codersatelier`

### Lambda Cold Starts
- All functions are 128MB ARM64 — expect 800ms-2s cold start on first invocations
- Consider setting `ProvisionedConcurrency: 1` on critical paths (createEvent, authEvent) if cold starts are unacceptable

### processUpload — Sharp Thumbnails
- Sharp library for thumbnail generation is NOT bundled (needs Lambda Layer with native binaries for ARM64)
- Current implementation validates magic bytes and updates DDB but skips thumbnail generation
- **Action needed:** Create a Sharp Lambda Layer or use a Docker build for native deps

### Recurrente Webhooks
- Webhook URL needs to be configured in Recurrente dashboard:
  `https://bf3ohl9kaj.execute-api.us-east-1.amazonaws.com/dev/webhooks/recurrente`
- Currently using API callback verification (no HMAC signature)

### CloudFront Signed URLs
- Media CDN requires CloudFront signed URLs for private content
- Key pair is created (`K2XRS7N4NP67HY`) but Lambda functions need the **private key** stored in SSM
- **Action needed:** Store the private key PEM file:
  ```
  aws ssm put-parameter \
    --name "/eventalbum/secrets/cf-private-key" \
    --value "$(cat cf-private-key.pem)" \
    --type SecureString \
    --region us-east-1 \
    --profile codersatelier
  ```

### EventBridge Scheduled Jobs
- `notifyUploads`, `eventSummary`, `cleanupExpired` are deployed with schedules
- `notifyUploads` and `eventSummary` have partial implementations (DDB scan + SES send stubs)
- `cleanupExpired` has full S3 cleanup logic

---

## Architecture Summary

```
User → eventalbum.codersatelier.com (CloudFront) → S3 (React SPA)
     → API Gateway HTTP API → 34 Lambda Functions → DynamoDB
     → eventalbum-cdn.codersatelier.com (CloudFront + OAC) → S3 (media)
     → SES (OTP emails) / SNS (SMS fallback)
     → Recurrente API (payments)
     → EventBridge (scheduled jobs)
```

## Costs (Estimated Idle)
- **$0.00/mo** at zero traffic (all serverless, on-demand)
- DynamoDB: $0 (on-demand, no reads/writes at idle)
- Lambda: $0 (free tier: 1M requests/mo)
- S3: ~$0.01/mo (bucket existence)
- CloudFront: $0 (free tier: 1TB/mo)
- API Gateway: $0 (free tier: 1M requests/mo)

---

## File Count
| Category | Count |
|---|---|
| Backend Lambda functions | 34 |
| Backend shared modules | 7 |
| Frontend pages | 14 |
| Frontend components/hooks/services | 12 |
| Config/scaffold files | 12 |
| Cypress test specs | 21 |
| Cypress support/fixtures | 6 |
| **Total** | **~106** |

## Next Steps
1. Flush DNS cache and verify `https://eventalbum.codersatelier.com` loads
2. Request SES production access
3. Store CloudFront private key in SSM
4. Create Sharp Lambda Layer for thumbnail generation
5. Configure Recurrente webhook URL
6. Run `npm run cy:open` (from `frontend/`) to execute Cypress tests against local dev server
7. Set up CI/CD (GitHub Actions) for automated deploys
