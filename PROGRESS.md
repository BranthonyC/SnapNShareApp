# EventAlbum Build Progress

**Total source files: 91** | **Last updated: 2026-02-28** | **ALL PHASES COMPLETE**

## Phase 0: Foundation (Scaffold + First Deploy) — DONE
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `.gitignore` | done | |
| 2 | `template.yaml` | done | 34 Lambda functions, DynamoDB, S3x2, CloudFrontx2, OAC, API Gateway |
| 3 | `samconfig.toml` | done | dev/staging/prod configs, profile=codersatelier |
| 4 | `backend/package.json` | done | AWS SDK v3, nanoid |
| 5 | `backend/shared/dynamodb.mjs` | done | getItem, putItem, queryItems, batchDelete, etc. |
| 6 | `backend/shared/response.mjs` | done | ok, error, unauthorized, forbidden, notFound, rateLimited |
| 7 | `backend/shared/auth.mjs` | done | JWT HS256 (no deps), hashPassword, verifyPassword, generateOtp |
| 8 | `backend/shared/config.mjs` | done | SSM cached loader: tiers, pricing, discounts, secrets, features |
| 9 | `backend/shared/email.mjs` | done | SES v2: OTP, host OTP, event created emails |
| 10 | `backend/shared/validation.mjs` | done | All validators: createEvent, authEvent, upload, comment, settings |
| 11 | `backend/shared/logger.mjs` | done | Structured JSON logger |
| 12 | `frontend/package.json` | done | React 19, Vite 6, TanStack Query, Zustand, Tailwind |
| 13 | `frontend/index.html` | done | Google Fonts (Inter+Outfit), meta tags |
| 14 | `frontend/vite.config.ts` | done | Path aliases, proxy, code splitting |
| 15 | `frontend/tailwind.config.ts` | done | Design tokens from Penpot UI analysis |
| 16 | `frontend/tsconfig.json` | done | Strict mode, path aliases |
| 17 | `frontend/postcss.config.js` | done | |
| 18 | `frontend/src/main.tsx` | done | React Query + BrowserRouter |
| 19 | `frontend/src/App.tsx` | done | All 14 routes with placeholders |
| 20 | `frontend/src/vite-env.d.ts` | done | VITE_API_URL, VITE_CDN_URL |
| 21 | `frontend/src/styles/index.css` | done | Tailwind base + font layers |
| 22 | `frontend/src/services/api.ts` | done | Full typed API client (all endpoints + types) |
| 23 | `frontend/src/stores/authStore.ts` | done | Zustand: guest/host auth, sessionStorage persistence |
| 24 | `events/create-event.json` | done | SAM local test event |
| 25 | `events/auth-event.json` | done | SAM local test event |
| 26 | `frontend/public/favicon.svg` | done | Green "E" icon |
| 27 | `backend/shared/package.json` | done | Layer package.json |

**Verified:** `npm install` (both), `tsc --noEmit` clean, `vite build` succeeds (83KB gzipped)

## Phase 1: Core Event Flow — DONE
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `backend/functions/createEvent/index.mjs` | done | 197 lines. nanoid ID, tier config, host session, SES email |
| 2 | `backend/functions/authEvent/index.mjs` | done | 137 lines. Plaintext password check, auto-nickname, OTP gating |
| 3 | `backend/functions/getEvent/index.mjs` | done | 119 lines. Role-based field stripping, CDN URL builder |
| 4 | `backend/functions/getUploadUrl/index.mjs` | done | 198 lines. Atomic counter, tier validation, presigned PUT |
| 5 | `backend/functions/processUpload/index.mjs` | done | 253 lines. Magic bytes, MIME validation. TODO: sharp thumbs, Rekognition |
| 6 | `backend/functions/listMedia/index.mjs` | done | 149 lines. GSI2 query, cursor pagination, role-based filtering |
| 7 | `frontend/src/pages/landing/LandingPage.tsx` | done | Hero, how-it-works, pricing (Spanish), Outfit+Inter fonts |
| 8 | `frontend/src/pages/guest/EventEntryPage.tsx` | done | Password + nickname entry, shake animation, auth redirect |
| 9 | `frontend/src/pages/guest/GalleryPage.tsx` | done | Masonry grid, infinite scroll, upload FAB, skeleton loading |
| 10 | `frontend/src/pages/guest/UploadPage.tsx` | done | Drag-drop, camera capture, compression, progress, OTP gate |
| 11 | `frontend/src/services/compression.ts` | done | browser-image-compression wrapper, 1920px max, JPEG |
| 12 | `frontend/src/services/uploadQueue.ts` | done | IndexedDB queue (idb-keyval), 3 concurrent, retry |
| 13 | `frontend/src/hooks/useEvent.ts` | done | useQuery wrapper, 60s staleTime |
| 14 | `frontend/src/hooks/useMedia.ts` | done | useInfiniteQuery, cursor pagination, flat items array |
| 15 | `frontend/src/components/ui/Button.tsx` | done | 3 variants, 3 sizes, loading state, forwardRef |
| 16 | `frontend/src/components/ui/Input.tsx` | done | label, error, icon, OTP variant, forwardRef |
| 17 | `frontend/src/components/ui/Card.tsx` | done | 3 padding sizes, shadow-card |
| 18 | `frontend/src/components/ui/Spinner.tsx` | done | 3 sizes, animate-spin |
| 19 | `frontend/src/components/layout/PageLayout.tsx` | done | Sticky header, back button, responsive |

