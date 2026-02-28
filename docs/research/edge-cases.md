# Edge Cases & Resolutions

Comprehensive catalog of edge cases across all platform features, with specific resolution strategies, HTTP status codes, error codes, and which system component is responsible for handling each case.

---

## Upload Edge Cases

### 1. Upload counter at limit (150/150 for Free, 500/500 for Paid, 1000/1000 for Premium)

**Scenario:** Guest attempts to upload when the event has reached its upload limit.

**Resolution:**
- **Frontend (Browser):** Before showing upload UI, check `uploadCount` vs `uploadLimit` from event data. If at limit:
  - Disable camera button and file picker.
  - Replace upload area with message: "Este evento ha alcanzado su limite de fotos."
  - For Free tier: show "Upgrade" CTA linking to upgrade flow.
  - For Paid/Premium: show "Limite alcanzado" without upgrade option (host manages).
  - Disable FAB button on gallery (change icon to lock).
- **Backend (Lambda — getUploadUrl):** Validate `uploadCount < uploadLimit` before generating presigned URL. Return:
  ```json
  {
    "statusCode": 429,
    "body": {
      "error": "UPLOAD_LIMIT_REACHED",
      "message": "Event upload limit reached",
      "current": 150,
      "limit": 150,
      "tier": "free"
    }
  }
  ```
- **DynamoDB:** ConditionExpression on `uploadCount < uploadLimit` during the `processUpload` counter increment as a second line of defense.
- **Component responsible:** Lambda (getUploadUrl) is the primary gate. Frontend is optimistic UI.

---

### 2. Upload fails mid-S3-PUT

**Scenario:** Network drops, browser closes, or S3 returns 5xx during the direct PUT upload to S3 via presigned URL.

**Resolution:**
- **Frontend (Browser):** XMLHttpRequest / fetch with `AbortController` and retry logic:
  1. First retry: 1 second delay.
  2. Second retry: 2 second delay.
  3. Third retry: 4 second delay (exponential backoff).
  4. After 3 failures: show red error icon on queue item with "Reintentar" button for manual retry.
  - Progress bar resets to 0% on each retry.
  - Upload queue item shows status: "Error de conexion. Toca para reintentar."
- **Backend impact:** None. Failed S3 PUT means the object was never created (or partially written — S3 is atomic for PUTs). No presigned URL consumed permanently. No upload count incremented (that happens in `processUpload`, which only triggers on successful S3 ObjectCreated).
- **Presigned URL expiration:** The presigned URL has a 15-minute TTL. If retries span beyond 15 minutes, the client must request a new presigned URL via `POST /upload-url`.
- **Component responsible:** Browser (retry logic). No backend action needed for failed uploads.

---

### 3. Concurrent uploads exceed limit (race condition)

**Scenario:** Multiple guests upload simultaneously. Guest A and Guest B both check at 149/150, both get presigned URLs, both upload successfully. `processUpload` fires for both — one should be rejected.

**Resolution:**
- **Backend (Lambda — processUpload):** Use DynamoDB atomic counter with ConditionExpression:
  ```
  UpdateExpression: SET uploadCount = uploadCount + :one
  ConditionExpression: uploadCount < :limit
  ```
  - First `processUpload` to execute: `149 + 1 = 150`, condition passes. Success.
  - Second `processUpload` to execute: `150 < 150` fails → `ConditionalCheckFailedException`.
- **On ConditionalCheckFailedException in processUpload:**
  1. Delete the uploaded S3 object (cleanup).
  2. Do NOT create the MEDIA record in DynamoDB.
  3. Log the race condition event for monitoring.
  4. The guest's upload appeared successful from their perspective (S3 PUT returned 200), but the media won't appear in the gallery. This is an acceptable trade-off for simplicity.
- **Future improvement:** Notify the guest via WebSocket or polling that their upload was rejected due to limit (not MVP).
- **HTTP status:** N/A (processUpload is an async S3-triggered Lambda, no HTTP response to client).
- **Component responsible:** Lambda (processUpload) with DynamoDB ConditionExpression.

---

### 4. Large file on slow connection

**Scenario:** Guest tries to upload a 10MB photo on a 3G connection. The upload takes several minutes and may timeout.

**Resolution:**
- **Frontend (Browser):** Client-side compression runs BEFORE upload:
  1. Canvas API: resize to max 1920px on longest edge.
  2. Quality: 0.8 for JPEG, 0.75 for WebP.
  3. Format: convert HEIC to JPEG.
  4. Typical compression ratio: 10MB original → 800KB-1.5MB compressed (85% reduction).
- **Upload timeout:** 5 minutes per file. `AbortController` with `setTimeout(300000)`.
- **Progress bar:** Real-time progress using XMLHttpRequest `upload.onprogress` event. Shows percentage and estimated time remaining.
- **Connection recovery:** If the browser detects offline state (`navigator.onLine`), pause the upload and show "Sin conexion. La subida continuara cuando vuelvas a estar en linea." Resume when `online` event fires.
- **Presigned URL:** 15-minute expiry. If compression + upload takes longer than 15 minutes, the URL expires. Client requests a new one.
- **Component responsible:** Browser (compression, progress tracking, timeout management).

---

### 5. Unsupported file type

**Scenario:** Guest uploads a `.exe` file renamed to `.jpg`, or a genuinely unsupported format like `.bmp` or `.tiff`.

**Resolution:**
- **Frontend (Browser) — First check:**
  1. File input `accept` attribute: `image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime`.
  2. After file selection, read first 4-8 bytes (magic bytes) using `FileReader`:
     - JPEG: `FF D8 FF`
     - PNG: `89 50 4E 47`
     - WebP: `52 49 46 46` ... `57 45 42 50`
     - HEIC: `66 74 79 70` (ftyp box)
     - MP4: `66 74 79 70` (ftyp box, different brand)
  3. If magic bytes don't match: reject immediately. Show: "Formato no soportado. Sube archivos JPEG, PNG o WebP."
  4. Never rely solely on file extension.
- **Backend (Lambda — getUploadUrl) — Second check:**
  1. Validate `contentType` parameter against allowed list.
  2. If invalid: return `400 BAD_REQUEST` with `UNSUPPORTED_FILE_TYPE`.
- **Backend (Lambda — processUpload) — Third check:**
  1. Read first bytes of S3 object. Validate magic bytes server-side.
  2. If invalid:
     - Delete the S3 object.
     - Do NOT create MEDIA record.
     - Do NOT increment upload count.
     - Log for monitoring: `{eventId, s3Key, detectedType, claimedType}`.
- **HTTP status:** `400 Bad Request` with error code `UNSUPPORTED_FILE_TYPE`.
- **Component responsible:** Browser (first pass), Lambda getUploadUrl (second pass), Lambda processUpload (final defense).

---

### 6. Duplicate upload detection

**Scenario:** Guest accidentally uploads the same photo twice, or two guests upload the same photo captured via AirDrop/shared album.

**Resolution:**
- **Frontend (Browser):**
  1. Compute SHA-256 hash of the first 1MB of the file using `crypto.subtle.digest`.
  2. Maintain a local Set of hashes for the current session.
  3. If hash matches a previous upload in this session: show warning dialog "Esta foto parece que ya la subiste. Subir de todas formas?" with "Subir" (proceed) and "Cancelar" options.
  4. Allow the upload if user confirms — different guests may capture the same moment from different angles, and the hash is only approximate (first 1MB).
- **Backend:** No server-side dedup. Reasons:
  1. Client-side compression produces different outputs for the same source depending on browser/device.
  2. False positives would frustrate users.
  3. Storage cost of duplicates is negligible after compression.
- **Component responsible:** Browser (advisory only, not blocking).

---

### 7. Upload while offline (PWA / poor connectivity)

**Scenario:** Guest takes photos at an outdoor event with no cell service. Wants to upload later.

