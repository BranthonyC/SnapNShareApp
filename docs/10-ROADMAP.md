# Development Roadmap

## Phase 0: Foundation (Week 1)

**Goal:** Project scaffold, local development working.

- [ ] Initialize React project with Vite + TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up SAM template with basic resources
- [ ] Create DynamoDB table (single-table design)
- [ ] Create S3 buckets (media + frontend)
- [ ] Set up project structure (frontend/ + backend/)
- [ ] Create shared backend utilities (DynamoDB client, response helpers, auth)
- [ ] Deploy empty stack to dev environment
- [ ] Verify `sam local start-api` works

**Deliverable:** Empty app deploys to AWS, local dev works.

---

## Phase 1: Core Event Flow (Weeks 2-3)

**Goal:** Host can create event, guests can authenticate and upload photos.

### Backend
- [ ] `createEvent` Lambda — validate input, hash password, store in DynamoDB
- [ ] `authEvent` Lambda — verify password, issue JWT
- [ ] `getEvent` Lambda — return event metadata
- [ ] `getUploadUrl` Lambda — validate limits, generate presigned S3 URL
- [ ] `processUpload` Lambda — S3 trigger, validate file magic bytes, generate thumbnail
- [ ] `listMedia` Lambda — paginated media listing with signed URLs

### Frontend
- [ ] Create Event page — form with validation
- [ ] Guest Entry page — password input, auth flow
- [ ] Gallery page — masonry grid, lazy loading, infinite scroll
- [ ] Upload flow — file picker, client-side compression, progress bar
- [ ] Basic responsive layout (mobile-first)

### Infrastructure
- [ ] CloudFront distribution for media (signed URLs)
- [ ] S3 CORS configuration
- [ ] API Gateway routes

**Deliverable:** End-to-end flow works — create event → share QR → guests upload photos → gallery displays them.

---

## Phase 2: Engagement Features (Week 4)

**Goal:** Reactions, comments, and better UX.

### Backend
- [ ] `addReaction` Lambda — toggle emoji reactions
- [ ] `addComment` Lambda — add comment with sanitization
- [ ] `listComments` Lambda — paginated comments
- [ ] `updateEvent` Lambda — host edits event details

### Frontend
- [ ] Media detail view — full-screen with swipe
- [ ] Emoji reaction bar (3 basic emojis for free tier)
- [ ] Comment thread on media detail
- [ ] Host admin panel — edit event, view stats
- [ ] Welcome card customization (cover image, footer text)
- [ ] QR code generation and download

**Deliverable:** Interactive gallery with social features.

---

## Phase 3: Freemium + Payments (Week 5)

**Goal:** Monetization via Recurrente.

### Backend
- [ ] `createCheckout` Lambda — create Recurrente checkout session
- [ ] `handleWebhook` Lambda — process payment webhooks, upgrade tier
- [ ] Tier enforcement in all Lambda functions (upload limits, file types, sizes)
- [ ] Register Recurrente webhook endpoint

### Frontend
- [ ] Upgrade prompt UI (upload counter, watermark, soft walls)
- [ ] Embedded Recurrente checkout (iframe)
- [ ] Payment success/failure handling
- [ ] Tier badge display on event
- [ ] Download ZIP button (paid only)

### Configuration
- [ ] Recurrente TEST keys in dev
- [ ] Test full payment flow in sandbox

**Deliverable:** Hosts can upgrade events, free/paid enforcement works.

---

## Phase 4: Polish + Security Hardening (Week 6)

**Goal:** Production-ready quality and security.

### Security
- [ ] File magic byte validation in processUpload
- [ ] Rate limiting on auth endpoint (DynamoDB-based)
- [ ] CAPTCHA on event creation (hCaptcha)
- [ ] S3 lifecycle rules (30-day deletion, Glacier transition)
- [ ] DynamoDB TTL for free events
- [ ] CloudFront security headers
- [ ] Input sanitization audit (XSS prevention)
- [ ] API Gateway throttling configuration

### Polish
- [ ] Landing page with pricing
- [ ] Loading states and error handling throughout
- [ ] Toast notifications
- [ ] PWA manifest + service worker
- [ ] SEO meta tags
- [ ] 404 page
- [ ] Terms of service + privacy policy pages

### Testing
- [ ] Unit tests for Lambda functions (vitest)
- [ ] Integration tests for critical flows
- [ ] Load testing (Artillery or k6)
- [ ] Security audit checklist verification

**Deliverable:** App is production-ready, secure, polished.

---

## Phase 5: Launch (Week 7)

**Goal:** Go live.

- [ ] Switch to Recurrente LIVE keys
- [ ] Deploy to prod environment
- [ ] Custom domain setup (eventalbum.app)
- [ ] SSL certificate (ACM)
- [ ] CloudFront prod distribution
- [ ] Smoke test full flow in production
- [ ] Monitor CloudWatch metrics
- [ ] Set up billing alarms ($10, $25, $50 thresholds)
- [ ] Soft launch to friends/family events

**Deliverable:** Live product accepting real payments.

---

## Phase 6: Post-Launch Improvements (Weeks 8-12)

**Goal:** Iterate based on feedback.

- [ ] Offline upload queue (IndexedDB + service worker)
- [ ] AWS WAF rules
- [ ] Content moderation (Amazon Rekognition — paid tier)
- [ ] Host moderation controls (approve/reject uploads)
- [ ] Video player optimization
- [ ] Audio player UI
- [ ] Guest analytics for host
- [ ] Email notifications (SES — event reminders, download ready)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring dashboard (CloudWatch)
- [ ] Sticker/gift system

---

## Phase 7: Growth Features (Month 3+)

- [ ] Multi-language support (ES/EN)
- [ ] AI highlight reel (Amazon Rekognition + FFmpeg Lambda)
- [ ] Custom domains (Premium tier)
- [ ] Printed photobook partnership
- [ ] Branded QR printable kit
- [ ] Event templates (wedding, birthday, corporate)
- [ ] Sponsor mode for brand activations
- [ ] Referral program
- [ ] Mobile app wrapper (Capacitor or React Native)

---

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | React + Vite | User preference, cost-efficient static build |
| Backend runtime | Node.js 22 on Lambda | Same language as frontend, fast cold starts |
| Database | DynamoDB on-demand | Zero idle cost, single-table design |
| Auth | Custom JWT (no Cognito) | Zero cost, simpler |
| Payments | Recurrente | Guatemala market, simple API |
| IaC | AWS SAM | Simpler than CDK for Lambda-centric apps |
| API type | HTTP API (not REST) | 70% cheaper |
| Lambda arch | ARM64 | 20% cheaper |
| Image processing | Client-side compression | 85% storage savings |
| WAF | Deferred to Phase 6 | $5/month base cost, not needed at MVP |
| Secrets | Env vars at MVP | Free, upgrade to Secrets Manager later |