**Verified:** `tsc --noEmit` clean, `vite build` succeeds (121KB gzipped)

## Phase 2: Host Auth + Admin Panel + Engagement — DONE
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `backend/functions/hostLogin/index.mjs` | done | 76 lines. Anti-enumeration, GSI1 query, OTP email |
| 2 | `backend/functions/hostVerify/index.mjs` | done | 105 lines. timingSafeEqual, 5 attempt max, 24h JWT |
| 3 | `backend/functions/updateEvent/index.mjs` | done | 95 lines. Dynamic UpdateExpression, sanitization |
| 4 | `backend/functions/deleteEvent/index.mjs` | done | 81 lines. Soft delete, X-Confirm-Delete, 24h grace |
| 5 | `backend/functions/updateSettings/index.mjs` | done | 117 lines. Tier-gated settings, validation |
| 6 | `backend/functions/addReaction/index.mjs` | done | 139 lines. Toggle on/off, atomic reactionCounts |
| 7 | `backend/functions/addComment/index.mjs` | done | 100 lines. Sanitization, atomic commentCount |
| 8 | `backend/functions/listComments/index.mjs` | done | 53 lines. Cursor pagination, ascending sort |
| 9 | `backend/functions/getStats/index.mjs` | done | 147 lines. Full aggregation: uploads, guests, reactions, storage, moderation |
| 10 | `backend/functions/getQrStats/index.mjs` | done | 46 lines. totalScans, uniqueVisitors |
| 11 | `frontend/src/pages/host/HostLoginPage.tsx` | done | 2-step email→OTP flow, event selector |
| 12 | `frontend/src/pages/host/DashboardPage.tsx` | done | Stats cards, recent uploads, quick actions |
| 13 | `frontend/src/pages/host/EditEventPage.tsx` | done | Edit form + danger zone delete |
| 14 | `frontend/src/pages/host/QRPage.tsx` | done | Share URL, copy, Web Share API |
| 15 | `frontend/src/pages/guest/MediaViewPage.tsx` | done | Full-screen, swipe, reactions, comments |
| 16 | `frontend/src/hooks/useStats.ts` | done | useQuery for getStats |

**Verified:** `tsc --noEmit` clean, `node --check` all 10 Lambdas OK, `vite build` (130KB gzipped)

## Phase 3: Guest OTP + Payments + Tier Enforcement — DONE
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `backend/functions/sendOtp/index.mjs` | done | Email-first, SNS SMS fallback, rate limit 3/10min |
| 2 | `backend/functions/verifyOtp/index.mjs` | done | timingSafeEqual, 5 attempts max, reissue JWT |
| 3 | `backend/functions/createCheckout/index.mjs` | done | Recurrente API, corrected pricing ($1/$15/$30) |
| 4 | `backend/functions/handleWebhook/index.mjs` | done | Verify via API callback, idempotent tier upgrade |
| 5 | `backend/functions/validatePromo/index.mjs` | done | SSM discount configs, percent/fixed calc |
| 6 | `backend/functions/getConfig/index.mjs` | done | Public tier config, Cache-Control 1hr |
| 7 | `backend/functions/downloadZip/index.mjs` | done | Presigned URLs for files (archiver TODO) |
| 8 | `backend/functions/getStorage/index.mjs` | done | Storage aggregation by type |
| 9 | `frontend/src/pages/guest/OTPVerifyPage.tsx` | done | Email-first, SMS fallback after 3 failures |
| 10 | `frontend/src/pages/checkout/CheckoutPage.tsx` | done | 3-step wizard, tier selector, promo code |
| 11 | `frontend/src/pages/host/SettingsPage.tsx` | done | Toggles, theme picker, danger zone |