**Resolution:**
- **Frontend (Browser):**
  1. Detect offline state via `navigator.onLine` and `offline` / `online` events.
  2. When offline and user selects photos:
     - Compress images client-side (canvas API works offline).
     - Store compressed images in IndexedDB using `idb-keyval` library.
     - Show queue UI: "X fotos en espera. Se subiran cuando tengas conexion."
     - Maximum 20 queued items (to prevent IndexedDB storage issues on low-memory devices).
     - Each queued item: filename, compressed blob, eventId, timestamp.
  3. When `online` event fires:
     - Process queue sequentially (not in parallel, to avoid overwhelming slow connection).
     - For each item: `POST /upload-url` → `PUT` to S3.
     - Update queue UI: show progress per item, remove completed items.
     - If JWT expired during offline period: prompt re-auth before processing queue.
  4. If user closes browser while offline: queued items persist in IndexedDB. On next visit (must be same event URL), check for pending queue and offer to resume.
- **Limitations:**
  - IndexedDB storage varies by browser (50MB-unlimited depending on browser and available space).
  - Service Worker not required for basic queue (but would improve background sync).
- **Component responsible:** Browser (IndexedDB queue, online/offline event handlers).

---

## Authentication Edge Cases

### 8. Guest enters host password (instead of guest password)

**Scenario:** The host shares their admin password instead of the guest password, or the host enters their own password on the guest entry screen.

**Resolution:**
- **Backend (Lambda — authEvent):**
  1. Receive `{eventId, password}`.
  2. First, compare against `guestPasswordHash` using `bcrypt.compare()`.
  3. If no match, compare against `hostPasswordHash`.
  4. If guest password matches: issue JWT with `role: "guest"`, `guestId: uuid`, `exp: 24h`.
  5. If host password matches: issue JWT with `role: "host"`, `exp: 7d`.
  6. If neither matches: return `401 INVALID_PASSWORD`.
- **Frontend (Browser):**
  - If JWT contains `role: "host"`: redirect to admin dashboard instead of guest gallery.
  - This is by design — the host password doubles as the admin key.
  - There is no separate admin login for event-specific access (the email OTP flow in Screen 14/15 is for hosts who want to access their dashboard without remembering the host password).
- **Security note:** Host password is randomly generated (12 chars, alphanumeric) and sent via email. It's not user-chosen, so it's strong by default.
- **HTTP status:** `200 OK` with JWT (role varies) or `401 Unauthorized`.
- **Component responsible:** Lambda (authEvent).

---

### 9. Expired JWT during active upload

**Scenario:** Guest's JWT expires while they have uploads in progress or in the queue.

**Resolution:**
- **Frontend (Browser):**
  1. Before each API call, check JWT `exp` claim (decoded client-side, no verification needed for expiry check).
  2. If `exp - now < 300` (less than 5 minutes remaining):
     - Show re-auth modal: "Tu sesion esta por expirar. Ingresa la contrasena para continuar."
     - Password input + submit.
     - On success: replace JWT in localStorage, continue operations.
  3. In-progress S3 uploads (already have presigned URL): continue uninterrupted. The presigned URL is independent of the JWT — it was issued by the backend and signed by AWS credentials. It remains valid for its own TTL (15 minutes).
  4. If JWT expires before re-auth:
     - Pending API calls fail with `401`.
     - Queued uploads pause.
     - Show login screen with message: "Tu sesion expiro. Ingresa la contrasena para continuar."
     - After re-auth, resume queue automatically.
- **Backend (Lambda):** JWT verification middleware rejects expired tokens with:
  ```json
  {
    "statusCode": 401,
    "body": {
      "error": "TOKEN_EXPIRED",
      "message": "Session expired. Please re-authenticate."
    }
  }
  ```
- **Component responsible:** Browser (proactive check) + Lambda (enforcement).

---

### 10. Multiple browser tabs

**Scenario:** Guest opens the event in two tabs. Auth happens in one tab. The other tab needs the token.

**Resolution:**
- **Frontend (Browser):**
  1. JWT stored in `localStorage` (not `sessionStorage`) — shared across all tabs of the same origin.
  2. Listen for `storage` event on `window`:
     ```javascript
     window.addEventListener('storage', (e) => {
       if (e.key === 'jwt') {
         // Token updated in another tab
         updateAuthState(e.newValue);
       }
     });
     ```
  3. When one tab authenticates (password or OTP), all tabs receive the new JWT via the storage event.
  4. When one tab signs out (clears JWT), all tabs detect the removal and redirect to the login/entry screen.
  5. Token refresh in one tab propagates to all tabs without requiring refresh.
- **Race condition:** If two tabs try to re-auth simultaneously, both will succeed (both get valid JWTs). The last one to write to `localStorage` wins — both are valid, so no issue.
- **Component responsible:** Browser (localStorage + storage event).

---

### 11. Guest tries to access admin routes

**Scenario:** Guest with `role=guest` JWT manually navigates to `/admin/dashboard` or calls admin-only API endpoints.