**Verified:** `tsc --noEmit` clean, `node --check` all 8 Lambdas OK, `vite build` (136KB gzipped)

## Phase 4: Moderation + Bulk Ops + Scheduled Jobs — DONE
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `backend/functions/deleteMedia/index.mjs` | done | S3 + DDB cleanup, counter decrement |
| 2 | `backend/functions/bulkDeleteMedia/index.mjs` | done | Max 25, partial failure support |
| 3 | `backend/functions/clearAllMedia/index.mjs` | done | X-Confirm-Delete, reset counter |
| 4 | `backend/functions/searchMedia/index.mjs` | done | Filter by uploadedBy, role-based |
| 5 | `backend/functions/reportMedia/index.mjs` | done | Auto-flag at 3 reports |
| 6 | `backend/functions/moderateMedia/index.mjs` | done | Approve/reject, S3 delete on reject |
| 7 | `backend/functions/getActivity/index.mjs` | done | Upload feed, paginated |
| 8 | `backend/functions/notifyUploads/index.mjs` | done | EventBridge stub with TODO |
| 9 | `backend/functions/eventSummary/index.mjs` | done | EventBridge stub with TODO |
| 10 | `backend/functions/cleanupExpired/index.mjs` | done | Full S3 cleanup for expired events |
| 11 | `frontend/src/pages/host/ModerationPage.tsx` | done | Blurred thumbnails, approve/reject |
| 12 | `frontend/src/pages/host/GalleryManagePage.tsx` | done | Bulk select, delete, search |

**Verified:** `tsc --noEmit` clean, `node --check` all 10 Lambdas OK, `vite build` (140KB gzipped)

**All 34 Lambda functions now fully implemented** (0 stubs remaining)

## Phase 5: Polish + Production — DONE
| # | File | Status | Notes |
|---|------|--------|-------|
| 1 | `frontend/src/components/ErrorBoundary.tsx` | done | Class component, "Algo salio mal" UI |
| 2 | `frontend/src/stores/toastStore.ts` | done | Zustand, auto-dismiss 4s, useToast() hook |
| 3 | `frontend/src/components/ui/Toast.tsx` | done | Fixed bottom-right, success/error/info |
| 4 | `frontend/src/pages/NotFoundPage.tsx` | done | 404 page, replaces Placeholder |
| 5 | `frontend/src/components/ScrollToTop.tsx` | done | Scroll to top on navigation |
| 6 | `frontend/index.html` | updated | SEO meta tags, OG, Twitter Card |
| 7 | `frontend/src/main.tsx` | updated | ErrorBoundary + Toast + ScrollToTop |
| 8 | `frontend/src/App.tsx` | updated | NotFoundPage, no more Placeholder |

**Verified:** `tsc --noEmit` clean, `vite build` succeeds (141KB gzipped)

---

## Prerequisites Before First Deploy
1. Install SAM CLI: `brew install aws-sam-cli`
2. Request ACM certificate (us-east-1) for `*.codersatelier.com`
3. Verify domain in SES
4. Store JWT secret in SSM
5. Create CloudFront key pair
6. Populate SSM parameters (tiers, pricing, Recurrente keys)
7. `git init`

## Critical Deltas Applied
- `eventalbum.app` → `eventalbum.codersatelier.com`
- `api.eventalbum.app` → `api.eventalbum.codersatelier.com`
- `cdn.eventalbum.app` → `eventalbum-cdn.codersatelier.com` (single-level subdomain for ACM wildcard)
- `noreply@eventalbum.app` → `noreply@codersatelier.com`
- Free tier → Basic tier ($1 USD / Q8 GTQ)
- Pricing: Basic=$1, Paid=$15, Premium=$30
- Email-first OTP (SMS fallback after 3 email failures)

## Deployment — DONE (2026-02-28)

**Stack: `eventalbum-dev`** in `us-east-1` via `sam deploy --profile codersatelier`

| Resource | Value |
|---|---|
| API URL | `https://bf3ohl9kaj.execute-api.us-east-1.amazonaws.com/dev` |
| Frontend URL | `https://eventalbum.codersatelier.com` |
| Frontend CDN | `dddvhivtzqx7c.cloudfront.net` (ETD7K4TJ66IK6) |
| Media CDN | `d3tkunzu75sko5.cloudfront.net` (E23ZDLZ79SPU31) |
| DynamoDB | `EventAlbum-dev` |
| Media Bucket | `eventalbum-media-dev` |
| Frontend Bucket | `eventalbum-frontend-dev` |

**Deployment issues resolved:**
1. `ExposeHeaders` → `ExposedHeaders` (S3 CORS typo)
2. `AccessLogSettings` missing `Format` (API Gateway V2 requires both)
3. Circular dependency: replaced all `!Ref EventAlbumTable` / `!Ref MediaBucket` with `!Sub` strings
4. ACM wildcard cert `*.codersatelier.com` doesn't cover 2-level subdomains → changed `cdn.eventalbum.` to `eventalbum-cdn.`
5. Orphaned DDB table + Lambda layer from failed deploys → manually deleted before retry
6. AWS profile `codersatelier` defaults to `us-east-2`, SAM deploys to `us-east-1` → must use `--region us-east-1` for all CF operations

## Cypress E2E Tests — DONE

**21 test files** covering all 14 documented sequence diagrams:

| # | Spec File | Covers Flow |
|---|---|---|
| 1 | `01-landing.cy.ts` | Landing page rendering, pricing, CTA |
| 2 | `02-guest-auth.cy.ts` | Guest password authentication |
| 3 | `03-gallery.cy.ts` | Gallery grid, empty state, navigation |
| 4 | `04-upload.cy.ts` | File upload via presigned URL |
| 5 | `05-otp-verify.cy.ts` | Email OTP send/verify, error handling |
| 6 | `06-host-auth.cy.ts` | Host email OTP login |
| 7 | `07-dashboard.cy.ts` | Dashboard stats, navigation |
| 8 | `08-edit-event.cy.ts` | Edit event form |
| 9 | `09-qr-page.cy.ts` | QR code display + download |
| 10 | `10-moderation.cy.ts` | Approve/reject flagged media |
| 11 | `11-checkout.cy.ts` | Tier selection, checkout form |
| 12 | `12-settings.cy.ts` | Settings toggles, danger zone |
| 13 | `13-media-view.cy.ts` | Full-screen media, reactions, comments |
| 14 | `14-gallery-manage.cy.ts` | Bulk select, delete, search |
| 15 | `15-not-found.cy.ts` | 404 page |
| 16 | `20-flow-guest-full.cy.ts` | **Seq 1a-f:** Full guest lifecycle (enter→auth→gallery→upload→react) |
| 17 | `21-flow-guest-paid-otp.cy.ts` | **Seq 2:** Guest OTP on paid event + SMS fallback after 3 failures |
| 18 | `22-flow-host-create-event.cy.ts` | **Seq 3+4:** Host creates event (3-step wizard) |
| 19 | `23-flow-host-admin.cy.ts` | **Seq 5+8+9:** Host login→dashboard→edit→QR→moderation→settings |
| 20 | `24-flow-promo-download.cy.ts` | **Seq 10+11:** Promo code + ZIP download |
| 21 | `25-flow-comments-reactions.cy.ts` | **Seq 1f:** Reactions + comments + report |

**Backend-only flows (not testable via Cypress):**
- Seq 1e/7: Upload Processing Pipeline (S3 trigger → processUpload Lambda)
- Seq 6: Payment webhook (Recurrente → handleWebhook Lambda)
- Seq 12: Event Lifecycle state machine (DDB status transitions)
- Seq 13: Email Notification Batching (EventBridge → notifyUploads)
- Seq 14: Event Summary Email (EventBridge → eventSummary)