**Resolution:**
- **Frontend (Browser — Route Guard):**
  1. React Router `ProtectedRoute` component checks JWT `role` before rendering admin routes.
  2. If `role !== "host"`: redirect to guest gallery with no error message (don't reveal admin routes exist).
  3. Route guard runs on every navigation (not just initial load).
- **Backend (Lambda — Authorization Middleware):**
  1. All admin endpoints (`PUT /events`, `DELETE /media`, `PATCH /media`, `GET /events/{id}/dashboard`, etc.) check JWT `role === "host"`.
  2. If guest token used on admin endpoint:
     ```json
     {
       "statusCode": 403,
       "body": {
         "error": "FORBIDDEN",
         "message": "Insufficient permissions"
       }
     }
     ```
  3. Additionally verify that the JWT's `eventId` matches the requested resource's `eventId` (prevent host of Event A from accessing Event B's admin).
- **HTTP status:** `403 Forbidden`.
- **Component responsible:** Browser (route guard) + Lambda (authorization middleware).

---

## OTP Edge Cases

### 12. SMS delivery failure (SNS error)

**Scenario:** AWS SNS fails to deliver SMS — invalid phone number, carrier rejection, SNS quota exceeded, or Guatemala-specific routing issue.

**Resolution:**
- **Backend (Lambda — sendOtp):**
  1. Wrap `SNS.publish()` in try/catch.
  2. On SNS error (any):
     - Log the error with phone number hash (not full number) and error code.
     - Return response:
       ```json
       {
         "statusCode": 200,
         "body": {
           "sent": false,
           "channel": "sms",
           "fallback": true,
           "message": "SMS delivery failed. Try email verification instead."
         }
       }
       ```
     - Do NOT delete the OTP record (it's already stored with the destination). If the user switches to email, a new OTP is generated for the email destination.
  3. Common SNS error codes handled:
     - `InvalidParameter` — malformed phone number.
     - `Throttling` — SNS spend limit reached.
     - `InternalError` — AWS internal error.
- **Frontend (Browser):**
  1. On `sent: false` with `fallback: true`:
     - Show: "No pudimos enviar el SMS. Intenta con tu correo electronico."
     - Switch UI from phone input to email input.
     - Submit to same `POST /otp/send` with `channel: "email"` instead.
  2. Email fallback uses SES instead of SNS — much more reliable.
- **HTTP status:** `200 OK` (not an error — the request was processed, but delivery failed).
- **Component responsible:** Lambda (sendOtp) with try/catch + Frontend (fallback UI).

---

### 13. Guest enters wrong OTP 5 times

**Scenario:** Guest enters incorrect codes repeatedly, exhausting the attempt limit.

**Resolution:**
- **Backend (Lambda — verifyOtp):**
  1. Each failed verification: `UpdateItem` to increment `attempts` counter on the OTP record.
  2. Check `attempts >= 5`:
     - Delete the OTP record from DynamoDB (burn the code).
     - Return:
       ```json
       {
         "statusCode": 429,
         "body": {
           "error": "TOO_MANY_ATTEMPTS",
           "message": "Too many incorrect attempts. Please request a new code.",
           "remainingAttempts": 0
         }
       }
       ```
  3. On attempts 1-4, return:
     ```json
     {
       "statusCode": 401,
       "body": {
         "error": "INVALID_OTP",
         "message": "Incorrect code. Please try again.",
         "remainingAttempts": 4
       }
     }
     ```
- **Frontend (Browser):**
  1. Show remaining attempts: "Codigo incorrecto. Te quedan 3 intentos."
  2. After 5th failure:
     - Disable code input boxes.
     - Show: "Demasiados intentos. Solicita un nuevo codigo."
     - Show "Solicitar nuevo codigo" button.
     - 60-second cooldown before allowing re-request.
- **Security:** No information leakage about whether the destination (phone/email) is valid. The OTP is hashed before storage (SHA-256 + salt), so even DB access doesn't reveal codes.
- **HTTP status:** `429 Too Many Requests` on 5th attempt, `401 Unauthorized` on attempts 1-4.
- **Component responsible:** Lambda (verifyOtp) + DynamoDB (attempts counter).

---

### 14. OTP expired (TTL elapsed, > 10 minutes for host, > 5 minutes for guest)

**Scenario:** Guest or host waits too long before entering the code.

**Resolution:**
- **Backend (DynamoDB):** OTP record has a `TTL` attribute set to `now + 300` (guest, 5 min) or `now + 600` (host, 10 min). DynamoDB automatically deletes expired records.
- **Backend (Lambda — verifyOtp):**
  1. `GetItem` returns null (record deleted by TTL).
  2. Return:
     ```json
     {
       "statusCode": 410,
       "body": {
         "error": "OTP_EXPIRED",
         "message": "Code has expired. Please request a new one."
       }
     }
     ```
  3. Note: DynamoDB TTL deletion is eventually consistent (can take up to 48 hours after TTL timestamp). As a defense, also check `expiresAt` attribute explicitly in Lambda even if the record still exists.
- **Frontend (Browser):**
  1. Client-side countdown timer (10:00 → 0:00) shown below OTP input.
  2. When timer reaches 0:00:
     - Timer text turns `$accent-coral`: "Codigo expirado. Solicita uno nuevo."
     - Disable code input boxes.
     - Show "Solicitar nuevo codigo" button.
  3. Client timer is approximate — server is the source of truth. A code submitted at timer 0:03 might still be valid server-side (or might not, due to clock skew). Server decides.
- **HTTP status:** `410 Gone`.
- **Component responsible:** DynamoDB (TTL auto-delete) + Lambda (explicit expiry check) + Browser (timer UI).

---

### 15. Guest requests OTP, then closes browser

**Scenario:** Guest requests an OTP code, receives it via SMS/email, but never enters it — closes the browser or navigates away.

**Resolution:**
- **No action required.** The OTP record in DynamoDB has a TTL and will be automatically deleted after expiration (5 minutes for guest, 10 minutes for host).
- **State cleanup:** No leaked state. The OTP record is the only artifact, and TTL handles cleanup.
- **Security:** The OTP code expires naturally. Even if the SMS/email is intercepted later, it's useless after TTL.
- **If guest returns later:** They must request a new OTP. The old one is gone (or will be soon).
- **Component responsible:** DynamoDB TTL (automatic cleanup).

---

### 16. Two OTP requests to same destination in quick succession

**Scenario:** Guest clicks "Send code" twice quickly, or clicks "Resend" before the first SMS arrives.

**Resolution:**
- **Backend (Lambda — sendOtp):**
  1. OTP record uses a composite key: `PK=OTP#{eventId}`, `SK=GUEST#{destination}`.
  2. Second request overwrites the first (`PutItem` replaces existing item with same PK/SK).
  3. Only the latest code is valid. Previous code is effectively invalidated.
  4. New TTL starts from the second request.
  5. Attempts counter resets to 0.
- **Frontend (Browser):**
  1. After sending OTP, disable the "Send" button for 60 seconds with countdown: "Reenviar en 45s".
  2. This prevents rapid-fire requests (UX throttle, not security — backend handles the overwrite correctly).
- **Rate limiting:** API Gateway rate limit (10 requests per minute per IP) provides additional protection against abuse.
- **Component responsible:** DynamoDB (PutItem overwrites) + Browser (60-second cooldown UI).

---

### 17. Host email not found in system (anti-enumeration)

**Scenario:** Someone enters a random email on the admin login screen to check if it's registered.

**Resolution:**
- **Backend (Lambda — hostLogin):**
  1. Query `GSI1PK = HOST#{email}`.
  2. **If found:** Generate OTP, store in DynamoDB, send via SES. Return `200 OK`.
  3. **If NOT found:** Do nothing (no OTP generated, no email sent). Return `200 OK` with the exact same response body and timing.
  4. Response in both cases:
     ```json
     {
       "statusCode": 200,
       "body": {
         "message": "If an account exists for this email, we've sent a login code."
       }
     }
     ```
  5. **Timing attack mitigation:** Add a small random delay (100-500ms) when email is NOT found, to match the natural latency of the SES send call in the found path. Alternatively, always perform a dummy computation (bcrypt hash of a dummy value) to normalize response time.
- **Logging:** Log `{email_hash, found: boolean}` for rate limit monitoring (detect enumeration attempts by IP).
- **Frontend (Browser):** Always navigate to the OTP input screen regardless of response. If the email doesn't exist, the user will simply never receive a code.
- **HTTP status:** `200 OK` in all cases.
- **Component responsible:** Lambda (hostLogin) — constant-time response pattern.

---

## Payment Edge Cases

### 18. User abandons Recurrente checkout

**Scenario:** Host clicks "Pay Now", gets redirected to Recurrente, then closes the tab without completing payment.

**Resolution:**
- **Backend state:** Event was created with `paymentStatus: "pending"` and `tier: "free"` (functional as a free event) with `requestedTier: "paid"` or `"premium"` stored for upgrade on payment.
- **Event behavior:** The event is fully functional as a Free tier event. Guest password works, uploads work (with 150 limit), QR code works.
- **Retry:** Host can click "Upgrade" from the dashboard (visible since `requestedTier` differs from `tier`). This creates a new Recurrente checkout.
- **Checkout expiry:** Recurrente checkout URLs expire after 24 hours. After expiry, a new checkout must be created.
- **No cleanup needed:** The `paymentStatus: "pending"` state is informational only. It doesn't block any functionality.
- **Frontend (Browser):** On the `cancel_url` return page, show: "Pago no completado. Tu evento esta activo como plan gratuito. Puedes actualizar en cualquier momento desde tu panel."
- **HTTP status:** N/A (no API call — user navigated away from Recurrente).
- **Component responsible:** Frontend (cancel page messaging) + DynamoDB (stores requestedTier for later upgrade).

---

### 19. Webhook arrives before user redirect

**Scenario:** Recurrente sends the `payment_intent.succeeded` webhook to our backend before the user's browser completes the redirect back to the success_url.

**Resolution:**
- **Backend (Lambda — handleWebhook):** Processes immediately. Updates `tier`, `paymentStatus`, `uploadLimit`, `TTL`. Sends receipt email. This is the primary path — webhooks are the source of truth.
- **Frontend (Browser — success page):**
  1. On success_url load, poll `GET /events/{eventId}` every 2 seconds (max 10 attempts, 20 seconds total).
  2. Check `paymentStatus === "paid"`.
  3. **If webhook already processed:** First poll returns `tier: "paid"`, show success immediately.
  4. **If webhook hasn't arrived yet:** Continue polling. Show "Procesando tu pago..." with spinner.
  5. After 10 polls (20 seconds) without success: show "Tu pago esta siendo procesado. Puede tomar unos minutos. Te enviaremos un correo de confirmacion." + link to dashboard.
- **No race condition:** The webhook handler is idempotent (checks `paymentStatus !== "paid"` before upgrading). The polling is read-only. These operations don't conflict.
- **HTTP status:** Webhook returns `200 OK` to Recurrente.
- **Component responsible:** Lambda (handleWebhook — immediate processing) + Browser (polling fallback).

---

### 20. Double webhook delivery

**Scenario:** Recurrente sends the same `payment_intent.succeeded` webhook twice due to retry logic or network issues.

**Resolution:**
- **Backend (Lambda — handleWebhook):**
  1. First check: `GetItem` for the event. Read `paymentStatus`.
  2. If `paymentStatus === "paid"`: return `200 OK` immediately without any further action. Log: `{eventId, checkoutId, action: "duplicate_webhook_ignored"}`.
  3. If `paymentStatus !== "paid"`: proceed with upgrade flow.
  4. The `UpdateItem` uses ConditionExpression `paymentStatus <> :paid` as a defense-in-depth against race conditions (two webhook Lambdas executing concurrently).
- **Email dedup:** Receipt email is only sent in the "upgrade" path. Since the second webhook is short-circuited, no duplicate email.
- **Promo counter:** Promo code `usedCount` increment also uses ConditionExpression, preventing double-increment.
- **HTTP status:** `200 OK` in all cases (to prevent Recurrente from retrying indefinitely).
- **Component responsible:** Lambda (handleWebhook) — idempotent design.

---

### 21. Promo code maxed out (usedCount >= maxUses)

**Scenario:** Promo code "LAUNCH20" has `maxUses: 100` and `usedCount: 100`. Another user tries to apply it.

**Resolution:**
- **Backend (Lambda — validatePromo):**
  1. Read promo config from SSM (`maxUses`) and counter from DynamoDB (`usedCount`).
  2. If `usedCount >= maxUses`:
     ```json
     {
       "statusCode": 410,
       "body": {
         "error": "PROMO_MAXED_OUT",
         "valid": false,
         "message": "This code is no longer available."
       }
     }
     ```
- **Backend (Lambda — handleWebhook) — Atomic increment:**
  1. When incrementing `usedCount` after successful payment:
     ```
     UpdateExpression: SET usedCount = usedCount + :one
     ConditionExpression: usedCount < :maxUses
     ```
  2. If `ConditionalCheckFailedException`: the promo was maxed between validation and payment. Upgrade still proceeds (the discount was already applied at Recurrente). Log the anomaly.
- **Frontend (Browser):**
  - Show error badge on promo input: red X icon + "Codigo ya no esta disponible."
  - Clear the promo code input.
  - Update order summary to remove discount (show full price).
- **HTTP status:** `410 Gone`.
- **Component responsible:** Lambda (validatePromo) for frontend validation, Lambda (handleWebhook) for backend atomic increment.

---

### 22. Promo code expired

**Scenario:** Promo code "SUMMER2026" has `expiresAt: "2026-06-30T23:59:59Z"` and the current date is July 1, 2026.

**Resolution:**
- **Backend (Lambda — validatePromo):**
  1. Read promo config from SSM.
  2. Compare `expiresAt` with current UTC timestamp.
  3. If expired:
     ```json
     {
       "statusCode": 410,
       "body": {
         "error": "PROMO_EXPIRED",
         "valid": false,
         "message": "This code has expired."
       }
     }
     ```
- **Frontend (Browser):**
  - Show error badge: red X icon + "Este codigo ha expirado."
  - Clear promo input, remove discount from order summary.
- **Race condition:** If user validates code at 23:58 and pays at 00:02 (after expiry): the discount was already applied at Recurrente checkout creation time. The payment goes through with the discount. This is acceptable — the window is tiny and the user acted in good faith.
- **HTTP status:** `410 Gone`.
- **Component responsible:** Lambda (validatePromo).

---

## Moderation Edge Cases

### 23. Auto-approve ON + Rekognition detection (Premium)

**Scenario:** Host has toggled `autoApprove: true` on a Premium event. A guest uploads potentially inappropriate content.

**Resolution:**
- **Backend (Lambda — processUpload):**
  1. Read event settings: `autoApprove === true`.
  2. When autoApprove is ON, Rekognition `DetectModerationLabels` is **NOT called**.
  3. All uploads go directly to `status: "visible"`.
  4. Rationale: The host explicitly chose to trust their guests. Calling Rekognition would add latency and cost ($1 per 1000 images) with no host action expected.
- **Host responsibility:** By enabling auto-approve, the host accepts responsibility for content. The Moderation tab shows all content but with no "Pending" items.
- **Guest reports still work:** Even with auto-approve ON, guests can report content. Reported content appears in the "Reported" tab for host review.
- **Toggling auto-approve OFF later:** Only affects future uploads. Existing visible content is not retroactively scanned by Rekognition.
- **Component responsible:** Lambda (processUpload) — conditional Rekognition call based on `autoApprove` flag.

---

### 24. Guest reports already-approved content

**Scenario:** A photo was approved (manually by host or auto-approved) and is visible in the gallery. A guest reports it.

**Resolution:**
- **Backend (Lambda — reportMedia):**
  1. Receive `POST /media/{mediaId}/report` with `{reason: "inappropriate", details: "..."}`.
  2. Update the MEDIA record:
     ```
     SET status = "reported"
     SET reportedBy = :guestId
     SET reportedAt = :now
     SET reportReason = :reason
     SET reportDetails = :details
     ```
  3. **Content stays visible** until the host acts. The "reported" status is an overlay — it flags the item for review but doesn't auto-hide. Rationale: preventing false flag attacks (malicious guest reports to hide legitimate content).
  4. Send notification to host (if moderation notifications enabled) via SES or in-app notification on dashboard.
- **Frontend (Browser — Host dashboard):**
  - "Reported" tab shows the item with reporter's reason.
  - Host can "Approve" (move back to visible, clear report) or "Reject" (hide from gallery).
- **Frontend (Browser — Guest):**
  - After reporting, show confirmation: "Gracias por reportar. El anfitrion revisara este contenido."
  - The content remains visible to the reporting guest (no immediate action).
- **HTTP status:** `200 OK`.
- **Component responsible:** Lambda (reportMedia) + Frontend (host Moderation tab).

---

### 25. Host approves Rekognition-flagged content

**Scenario:** Rekognition flagged a photo as "Suggestive Content" (87% confidence), but the host reviews it and determines it's acceptable (e.g., a beach photo at a destination wedding).

**Resolution:**
- **Backend (Lambda — updateMedia):**
  1. Receive `PATCH /media/{mediaId}` with `{status: "visible"}`.
  2. Update MEDIA record:
     ```
     SET status = "visible"
     SET reviewedBy = :hostEmail
     SET reviewedAt = :now
     ```
  3. **Keep `moderationLabels` intact.** Do not delete them. They serve as an audit trail:
     ```json
     {
       "moderationLabels": [
         {"Name": "Suggestive", "Confidence": 87.3}
       ],
       "reviewedBy": "brandon@example.com",
       "reviewedAt": "2026-02-28T15:30:00Z",
       "status": "visible"
     }
     ```
  4. No automatic re-check by Rekognition. Once host approves, the decision is final.
- **Analytics:** Moderation labels are kept for future analytics (track false positive rate, improve threshold tuning).
- **HTTP status:** `200 OK`.
- **Component responsible:** Lambda (updateMedia).

---

### 26. Rekognition false positive

**Scenario:** Rekognition flags a perfectly innocent photo (e.g., a photo of a baby in a bathtub flagged as "Partial Nudity").

**Resolution:**
- **Same flow as Edge Case #25.** Host reviews in the Moderation tab and clicks "Approve."
- **No feedback loop to Rekognition:** AWS Rekognition does not support custom training or feedback for `DetectModerationLabels`. The threshold is fixed.
- **Threshold tuning:** If false positives are frequent, consider raising the confidence threshold from 70% to 80% or 90% in the Lambda processUpload code. This is a configuration change:
  ```javascript
  const MODERATION_THRESHOLD = 70; // Adjustable
  const isFlagged = labels.some(l => l.Confidence >= MODERATION_THRESHOLD);
  ```
- **Metrics:** Log all Rekognition results (flagged and clean) to CloudWatch for threshold tuning analysis.
- **Component responsible:** Lambda (processUpload — threshold) + Host (manual review).

---

### 27. Guest reports their own upload

**Scenario:** A guest uploads a photo, then wants to remove it and uses the "Report" function on their own content.

**Resolution:**
- **Allowed.** The report flow doesn't check if `reportedBy === uploadedBy`. This is intentional:
  1. The guest may want to remove an accidental upload (blurry, wrong photo, embarrassing).
  2. There's no "delete my upload" feature for guests (security: preventing malicious deletion).
  3. Reporting their own content is a valid way to request removal from the host.
- **Backend:** Same flow as Edge Case #24. Report is created, host reviews.
- **UX note:** In the report reason dropdown, include "Subi esto por error" as an option alongside "Inapropiado", "Derechos de autor", "Spam", "Otro".
- **Component responsible:** Lambda (reportMedia) — no self-report blocking.

---

## Event Lifecycle Edge Cases

### 28. Event ends while guest is actively uploading

**Scenario:** An event's `endDate` passes while a guest has uploads in progress or in their queue.

**Resolution:**
- **In-progress S3 uploads (presigned URL already issued):** These complete successfully. The presigned URL is valid for 15 minutes regardless of event status. S3 doesn't know about event state.
- **processUpload Lambda (triggered by S3):**
  1. When processing the uploaded file, re-check event status.
  2. If `status === "ended"`: still process the upload (create MEDIA record, generate thumbnail). The upload happened during the active window (presigned URL was issued while active).
  3. Rationale: Penalizing guests for slow uploads at the event's boundary is a poor experience.
- **New upload requests (POST /upload-url) after endDate:**
  1. Lambda checks event status.
  2. If ended:
     ```json
     {
       "statusCode": 403,
       "body": {
         "error": "EVENT_LOCKED",
         "message": "This event has ended. No more uploads are allowed."
       }
     }
     ```
- **Frontend (Browser):**
  1. Poll event status periodically (every 5 minutes) or check on each upload attempt.
  2. When event status changes to "ended":
     - Disable upload UI (camera, file picker, FAB).
     - Show banner: "Este evento ha finalizado. Ya no se pueden subir fotos."
     - Allow gallery viewing and reactions (read-only mode depends on settings).
- **EventBridge (daily cron):** Updates event status from "active" to "ended" when `endDate <= now`.
- **HTTP status:** `403 Forbidden` with `EVENT_LOCKED`.
- **Component responsible:** Lambda (getUploadUrl — status check) + EventBridge (status transition) + Browser (UI state).

---

### 29. Free event expires (15-day TTL reached)

**Scenario:** A free event was created 15 days ago. DynamoDB TTL fires and deletes the event record. S3 lifecycle deletes the media.

**Resolution:**
- **DynamoDB TTL:** Automatically deletes the event record (PK=EVT#{eventId}, SK=META) and all associated items (MEDIA#, GUEST#, REACT#, ACTIVITY#, etc.) — BUT only the META item has TTL. Related items need explicit cleanup.
- **S3 Lifecycle Rule:** Objects in `events/{eventId}/` with tag `tier=free` are expired after 15 days.
- **Guest experience after expiry:**
  1. Guest scans QR code or clicks link.
  2. `GET /e/{eventId}` → Lambda `GetItem` → item not found.
  3. Return:
     ```json
     {
       "statusCode": 404,
       "body": {
         "error": "EVENT_NOT_FOUND",
         "message": "This event no longer exists or has expired."
       }
     }
     ```
  4. Frontend shows: "Este evento ya no existe. Los eventos gratuitos se eliminan despues de 15 dias."
- **Cleanup of related DynamoDB items:** Since DynamoDB TTL only applies to items with the TTL attribute, a cleanup Lambda (triggered by DynamoDB Streams on TTL-deleted items) should delete all related items:
  ```
  When EVENT META is TTL-deleted:
    → Query PK=EVT#{eventId} (all SKs)
    → BatchWriteItem to delete all
  ```
- **Communication:** Include retention period prominently in:
  - Event creation confirmation email.
  - Dashboard settings page.
  - 3 days before expiry: send warning email "Your event expires in 3 days."
- **HTTP status:** `404 Not Found`.
- **Component responsible:** DynamoDB (TTL), S3 (Lifecycle Rules), Lambda (DynamoDB Streams cleanup), SES (warning emails).

---

### 30. Host tries to extend event after expiry

**Scenario:** Host realizes their free event expired and contacts support or tries to access the dashboard.

**Resolution:**
- **Not possible.** Once DynamoDB TTL fires, all event data is deleted. S3 objects are also deleted by lifecycle rules. There is no recovery mechanism.
- **Frontend (Browser):** If host tries to access dashboard with a JWT for a deleted event:
  1. API returns `404 EVENT_NOT_FOUND`.
  2. Show: "Este evento ha expirado y los datos han sido eliminados. Los eventos gratuitos se eliminan despues de 15 dias. Para conservar tus fotos por mas tiempo, crea un evento de pago."
  3. CTA: "Crear nuevo evento" button.
- **Prevention — proactive warnings:**
  1. **7 days before expiry:** Email: "Tu evento expira en 7 dias. Actualiza a un plan de pago para conservar tus fotos."
  2. **3 days before expiry:** Email: "Tu evento expira en 3 dias. Descarga tus fotos ahora." (Free tier can't ZIP download, but individual downloads work).
  3. **1 day before expiry:** Email: "Ultimo dia. Tu evento y todas las fotos seran eliminados manana."
  4. Dashboard banner (red): "Tu evento expira en X dias."
- **No undo. No recovery. By design.** This keeps free tier storage costs at zero long-term.
- **HTTP status:** `404 Not Found`.
- **Component responsible:** DynamoDB (TTL — irreversible), Lambda (warning emails), Frontend (clear messaging).

---

### 31. Host deletes event manually

**Scenario:** Host clicks "Delete Event" in Settings (Danger Zone).

**Resolution:**
- **Frontend (Browser):**
  1. Show confirmation modal with red border.
  2. "This will delete your event and all associated data. This action is irreversible."
  3. Require typing the event title to confirm: input field with placeholder "Type [Event Title] to confirm".
  4. "Delete" button enabled only when input matches event title.
  5. 24-hour grace period mentioned: "You have 24 hours to undo this by contacting support."
- **Backend (Lambda — deleteEvent):**
  1. Soft delete: `UpdateItem` sets `status = "deleted"`, `deletedAt = now`, `TTL = now + 86400` (24 hours).
  2. Event immediately becomes inaccessible to guests (status check in `getEvent`).
  3. Dashboard shows "Event deleted. You have 24 hours to undo." with "Undo Delete" button.
  4. "Undo Delete": `PATCH /events/{eventId}` with `{status: "active", deletedAt: null, TTL: originalTTL}`.
- **After 24 hours (TTL fires):**
  1. DynamoDB Streams trigger cleanup Lambda.
  2. Delete all items with `PK=EVT#{eventId}`.
  3. Delete all S3 objects in `events/{eventId}/` prefix.
  4. Send confirmation email: "Your event [title] has been permanently deleted."
- **HTTP status:** `200 OK` for soft delete, `200 OK` for undo.
- **Component responsible:** Lambda (deleteEvent) + DynamoDB (TTL for hard delete) + Lambda (cleanup via Streams).

---

### 32. Host clears all media (without deleting event)

**Scenario:** Host wants to keep the event active but remove all uploaded photos (e.g., test photos before the real event).

**Resolution:**
- **Frontend (Browser):**
  1. Settings > Danger Zone > "Clear All Media" button.
  2. Confirmation modal: "This will permanently delete all 247 photos and videos. The event will remain active and guests can upload new photos."
  3. Require typing "DELETE" to confirm.
- **Backend (Lambda — clearMedia):**
  1. Query all MEDIA items for the event: `PK=EVT#{eventId}, SK begins_with MEDIA#`.
  2. For each media item:
     - Delete S3 objects: original (`uploads/`) and thumbnail (`thumbs/`).
     - Delete DynamoDB MEDIA record.
     - Delete associated REACT records.
  3. Use `BatchWriteItem` for DynamoDB (25 items per batch).
  4. Use S3 `deleteObjects` (1000 objects per batch).
  5. Reset event counters: `UpdateItem` SET `uploadCount = 0`, `totalStorage = 0`.
  6. Return:
     ```json
     {
       "statusCode": 200,
       "body": {
         "message": "All media cleared",
         "deletedCount": 247
       }
     }
     ```
- **Event remains active:** Password still works, QR code still valid, guests can upload new photos.
- **No undo:** Media deletion is immediate and permanent (no soft delete for individual media).
- **HTTP status:** `200 OK`.
- **Component responsible:** Lambda (clearMedia) + S3 (deleteObjects) + DynamoDB (BatchWriteItem).

---

## Gallery Edge Cases

### 33. Gallery with 1000+ items (performance)

**Scenario:** A Premium event has 1000 uploaded photos. Loading all at once would be slow and memory-intensive.

**Resolution:**
- **Backend (Lambda — listMedia):**
  1. Cursor-based pagination: DynamoDB `Query` with `Limit: 20`.
  2. Return `LastEvaluatedKey` as the `nextCursor` in the response.
  3. Response:
     ```json
     {
       "items": [...20 media items...],
       "nextCursor": "base64-encoded-key",
       "totalCount": 1000
     }
     ```
  4. `totalCount` is read from the event's `uploadCount` attribute (not counted per query).
- **Frontend (Browser — Mobile):**
  1. Virtual scrolling (e.g., `react-virtual` or `@tanstack/virtual`) for the masonry grid.
  2. Only render DOM elements for visible + buffer items (visible viewport + 5 items above/below).
  3. Load next page when user scrolls within 5 items of the bottom.
  4. "Load more" button as fallback if infinite scroll is problematic on some devices.
  5. Show "Mostrando 1-20 de 1,000" counter.
- **Frontend (Browser — Desktop admin):**
  1. Traditional pagination: "Page 1 of 50" with page number buttons.
  2. 20 items per page.
  3. "Showing 1-20 of 1,000" text.
  4. Previous/Next arrows + first/last page buttons.
- **Image loading optimization:**
  1. Thumbnails are small (400px wide, WebP, ~30-50KB each).
  2. Use `loading="lazy"` attribute on `<img>` tags.
  3. Use `IntersectionObserver` for more precise lazy loading.
  4. Placeholder: blurred CSS gradient or gray skeleton while loading.
- **HTTP status:** `200 OK`.
- **Component responsible:** Lambda (cursor pagination) + Browser (virtual scrolling, lazy loading).

---

### 34. Gallery search returns no results

**Scenario:** Guest searches for "sunset" but no photos match.

**Resolution:**
- **Frontend (Browser):**
  1. Display empty state: centered illustration or icon (Lucide `search` 48px, `$text-tertiary`).
  2. Text: "No se encontraron fotos para '[search term]'" (`Inter 400 16px`, `$text-secondary`).
  3. "Limpiar busqueda" button (secondary) to clear search input and show full gallery.
  4. Optional: suggest alternative searches or show recent uploads below the empty state.
- **Backend (Lambda — listMedia):**
  1. Search query parameter filters by uploader name or date string.
  2. DynamoDB `FilterExpression` on the query results (not a full-text search — limited to attribute matching).
  3. Return empty `items` array with `totalCount: 0`:
     ```json
     {
       "items": [],
       "nextCursor": null,
       "totalCount": 0
     }
     ```
- **Limitation:** DynamoDB is not a search engine. Search is limited to exact/prefix matching on uploader name and date. Full-text search or tag-based search would require ElasticSearch/OpenSearch (future enhancement, not MVP).
- **HTTP status:** `200 OK` (empty results is not an error).
- **Component responsible:** Browser (empty state UI) + Lambda (filter query).

---

### 35. Image fails to load (CloudFront signed URL expired)

**Scenario:** Guest has been viewing the gallery for over 1 hour. CloudFront signed URLs expire. Thumbnails that were not loaded yet (or need to reload) return 403.

**Resolution:**
- **Frontend (Browser):**
  1. `<img>` `onerror` handler detects 403 from CloudFront.
  2. On first 403:
     - Show placeholder (gray skeleton or Lucide `image` icon in gray).
     - Trigger a refetch of the media list: `GET /media?eventId={id}&cursor={currentCursor}`.
     - New response contains fresh signed URLs (valid for another hour).
     - Replace image `src` attributes with new URLs.
  3. Debounce the refetch: if multiple images fail simultaneously (common when scrolling after long idle), batch into a single API call (300ms debounce).
  4. Maximum 3 refetch attempts before showing permanent error placeholder: "No se pudo cargar la imagen."
- **Backend:** No changes needed. `listMedia` always returns fresh signed URLs.
- **Prevention:** CloudFront signed URLs have a 1-hour TTL. For long sessions, proactively refetch URLs every 45 minutes via a background timer.
- **Component responsible:** Browser (onerror handler, URL refresh logic).

---

## QR Code Edge Cases

### 36. QR code scanned before event start date

**Scenario:** Host creates an event starting March 15, shares the QR code early. Guest scans on March 10.

**Resolution:**
- **Backend (Lambda — getEvent):**
  1. Return event data with `status: "created"` (not yet active).
  2. Include `startDate` in response.
- **Frontend (Browser — Guest Entry, Screen 2):**
  1. Status badge shows "Proximo" (gold, `$accent-gold`).
  2. Display countdown: "El evento comienza en 5 dias, 3 horas" (updated every minute).
  3. Password form is visible and functional — guest can authenticate early.
  4. After authentication:
     - Gallery page loads but is empty.
     - Upload UI is disabled: "Las subidas se habilitaran cuando comience el evento."
     - Gallery shows: "El evento aun no ha comenzado. Vuelve el 15 de marzo."
  5. Reactions and comments are also disabled until event starts.
- **Why allow early auth:** So guests can verify their password works before the event. Reduces "I can't get in" issues during the actual event.
- **HTTP status:** `200 OK` (event exists, just not started).
- **Component responsible:** Browser (countdown UI, disabled upload) + Lambda (status check in getUploadUrl).

---

### 37. QR code shared on social media (mass scanning)

**Scenario:** A guest posts the QR code on Instagram/TikTok. Thousands of people scan it.

**Resolution:**
- **API Gateway rate limiting:**
  1. Default throttle: 50 requests/second per route.
  2. `GET /e/{eventId}` is lightweight (single DynamoDB read). Can handle high volume.
  3. If rate limit exceeded: API Gateway returns `429 Too Many Requests` automatically.
- **Password protection:** Even if thousands scan the QR, they can't access the gallery without the event password. The QR code only loads the entry page.
- **Scan tracking:** `totalScans` counter will spike but this is just an atomic increment — negligible DynamoDB cost.
- **DDoS concerns:**
  - API Gateway has built-in throttling.
  - CloudFront (if fronting API Gateway) provides DDoS protection at the edge.
  - WAF deferred until revenue > $100/mo (per project decision).
  - Each scan is a single lightweight GET request — not resource intensive.
- **Cost impact:** Minimal. DynamoDB on-demand pricing: $1.25 per million reads. 10,000 scans = $0.0125. S3/CloudFront not involved until after authentication.
- **Brute force password attempts:** After the event page loads, attackers might try to brute-force the password. Mitigation:
  - Rate limit `POST /auth` to 10 requests/second per IP.
  - Account lockout: after 10 failed password attempts from the same IP hash, block for 15 minutes.
  - bcrypt's inherent slowness (~100ms per comparison) limits throughput.
- **Component responsible:** API Gateway (rate limiting) + Lambda (password verification with rate tracking) + CloudFront (edge DDoS protection).

---

## Storage Edge Cases

### 38. Free tier storage cleanup after 15 days

**Scenario:** A free event was created 15 days ago. Time to clean up S3 and DynamoDB.

**Resolution:**
- **S3 Lifecycle Rule:**
  1. Rule name: `free-tier-cleanup`.
  2. Filter: objects with tag `tier=free` under `events/` prefix.
  3. Action: Expire (delete) after 15 days from object creation.
  4. Tags are set during presigned URL generation: `x-amz-tagging: tier=free&eventId={id}`.
- **DynamoDB TTL:**
  1. Event META item has `TTL` attribute set to `createdAt + 1296000` (15 days in seconds).
  2. DynamoDB automatically deletes the item after TTL (eventually consistent, may take up to 48 hours after TTL timestamp).
- **Alignment issue:** DynamoDB TTL and S3 Lifecycle may not fire at exactly the same time. Gap is acceptable:
  - If DynamoDB deletes first: guest sees 404 for event. S3 objects become orphaned but are cleaned by lifecycle within hours.
  - If S3 deletes first: gallery shows broken images (signed URLs point to deleted objects). Event still accessible but degraded. DynamoDB TTL fires soon after.
- **DynamoDB Streams cleanup:** When EVENT META is deleted by TTL:
  1. DynamoDB Stream captures the delete event.
  2. Cleanup Lambda queries remaining items with same PK and batch-deletes them.
  3. Also triggers S3 `deleteObjects` for any remaining objects in `events/{eventId}/` prefix (belt and suspenders with lifecycle).
- **Component responsible:** S3 (Lifecycle Rules) + DynamoDB (TTL) + Lambda (Streams-based cleanup).

---

### 39. Premium event at 365-day mark (transition to Glacier)

**Scenario:** A Premium event ended 365 days ago. Time to archive to Glacier Deep Archive.

**Resolution:**
- **S3 Lifecycle Rule:**
  1. Rule name: `premium-tier-archive`.
  2. Filter: objects with tag `tier=premium` under `events/` prefix.
  3. Transition: move to Glacier Deep Archive after 365 days from object creation.
  4. Expiration: delete after 730 days (365 active + 365 archived = 2 years total).
- **Pre-archive warning (EventBridge + Lambda):**
  1. Daily EventBridge rule triggers `sendArchiveWarnings` Lambda.
  2. Query premium events where `endDate + 358 days <= now` (7 days before archive).
  3. Send email via SES: "Your event '[title]' will be archived in 7 days. After archiving, photos will take 12-48 hours to retrieve. Download them now if you want immediate access."
  4. Include "Download All Photos" CTA button (ZIP download).
- **After archive (Glacier Deep Archive):**
  1. CloudFront signed URLs for archived objects return `403 Forbidden` (Glacier objects are not directly accessible).
  2. Frontend detects archived state from event metadata (`storageClass: "DEEP_ARCHIVE"`).
  3. Gallery shows: "Tus fotos estan archivadas. Solicita la restauracion para verlas (12-48 horas)."
  4. "Restore" button: triggers `POST /events/{eventId}/restore`:
     - Lambda calls `S3.restoreObject()` with `Days: 7, Tier: "Bulk"` for each object.
     - Bulk retrieval: 5-12 hours, cheapest option.
     - Estimated cost shown: "$0.02 per GB" (transparent pricing).
  5. Poll restoration status. Once complete, signed URLs work again for 7 days.
- **After 730 days (2 years total):**
  1. S3 lifecycle expires (permanently deletes) all objects.
  2. DynamoDB TTL deletes event record.
  3. Send final email: "Your event '[title]' data has been permanently deleted after the 2-year retention period."
- **Component responsible:** S3 (Lifecycle Rules — transition + expiration) + EventBridge (warning cron) + Lambda (warning emails, restore requests) + SES (emails).

---

## Color Theme Edge Cases

### 40. Custom theme applied on guest-facing pages

**Scenario:** Host selects "coral" theme in the Customize screen. Guest pages need to reflect this theme.

**Resolution:**
- **Data model:** Event record stores `colorTheme: "coral"` (enum: `"green"` | `"blue"` | `"coral"` | `"gold"`). Default: `"green"`.
- **Backend (Lambda — getEvent):** Returns `colorTheme` in event data.
- **Frontend (Browser — Guest pages):** Apply CSS custom properties dynamically based on theme:
  ```css
  /* Default (green) */
  :root {
    --accent: #22C55E;
    --accent-dark: #16A34A;
    --accent-light: #DCFCE7;
  }

  /* Blue */
  [data-theme="blue"] {
    --accent: #3B82F6;
    --accent-dark: #2563EB;
    --accent-light: #DBEAFE;
  }

  /* Coral */
  [data-theme="coral"] {
    --accent: #F87171;
    --accent-dark: #DC2626;
    --accent-light: #FEE2E2;
  }

  /* Gold */
  [data-theme="gold"] {
    --accent: #F59E0B;
    --accent-dark: #D97706;
    --accent-light: #FEF3C7;
  }
  ```
  Apply `data-theme` attribute to `<html>` element on event page load.
- **Affected elements:** Primary buttons, FAB, active tab indicator, active nav icons, links, progress bars, badges, focus rings, success states. All reference `var(--accent)` instead of hardcoded `#22C55E`.
- **Admin dashboard:** NOT themed. Dashboard always uses the default green theme (consistent admin experience).
- **Email templates:** NOT themed. Emails always use default green. Theming emails would require storing pre-rendered color values in the email template data and adds complexity for minimal value.
- **Edge case within edge case — theme not set:** If `colorTheme` is `null` or `undefined` (old events created before feature), default to `"green"`.
- **Accessibility:** All theme colors have been verified for WCAG AA contrast against white (`#FFFFFF`) and dark text (`#111827`). The coral theme's dark variant (`#DC2626`) is used for text to ensure readability.
- **Component responsible:** Browser (CSS custom properties) + Lambda (returns `colorTheme` in event data).

---

## Miscellaneous Edge Cases

### 41. JWT tampering / forged token

**Scenario:** An attacker modifies the JWT payload (e.g., changes `role: "guest"` to `role: "host"`) or creates a fake JWT.

**Resolution:**
- **Backend (Lambda — JWT verification middleware):**
  1. JWT is signed with HMAC-SHA256 using a secret stored in AWS Systems Manager Parameter Store (SecureString).
  2. `jwt.verify()` validates both the signature and expiration.
  3. If signature is invalid: return `401 Unauthorized` with `INVALID_TOKEN`.
  4. The secret is rotated every 90 days. Old tokens signed with previous secret fail verification immediately.
- **Token structure:**
  ```json
  {
    "eventId": "uuid",
    "role": "guest",
    "guestId": "uuid",
    "verified": false,
    "iat": 1709136000,
    "exp": 1709222400
  }
  ```
- **No JWT blacklist/revocation:** Tokens are stateless. Revocation is not implemented (would require a DB lookup on every request). Instead: short TTL (24h for guests, 7d for hosts) limits damage.
- **HTTP status:** `401 Unauthorized`.
- **Component responsible:** Lambda (JWT verification middleware) + SSM (secret storage).

---

### 42. API Gateway timeout (29-second limit)

**Scenario:** A Lambda function takes longer than 29 seconds (API Gateway HTTP API timeout) — e.g., ZIP download generation for a large event.

**Resolution:**
- **Architecture:** For long-running operations, use async pattern:
  1. `POST /events/{eventId}/download` → Lambda creates a "job" record in DynamoDB with `status: "processing"` and returns immediately with `jobId`.
  2. The actual ZIP creation runs as an async Lambda invocation (`InvocationType: "Event"`) or Step Functions.
  3. Frontend polls `GET /events/{eventId}/download/{jobId}` every 5 seconds.
  4. When ZIP is ready: job record updated to `status: "complete"` with `downloadUrl`.
  5. Response to poll:
     ```json
     {
       "status": "processing",
       "progress": 65,
       "message": "Compressing 178 of 247 photos..."
     }
     ```
     or
     ```json
     {
       "status": "complete",
       "downloadUrl": "https://...",
       "fileSize": 156000000,
       "expiresAt": "2026-03-07T..."
     }
     ```
- **Lambda timeout:** Set Lambda timeout to 15 minutes (maximum) for the async ZIP Lambda. This allows processing up to ~2GB of photos.
- **HTTP status:** `202 Accepted` for initial request, `200 OK` for poll results.
- **Component responsible:** Lambda (async invocation pattern) + DynamoDB (job tracking) + Frontend (polling UI).

---

### 43. CORS issues (cross-origin requests)

**Scenario:** Frontend at `https://app.eventalbum.io` calls API at `https://api.eventalbum.io`. Browser blocks due to CORS.

**Resolution:**
- **API Gateway HTTP API:** Configure CORS in the SAM template:
  ```yaml
  CorsConfiguration:
    AllowOrigins:
      - "https://app.eventalbum.io"
      - "http://localhost:5173"  # Vite dev server
    AllowMethods:
      - GET
      - POST
      - PUT
      - PATCH
      - DELETE
      - OPTIONS
    AllowHeaders:
      - Authorization
      - Content-Type
      - X-Requested-With
    MaxAge: 86400  # 24-hour preflight cache
    AllowCredentials: false
  ```
- **S3 (presigned PUT uploads):** Configure CORS on the S3 bucket:
  ```json
  {
    "CORSRules": [{
      "AllowedOrigins": ["https://app.eventalbum.io", "http://localhost:5173"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type", "Content-Length"],
      "MaxAgeSeconds": 86400
    }]
  }
  ```
- **CloudFront:** CORS headers are passed through from origin (S3 or API Gateway). No additional config needed.
- **Component responsible:** API Gateway (CORS config) + S3 (bucket CORS policy).

---

### 44. Browser storage quota exceeded (localStorage/IndexedDB)

**Scenario:** Guest device has limited storage. Offline upload queue in IndexedDB exceeds available space.

**Resolution:**
- **Frontend (Browser):**
  1. Wrap IndexedDB writes in try/catch.
  2. On `QuotaExceededError`:
     - Show: "Tu dispositivo no tiene espacio suficiente. Sube las fotos que tienes en cola antes de agregar mas."
     - Stop accepting new items in the offline queue.
     - Process existing queue items (upload them) to free space.
  3. Monitor storage usage via `navigator.storage.estimate()` (where available):
     ```javascript
     const {usage, quota} = await navigator.storage.estimate();
     const percentUsed = (usage / quota) * 100;
     if (percentUsed > 80) {
       showWarning("Storage almost full. Upload queued photos to free space.");
     }
     ```
  4. Maximum 20 items in offline queue (hard limit) to prevent storage issues on low-end devices.
  5. localStorage is limited to ~5MB per origin. Only store JWT and small config values there. Never store image data in localStorage.
- **Component responsible:** Browser (storage management, try/catch on writes).

---

### 45. CloudFront cache invalidation after media deletion

**Scenario:** Host deletes a photo. The S3 object is deleted, but CloudFront may serve a cached copy for up to 24 hours.

**Resolution:**
- **Short TTL approach (preferred):** Set CloudFront cache TTL to 1 hour (`Cache-Control: max-age=3600`) for media objects. After deletion, the cached copy expires naturally within 1 hour.
- **Signed URLs approach (current design):** Since all media is served via CloudFront signed URLs with 1-hour expiry, the cache key includes the URL signature. Deleted objects cannot be accessed because:
  1. New `listMedia` calls don't return the deleted item (no signed URL generated).
  2. Old signed URLs expire within 1 hour.
  3. Even if someone has a cached signed URL, CloudFront will try to fetch from S3 origin on cache miss and get a 404.
- **No manual cache invalidation needed:** The signed URL pattern naturally handles this. CloudFront invalidation API calls ($0.005 per path) are not needed.
- **Component responsible:** CloudFront (signed URLs + TTL-based expiration).

---

### 46. Concurrent event setting changes by host in multiple tabs

**Scenario:** Host has Settings page open in two tabs. Changes a toggle in Tab A, then changes a different toggle in Tab B. Tab B's save overwrites Tab A's change.

**Resolution:**
- **Backend (Lambda — updateSettings):**
  1. Accept partial updates: each toggle change sends only the changed field, not the entire settings object.
     ```json
     PATCH /events/{eventId}/settings
     { "allowDownloads": false }
     ```
  2. DynamoDB `UpdateItem` with `SET allowDownloads = :value` — only updates the specified attribute, leaving all others unchanged.
  3. This eliminates write conflicts: Tab A's `requirePassword = true` and Tab B's `allowDownloads = false` apply independently.
- **Frontend (Browser):**
  1. Each toggle triggers an immediate API call (optimistic update).
  2. No "Save All" button for settings — each toggle is saved independently.
  3. `storage` event listener (same as Edge Case #10) can sync toggle states across tabs, though this is a nice-to-have, not critical.
- **Component responsible:** Lambda (partial update pattern) + DynamoDB (attribute-level updates).

---

### 47. Email deliverability issues (SES)

**Scenario:** Host's email provider (e.g., Gmail, Outlook) marks EventAlbum emails as spam, or SES is in sandbox mode.

**Resolution:**
- **SES configuration:**
  1. Request production access (exit sandbox) before launch.
  2. Set up SPF, DKIM, and DMARC for `eventalbum.io` domain.
  3. Use a dedicated sending subdomain: `mail.eventalbum.io`.
  4. Configure SES notifications (SNS) for bounces and complaints.
- **Bounce handling:**
  1. SNS topic receives bounce notifications from SES.
  2. Lambda processes bounces:
     - Hard bounce: mark email as undeliverable in DynamoDB. Don't send future emails.
     - Soft bounce: retry once after 1 hour.
  3. Maintain bounce rate < 5% (SES requirement).
- **Complaint handling:**
  1. SNS topic receives complaint notifications.
  2. Lambda adds email to suppression list.
  3. Maintain complaint rate < 0.1% (SES requirement).
- **Frontend (Browser):**
  1. After requesting OTP: "Revisa tu correo. Si no lo ves, busca en la carpeta de spam."
  2. After event creation: "Te enviamos un correo con los detalles. Revisa spam si no lo ves en unos minutos."
- **Component responsible:** SES (email delivery) + SNS (bounce/complaint notifications) + Lambda (bounce processing) + DNS (SPF/DKIM/DMARC).

---

### 48. Video upload edge cases (Paid/Premium only)

**Scenario:** Guest uploads a video on a Paid or Premium event. Videos have different constraints than images.

**Resolution:**
- **Constraints:**
  - Maximum duration: 60 seconds.
  - Maximum file size: 50MB.
  - Allowed formats: MP4, MOV (H.264/H.265 codec).
  - Free tier: video uploads disabled.
- **Frontend (Browser):**
  1. Check tier before showing video upload option.
  2. Client-side validation: read file metadata to check duration (if possible via `<video>` element).
  3. No client-side compression for video (too CPU-intensive). Upload original.
  4. Show file size warning if > 30MB: "Este video es grande. La subida puede tardar unos minutos."
- **Backend (Lambda — getUploadUrl):**
  1. Check `allowVideoUploads` setting on event.
  2. Check tier >= "paid".
  3. Validate `contentType` is `video/mp4` or `video/quicktime`.
  4. Validate `fileSize <= 52428800` (50MB).
  5. If video not allowed or tier insufficient:
     ```json
     {
       "statusCode": 403,
       "body": {
         "error": "VIDEO_NOT_ALLOWED",
         "message": "Video uploads require a Paid or Premium plan."
       }
     }
     ```
- **Backend (Lambda — processUpload):**
  1. For video files: generate thumbnail from first frame (using `ffmpeg` Lambda layer).
  2. No Rekognition moderation for video (Rekognition Video is expensive and async — not MVP).
  3. Video status follows same rules as images (auto-approve or pending based on event settings).
- **HTTP status:** `403 Forbidden` if tier/setting doesn't allow video.
- **Component responsible:** Browser (file validation) + Lambda (getUploadUrl tier check, processUpload thumbnail generation).
