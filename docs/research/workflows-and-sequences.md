# Workflow Sequence Diagrams

All major platform flows documented with full system-component interaction sequences. Each diagram shows the data flow between the user, browser/client, API Gateway, Lambda functions, DynamoDB, S3/CloudFront, and external services (SES, SNS, Recurrente, Rekognition).

---

## 1. Guest Flow — Free Event (Full Lifecycle)

### 1a. QR Scan and Event Loading

```
Guest                    Browser              API Gateway        Lambda             DynamoDB         S3/CloudFront
  |                        |                      |                |                   |                |
  |-- Scan QR code ------->|                      |                |                   |                |
  |  (camera / URL click)  |                      |                |                   |                |
  |                        |-- GET /e/{eventId} ->|                |                   |                |
  |                        |                      |-- getEvent --->|                   |                |
  |                        |                      |                |-- GetItem ------->|                |
  |                        |                      |                |   PK=EVT#{eventId}|                |
  |                        |                      |                |   SK=META         |                |
  |                        |                      |                |<-- Event record --|                |
  |                        |                      |                |                   |                |
  |                        |                      |                |-- Check status ---|                |
  |                        |                      |                |   (active/ended/  |                |
  |                        |                      |                |    not started)    |                |
  |                        |                      |                |                   |                |
  |                        |                      |                |-- Track scan ---->|                |
  |                        |                      |                |   UpdateItem:     |                |
  |                        |                      |                |   totalScans += 1 |                |
  |                        |                      |                |   hash(IP) check  |                |
  |                        |                      |                |   uniqueVisitors  |                |
  |                        |                      |                |   lastScannedAt   |                |
  |                        |                      |                |<-- Updated ------|                |
  |                        |                      |                |                   |                |
  |                        |                      |<-- Event data -|                   |                |
  |                        |<-- Render entry page-|                |                   |                |
  |                        |   (title, date,      |                |                   |                |
  |                        |    description,      |                |                   |                |
  |                        |    cover image,      |                |                   |                |
  |                        |    status badge)     |                |                   |                |
  |<-- Display event page -|                      |                |                   |                |
```

### 1b. Guest Authentication (Password)

```
Guest                    Browser              API Gateway        Lambda             DynamoDB
  |                        |                      |                |                   |
  |-- Enter password ----->|                      |                |                   |
  |                        |-- POST /auth ------->|                |                   |
  |                        |   {eventId, password}|                |                   |
  |                        |                      |-- authEvent -->|                   |
  |                        |                      |                |-- GetItem ------->|
  |                        |                      |                |   PK=EVT#{eventId}|
  |                        |                      |                |   SK=META         |
  |                        |                      |                |<-- Event record --|
  |                        |                      |                |   (passwordHash,  |
  |                        |                      |                |    hostPassword)   |
  |                        |                      |                |                   |
  |                        |                      |                |-- bcrypt.compare -|
  |                        |                      |                |   (password,      |
  |                        |                      |                |    passwordHash)   |
  |                        |                      |                |                   |
  |                        |                      |                |   [If match guest |
  |                        |                      |                |    password:]      |
  |                        |                      |                |-- Sign JWT -------|
  |                        |                      |                |   {eventId,       |
  |                        |                      |                |    role: "guest",  |
  |                        |                      |                |    guestId: uuid,  |
  |                        |                      |                |    exp: 24h}       |
  |                        |                      |                |                   |
  |                        |                      |                |   [If match host  |
  |                        |                      |                |    password:]      |
  |                        |                      |                |-- Sign JWT -------|
  |                        |                      |                |   {eventId,       |
  |                        |                      |                |    role: "host",   |
  |                        |                      |                |    exp: 7d}        |
  |                        |                      |                |                   |
  |                        |                      |                |   [If no match:]  |
  |                        |                      |                |-- Return 401 -----|
  |                        |                      |                |   INVALID_PASSWORD|
  |                        |                      |                |                   |
  |                        |                      |<-- Response ---|                   |
  |                        |<-- JWT token --------|                |                   |
  |                        |   (stored in         |                |                   |
  |                        |    localStorage)     |                |                   |
  |<-- Redirect to gallery-|                      |                |                   |
```

### 1c. View Gallery

```
Guest                    Browser              API Gateway        Lambda             DynamoDB         CloudFront
  |                        |                      |                |                   |                |
  |-- Open gallery ------->|                      |                |                   |                |
  |                        |-- GET /media ------->|                |                   |                |
  |                        |   ?eventId={id}      |                |                   |                |
  |                        |   &limit=20          |                |                   |                |
  |                        |   &cursor={cursor}   |                |                   |                |
  |                        |   Authorization: JWT |                |                   |                |
  |                        |                      |-- Verify JWT ->|                   |                |
  |                        |                      |                |-- jwt.verify -----|                |
  |                        |                      |                |   (check exp,     |
  |                        |                      |                |    eventId match)  |
  |                        |                      |                |                   |                |
  |                        |                      |-- listMedia -->|                   |                |
  |                        |                      |                |-- Query --------->|                |
  |                        |                      |                |   PK=EVT#{eventId}|                |
  |                        |                      |                |   SK begins_with  |                |
  |                        |                      |                |   MEDIA#          |                |
  |                        |                      |                |   status=visible  |                |
  |                        |                      |                |   Limit=20        |                |
  |                        |                      |                |<-- Media items ---|                |
  |                        |                      |                |   [{mediaId,      |                |
  |                        |                      |                |     s3Key,        |                |
  |                        |                      |                |     thumbKey,     |                |
  |                        |                      |                |     uploadedBy,   |                |
  |                        |                      |                |     createdAt,    |                |
  |                        |                      |                |     reactionCount}]                |
  |                        |                      |                |                   |                |
  |                        |                      |                |-- Sign CloudFront |                |
  |                        |                      |                |   URLs for each   |                |
  |                        |                      |                |   thumbKey and    |                |
  |                        |                      |                |   s3Key           |                |
  |                        |                      |                |   (exp: 1 hour)   |                |
  |                        |                      |                |                   |                |
  |                        |                      |<-- Response ---|                   |                |
  |                        |<-- {items, cursor} --|                |                   |                |
  |                        |                      |                |                   |                |
  |                        |-- Load thumbnails -->|                |                   |    [CloudFront]|
  |                        |   (signed URLs)      |                |                   |    |  CDN     ||
  |                        |                      |                |                   |    |  edge    ||
  |                        |<-- Image bytes ------|----------------|-------------------|----| location ||
  |                        |                      |                |                   |    [if cached] |
  |                        |                      |                |                   |                |
  |<-- Render masonry grid-|                      |                |                   |    [if miss]:  |
  |                        |                      |                |                   |    |-- S3 GET ||
  |                        |                      |                |                   |    |<- bytes  ||
  |                        |                      |                |                   |    |-- cache  ||
```

### 1d. Upload Photo (Free Tier)

```
Guest                    Browser              API Gateway        Lambda             DynamoDB              S3
  |                        |                      |                |                   |                    |
  |-- Select photo(s) ---->|                      |                |                   |                    |
  |                        |                      |                |                   |                    |
  |                        |-- Client-side -------|                |                   |                    |
  |                        |   compression:       |                |                   |                    |
  |                        |   - Read file         |                |                   |                    |
  |                        |   - Canvas resize     |                |                   |                    |
  |                        |     (max 1920px)      |                |                   |                    |
  |                        |   - Quality 0.8       |                |                   |                    |
  |                        |   - JPEG/WebP output  |                |                   |                    |
  |                        |   - SHA-256 hash      |                |                   |                    |
  |                        |     (first 1MB,       |                |                   |                    |
  |                        |      dedup check)     |                |                   |                    |
  |                        |                      |                |                   |                    |
  |                        |-- POST /upload-url ->|                |                   |                    |
  |                        |   {eventId,           |                |                   |                    |
  |                        |    fileName,          |                |                   |                    |
  |                        |    contentType,       |                |                   |                    |
  |                        |    fileSize,          |                |                   |                    |
  |                        |    fileHash}          |                |                   |                    |
  |                        |   Authorization: JWT  |                |                   |                    |
  |                        |                      |-- getUploadUrl>|                   |                    |
  |                        |                      |                |-- Verify JWT -----|                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- GetItem ------->|                    |
  |                        |                      |                |   (event record)  |                    |
  |                        |                      |                |<-- Event data ----|                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Validate: ------|                    |
  |                        |                      |                |   1. Event active?|                    |
  |                        |                      |                |   2. uploadCount  |                    |
  |                        |                      |                |      < uploadLimit|                    |
  |                        |                      |                |      (150 free)   |                    |
  |                        |                      |                |   3. File type OK?|                    |
  |                        |                      |                |   4. File size OK?|                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |   [If limit       |                    |
  |                        |                      |                |    reached:]      |                    |
  |                        |                      |                |-- Return 429 -----|                    |
  |                        |                      |                |   UPLOAD_LIMIT_   |                    |
  |                        |                      |                |   REACHED         |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |   [If valid:]     |                    |
  |                        |                      |                |-- Generate S3 ----|------------------>|
  |                        |                      |                |   presigned PUT   |  createPresigned  |
  |                        |                      |                |   URL             |  URL              |
  |                        |                      |                |   key: events/    |                    |
  |                        |                      |                |   {eventId}/      |                    |
  |                        |                      |                |   uploads/{uuid}  |                    |
  |                        |                      |                |   .{ext}          |                    |
  |                        |                      |                |   (exp: 15 min)   |                    |
  |                        |                      |                |<-- Presigned URL -|                    |
  |                        |                      |                |                   |                    |
  |                        |                      |<-- {uploadUrl, |                   |                    |
  |                        |                      |     mediaId,   |                   |                    |
  |                        |                      |     s3Key} ----|                   |                    |
  |                        |<-- Presigned URL ----|                |                   |                    |
  |                        |                      |                |                   |                    |
  |                        |-- PUT to S3 ---------|----------------|-------------------|------------------>|
  |                        |   (direct upload,    |                |                   |      [S3 bucket]  |
  |                        |    compressed file,  |                |                   |      events/      |
  |                        |    Content-Type,     |                |                   |      {eventId}/   |
  |                        |    progress events)  |                |                   |      uploads/     |
  |                        |                      |                |                   |      {uuid}.jpg   |
  |                        |<-- 200 OK -----------|----------------|-------------------|----               |
  |                        |                      |                |                   |                    |
  |<-- "Upload complete"---|                      |                |                   |                    |
  |    progress: 100%      |                      |                |                   |                    |
```

### 1e. Upload Processing Pipeline (S3 Trigger)

```
                                                                  Lambda             DynamoDB              S3
                                                                  (processUpload)                          |
                                                                    |                   |                    |
[S3 Event Notification: ObjectCreated] --------------------------->|                   |                    |
   key: events/{eventId}/uploads/{uuid}.jpg                        |                   |                    |
                                                                    |                   |                    |
                                                                    |-- GetObject ------|------------------>|
                                                                    |   (read uploaded  |   [Read original] |
                                                                    |    image)         |                    |
                                                                    |<-- Image bytes ---|----                |
                                                                    |                   |                    |
                                                                    |-- Validate: ------|                    |
                                                                    |   1. Magic bytes  |                    |
                                                                    |      (JPEG/PNG/   |                    |
                                                                    |       WebP/HEIC)  |                    |
                                                                    |   2. File size    |                    |
                                                                    |      <= 10MB      |                    |
                                                                    |                   |                    |
                                                                    |   [If invalid:]   |                    |
                                                                    |-- DeleteObject ---|------------------>|
                                                                    |   (remove bad     |  [Delete invalid] |
                                                                    |    file)          |                    |
                                                                    |-- Return ---------|                    |
                                                                    |   (no DB record)  |                    |
                                                                    |                   |                    |
                                                                    |   [If valid:]     |                    |
                                                                    |-- Generate thumbnail                   |
                                                                    |   (sharp library) |                    |
                                                                    |   - 400px wide    |                    |
                                                                    |   - quality 0.7   |                    |
                                                                    |   - WebP format   |                    |
                                                                    |                   |                    |
                                                                    |-- PutObject ------|------------------>|
                                                                    |   key: events/    |  [Save thumbnail] |
                                                                    |   {eventId}/      |  events/{eventId}/|
                                                                    |   thumbs/{uuid}   |  thumbs/{uuid}    |
                                                                    |   .webp           |  .webp             |
                                                                    |                   |                    |
                                                                    |-- Extract EXIF ---|                    |
                                                                    |   (date, camera,  |                    |
                                                                    |    GPS if present)|                    |
                                                                    |                   |                    |
                                                                    |-- UpdateItem ---->|                    |
                                                                    |   PK=EVT#{eventId}|                   |
                                                                    |   SK=META         |                    |
                                                                    |   SET uploadCount |                    |
                                                                    |     = uploadCount |                    |
                                                                    |       + 1         |                    |
                                                                    |   SET totalStorage|                    |
                                                                    |     += fileSize   |                    |
                                                                    |   Condition:      |                    |
                                                                    |     uploadCount   |                    |
                                                                    |     < uploadLimit |                    |
                                                                    |<-- Success -------|                    |
                                                                    |                   |                    |
                                                                    |-- PutItem ------->|                    |
                                                                    |   PK=EVT#{eventId}|                   |
                                                                    |   SK=MEDIA#{uuid} |                    |
                                                                    |   {mediaId, s3Key,|                    |
                                                                    |    thumbKey,      |                    |
                                                                    |    uploadedBy,    |                    |
                                                                    |    fileSize,      |                    |
                                                                    |    contentType,   |                    |
                                                                    |    status:visible,|                    |
                                                                    |    createdAt,     |                    |
                                                                    |    exifData}      |                    |
                                                                    |<-- Success -------|                    |
```

### 1f. React to Media

```
Guest                    Browser              API Gateway        Lambda             DynamoDB
  |                        |                      |                |                   |
  |-- Tap heart emoji ---->|                      |                |                   |
  |                        |-- Optimistic UI -----|                |                   |
  |                        |   (increment count   |                |                   |
  |                        |    immediately)      |                |                   |
  |                        |                      |                |                   |
  |                        |-- POST /reactions -->|                |                   |
  |                        |   {mediaId, eventId, |                |                   |
  |                        |    type: "heart"}    |                |                   |
  |                        |   Authorization: JWT |                |                   |
  |                        |                      |-- addReaction->|                   |
  |                        |                      |                |-- PutItem ------->|
  |                        |                      |                |   PK=EVT#{eventId}|
  |                        |                      |                |   SK=REACT#{mediaId}|
  |                        |                      |                |      #{guestId}   |
  |                        |                      |                |   {type, createdAt}|
  |                        |                      |                |                   |
  |                        |                      |                |-- UpdateItem ---->|
  |                        |                      |                |   PK=EVT#{eventId}|
  |                        |                      |                |   SK=MEDIA#{mediaId}
  |                        |                      |                |   SET reactions.  |
  |                        |                      |                |     heart += 1    |
  |                        |                      |                |<-- Updated ------|
  |                        |                      |<-- 200 OK ----|                   |
  |                        |<-- Confirmed --------|                |                   |
  |                        |                      |                |                   |
  |-- Tap heart again ---->|                      |                |                   |
  |  (toggle off)          |-- DELETE /reactions->|                |                   |
  |                        |   {mediaId, eventId, |                |                   |
  |                        |    type: "heart"}    |                |                   |
  |                        |                      |-- rmReaction ->|                   |
  |                        |                      |                |-- DeleteItem ---->|
  |                        |                      |                |   PK=EVT#{eventId}|
  |                        |                      |                |   SK=REACT#{mediaId}|
  |                        |                      |                |      #{guestId}   |
  |                        |                      |                |                   |
  |                        |                      |                |-- UpdateItem ---->|
  |                        |                      |                |   reactions.      |
  |                        |                      |                |   heart -= 1      |
  |                        |                      |<-- 200 OK ----|                   |
  |                        |<-- Confirmed --------|                |                   |
```

---

## 2. Guest Flow — Paid/Premium Event (with OTP Verification)

```
Guest                    Browser              API Gateway        Lambda             DynamoDB         SNS/SES
  |                        |                      |                |                   |               |
  |  [After password auth, guest has JWT with role=guest, verified=false]              |               |
  |                        |                      |                |                   |               |
  |-- Tap "Upload" ------->|                      |                |                   |               |
  |                        |-- Check JWT ---------|                |                   |               |
  |                        |   verified=false     |                |                   |               |
  |                        |                      |                |                   |               |
  |<-- Show OTP modal -----|                      |                |                   |               |
  |    "Verify your        |                      |                |                   |               |
  |     identity to        |                      |                |                   |               |
  |     upload"            |                      |                |                   |               |
  |                        |                      |                |                   |               |
  |-- Enter phone # ------>|                      |                |                   |               |
  |   (+502 5555-1234)     |                      |                |                   |               |
  |                        |-- POST /otp/send --->|                |                   |               |
  |                        |   {eventId, channel: |                |                   |               |
  |                        |    "sms", destination:|               |                   |               |
  |                        |    "+50255551234"}   |                |                   |               |
  |                        |   Authorization: JWT |                |                   |               |
  |                        |                      |-- sendOtp ---->|                   |               |
  |                        |                      |                |-- Generate OTP ---|               |
  |                        |                      |                |   (6-digit random)|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- PutItem ------->|               |
  |                        |                      |                |   PK=OTP#{eventId}|               |
  |                        |                      |                |   SK=GUEST#       |               |
  |                        |                      |                |     {destination} |               |
  |                        |                      |                |   {code (hashed), |               |
  |                        |                      |                |    attempts: 0,   |               |
  |                        |                      |                |    TTL: now+5min} |               |
  |                        |                      |                |<-- Stored --------|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- SNS Publish ----|-------------->|
  |                        |                      |                |   PhoneNumber:    |   [SMS sent]  |
  |                        |                      |                |   "+50255551234"  |               |
  |                        |                      |                |   Message:        |               |
  |                        |                      |                |   "Tu codigo:     |               |
  |                        |                      |                |    482719"        |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If SNS fails:] |               |
  |                        |                      |                |-- Catch error ----|               |
  |                        |                      |                |   Return {sent:   |               |
  |                        |                      |                |    false,          |               |
  |                        |                      |                |    fallback: true} |               |
  |                        |                      |                |                   |               |
  |                        |                      |<-- Response ---|                   |               |
  |                        |<-- {sent: true} -----|                |                   |               |
  |                        |                      |                |                   |               |
  |  [Guest receives SMS]  |                      |                |                   |               |
  |                        |                      |                |                   |               |
  |-- Enter OTP code ----->|                      |                |                   |               |
  |   (482719)             |                      |                |                   |               |
  |                        |-- POST /otp/verify ->|                |                   |               |
  |                        |   {eventId,           |                |                   |               |
  |                        |    destination:       |                |                   |               |
  |                        |    "+50255551234",   |                |                   |               |
  |                        |    code: "482719"}   |                |                   |               |
  |                        |                      |-- verifyOtp -->|                   |               |
  |                        |                      |                |-- GetItem ------->|               |
  |                        |                      |                |   PK=OTP#{eventId}|               |
  |                        |                      |                |   SK=GUEST#       |               |
  |                        |                      |                |     {destination} |               |
  |                        |                      |                |<-- OTP record ----|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Check attempts -|               |
  |                        |                      |                |   (< 5 allowed)   |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- timingSafeEqual |               |
  |                        |                      |                |   hash(input) vs  |               |
  |                        |                      |                |   stored hash     |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If match:]     |               |
  |                        |                      |                |-- DeleteItem ---->|               |
  |                        |                      |                |   (remove OTP)    |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- PutItem ------->|               |
  |                        |                      |                |   PK=EVT#{eventId}|               |
  |                        |                      |                |   SK=GUEST#       |               |
  |                        |                      |                |     {guestId}     |               |
  |                        |                      |                |   {verified: true,|               |
  |                        |                      |                |    phone/email,   |               |
  |                        |                      |                |    verifiedAt}    |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Sign new JWT ---|               |
  |                        |                      |                |   {eventId,       |               |
  |                        |                      |                |    role: "guest",  |               |
  |                        |                      |                |    guestId,        |               |
  |                        |                      |                |    verified: true, |               |
  |                        |                      |                |    exp: 24h}       |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If no match:]  |               |
  |                        |                      |                |-- UpdateItem ---->|               |
  |                        |                      |                |   attempts += 1   |               |
  |                        |                      |                |-- Return 401 -----|               |
  |                        |                      |                |   INVALID_OTP     |               |
  |                        |                      |                |   remaining: N    |               |
  |                        |                      |                |                   |               |
  |                        |                      |<-- JWT --------|                   |               |
  |                        |<-- New JWT ----------|                |                   |               |
  |                        |   (replace old JWT   |                |                   |               |
  |                        |    in localStorage)  |                |                   |               |
  |                        |                      |                |                   |               |
  |<-- OTP modal closes ---|                      |                |                   |               |
  |    Upload now enabled  |                      |                |                   |               |
  |                        |                      |                |                   |               |
  |  [Upload flow continues same as Free event, Section 1d]       |                   |               |
```

---

## 3. Host Flow — Create Free Event

```
Host                     Browser              API Gateway        Lambda             DynamoDB         SES
  |                        |                      |                |                   |               |
  |-- Fill event form ---->|                      |                |                   |               |
  |   (title, description, |                      |                |                   |               |
  |    start date, end date|                      |                |                   |               |
  |    guest password,     |                      |                |                   |               |
  |    email)              |                      |                |                   |               |
  |                        |                      |                |                   |               |
  |                        |-- Validate form -----|                |                   |               |
  |                        |   (client-side:      |                |                   |               |
  |                        |    required fields,  |                |                   |               |
  |                        |    date order,       |                |                   |               |
  |                        |    password min 4)   |                |                   |               |
  |                        |                      |                |                   |               |
  |                        |-- POST /events ----->|                |                   |               |
  |                        |   {title, description|                |                   |               |
  |                        |    startDate, endDate|                |                   |               |
  |                        |    guestPassword,    |                |                   |               |
  |                        |    hostEmail,        |                |                   |               |
  |                        |    tier: "free"}     |                |                   |               |
  |                        |                      |-- createEvent->|                   |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Generate -------|               |
  |                        |                      |                |   eventId (uuid)  |               |
  |                        |                      |                |   hostPassword    |               |
  |                        |                      |                |   (random 12 char)|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- bcrypt.hash ----|               |
  |                        |                      |                |   (guestPassword) |               |
  |                        |                      |                |-- bcrypt.hash ----|               |
  |                        |                      |                |   (hostPassword)  |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- PutItem ------->|               |
  |                        |                      |                |   PK=EVT#{eventId}|               |
  |                        |                      |                |   SK=META         |               |
  |                        |                      |                |   {title,         |               |
  |                        |                      |                |    description,   |               |
  |                        |                      |                |    startDate,     |               |
  |                        |                      |                |    endDate,       |               |
  |                        |                      |                |    guestPwdHash,  |               |
  |                        |                      |                |    hostPwdHash,   |               |
  |                        |                      |                |    hostEmail,     |               |
  |                        |                      |                |    tier: "free",  |               |
  |                        |                      |                |    uploadCount: 0,|               |
  |                        |                      |                |    uploadLimit:150|               |
  |                        |                      |                |    status: active,|               |
  |                        |                      |                |    totalScans: 0, |               |
  |                        |                      |                |    uniqueVisitors:|               |
  |                        |                      |                |      0,           |               |
  |                        |                      |                |    createdAt,     |               |
  |                        |                      |                |    TTL: +15 days} |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   GSI1:           |               |
  |                        |                      |                |   GSI1PK=HOST#    |               |
  |                        |                      |                |     {email}       |               |
  |                        |                      |                |   GSI1SK=EVT#     |               |
  |                        |                      |                |     {eventId}     |               |
  |                        |                      |                |<-- Success -------|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- SES SendEmail ->|-------------->|
  |                        |                      |                |   To: hostEmail   |  [Event       |
  |                        |                      |                |   Template:       |   Created     |
  |                        |                      |                |   "Event Created" |   email]      |
  |                        |                      |                |   {eventTitle,    |               |
  |                        |                      |                |    dates,         |               |
  |                        |                      |                |    guestPassword, |               |
  |                        |                      |                |    hostPassword,  |               |
  |                        |                      |                |    QR code,       |               |
  |                        |                      |                |    dashboard URL} |               |
  |                        |                      |                |                   |               |
  |                        |                      |<-- Response ---|                   |               |
  |                        |<-- {eventId,         |                |                   |               |
  |                        |     eventUrl,        |                |                   |               |
  |                        |     hostPassword,    |                |                   |               |
  |                        |     dashboardUrl} ---|                |                   |               |
  |                        |                      |                |                   |               |
  |<-- Success page -------|                      |                |                   |               |
  |    "Your event is      |                      |                |                   |               |
  |     ready! Check       |                      |                |                   |               |
  |     your email."       |                      |                |                   |               |
  |    QR code display     |                      |                |                   |               |
  |    Host password       |                      |                |                   |               |
  |    Dashboard link      |                      |                |                   |               |
```

---

## 4. Host Flow — Purchase Paid/Premium Event (3-Step Wizard)

```
Host                     Browser              API Gateway        Lambda             DynamoDB     Recurrente     SES
  |                        |                      |                |                   |              |            |
  |  [STEP 1: Contact Info — client-side only, no API calls]      |                   |              |            |
  |                        |                      |                |                   |              |            |
  |-- Fill contact info -->|                      |                |                   |              |            |
  |   (name, email, phone) |                      |                |                   |              |            |
  |                        |-- Store in React ----|                |                   |              |            |
  |                        |   state / context    |                |                   |              |            |
  |-- Click "Continue" --->|                      |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |  [STEP 2: Event Details — client-side only, no API calls]     |                   |              |            |
  |                        |                      |                |                   |              |            |
  |-- Fill event details ->|                      |                |                   |              |            |
  |   (title, description, |                      |                |                   |              |            |
  |    dates, password,    |                      |                |                   |              |            |
  |    plan: paid/premium) |                      |                |                   |              |            |
  |                        |-- Store in React ----|                |                   |              |            |
  |                        |   state / context    |                |                   |              |            |
  |-- Click "Continue" --->|                      |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |  [STEP 3: Payment]     |                      |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |-- (Optional) Enter  -->|                      |                |                   |              |            |
  |   promo code           |                      |                |                   |              |            |
  |                        |-- POST /promo ------>|                |                   |              |            |
  |                        |   /validate          |                |                   |              |            |
  |                        |   {code: "LAUNCH20"} |                |                   |              |            |
  |                        |                      |-- validatePromo|                   |              |            |
  |                        |                      |                |-- Read SSM ------>|              |            |
  |                        |                      |                |   /promoCodes/    |              |            |
  |                        |                      |                |   LAUNCH20        |              |            |
  |                        |                      |                |<-- Config --------|              |            |
  |                        |                      |                |   {discount: 20%, |              |            |
  |                        |                      |                |    maxUses: 100,  |              |            |
  |                        |                      |                |    usedCount: 42, |              |            |
  |                        |                      |                |    expiresAt}     |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- Validate: ------|              |            |
  |                        |                      |                |   1. Code exists? |              |            |
  |                        |                      |                |   2. Not expired? |              |            |
  |                        |                      |                |   3. usedCount    |              |            |
  |                        |                      |                |      < maxUses?   |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |<-- {valid:true,|                   |              |            |
  |                        |                      |     discount:  |                   |              |            |
  |                        |                      |     20,        |                   |              |            |
  |                        |                      |     type: "%"} |                   |              |            |
  |                        |<-- Update summary ---|                |                   |              |            |
  |                        |   (show discount)    |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |-- Click "Pay Now" ---->|                      |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |                        |-- POST /events ----->|                |                   |              |            |
  |                        |   {all event data,   |                |                   |              |            |
  |                        |    tier: "free",     |                |                   |              |            |
  |                        |    paymentStatus:    |                |                   |              |            |
  |                        |    "pending"}        |                |                   |              |            |
  |                        |                      |-- createEvent->|                   |              |            |
  |                        |                      |                |-- PutItem ------->|              |            |
  |                        |                      |                |   (event as free, |              |            |
  |                        |                      |                |    paymentStatus:  |              |            |
  |                        |                      |                |    "pending",     |              |            |
  |                        |                      |                |    requestedTier:  |              |            |
  |                        |                      |                |    "paid")        |              |            |
  |                        |                      |<-- {eventId} --|                   |              |            |
  |                        |<-- eventId -----------|                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |                        |-- POST /checkout ---->|                |                   |              |            |
  |                        |   {eventId,           |                |                   |              |            |
  |                        |    plan: "paid",     |                |                   |              |            |
  |                        |    promoCode:        |                |                   |              |            |
  |                        |    "LAUNCH20"}       |                |                   |              |            |
  |                        |                      |-- createCheckout>                  |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- Calculate price:|              |            |
  |                        |                      |                |   $9.00 - 20% =   |              |            |
  |                        |                      |                |   $7.20 = 720 cents              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- POST /api/ -----|------------->|            |
  |                        |                      |                |   checkouts/      | [Recurrente  |            |
  |                        |                      |                |   X-PUBLIC-KEY    |  API]        |            |
  |                        |                      |                |   X-SECRET-KEY    |              |            |
  |                        |                      |                |   {items: [{      |              |            |
  |                        |                      |                |     name: "Paid   |              |            |
  |                        |                      |                |      Plan",       |              |            |
  |                        |                      |                |     amount: 720,  |              |            |
  |                        |                      |                |     currency:"USD"|              |            |
  |                        |                      |                |   }],             |              |            |
  |                        |                      |                |   success_url,    |              |            |
  |                        |                      |                |   cancel_url,     |              |            |
  |                        |                      |                |   metadata: {     |              |            |
  |                        |                      |                |     eventId}}     |              |            |
  |                        |                      |                |<-- {checkoutId, --|----          |            |
  |                        |                      |                |     checkoutUrl}  |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- UpdateItem ---->|              |            |
  |                        |                      |                |   PK=EVT#{eventId}|              |            |
  |                        |                      |                |   SET checkoutId  |              |            |
  |                        |                      |                |<-- Updated -------|              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |<-- {checkoutUrl}                   |              |            |
  |                        |<-- Redirect URL ------|                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |<-- Redirect to --------|                      |                |                   |              |            |
  |    Recurrente hosted   |                      |                |                   |              |            |
  |    checkout page       |                      |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |  [Host completes payment on Recurrente page]  |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |  [WEBHOOK — may arrive before or after redirect back]         |                   |              |            |
  |                        |                      |                |                   |              |            |
  |                        |     Recurrente ------>|                |                   |              |            |
  |                        |     POST /webhooks/  |                |                   |              |            |
  |                        |     payment          |                |                   |              |            |
  |                        |     {event:          |                |                   |              |            |
  |                        |      "payment_intent.|                |                   |              |            |
  |                        |       succeeded",    |                |                   |              |            |
  |                        |      checkoutId,     |                |                   |              |            |
  |                        |      metadata: {     |                |                   |              |            |
  |                        |        eventId}}     |                |                   |              |            |
  |                        |                      |-- handleWebhook>                  |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- GetItem ------->|              |            |
  |                        |                      |                |   PK=EVT#{eventId}|              |            |
  |                        |                      |                |<-- Event record --|              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- Check: ---------|              |            |
  |                        |                      |                |   paymentStatus   |              |            |
  |                        |                      |                |   != "paid"       |              |            |
  |                        |                      |                |   (idempotency)   |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- Verify with ----|------------->|            |
  |                        |                      |                |   Recurrente API  | GET /api/    |            |
  |                        |                      |                |   (confirm paid)  | checkouts/   |            |
  |                        |                      |                |                   | {id}         |            |
  |                        |                      |                |<-- Confirmed -----|----          |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- UpdateItem ---->|              |            |
  |                        |                      |                |   SET tier =      |              |            |
  |                        |                      |                |     requestedTier |              |            |
  |                        |                      |                |   SET paymentStatus              |            |
  |                        |                      |                |     = "paid"      |              |            |
  |                        |                      |                |   SET uploadLimit |              |            |
  |                        |                      |                |     = 500 (paid)  |              |            |
  |                        |                      |                |   SET TTL =       |              |            |
  |                        |                      |                |     +60 days      |              |            |
  |                        |                      |                |<-- Updated -------|              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- Increment promo |              |            |
  |                        |                      |                |   usedCount ----->|              |            |
  |                        |                      |                |   (if promo used) |              |            |
  |                        |                      |                |                   |              |            |
  |                        |                      |                |-- SES SendEmail ->|              |----------->|
  |                        |                      |                |   Template:       |              |  [Purchase |
  |                        |                      |                |   "Purchase       |              |   Receipt] |
  |                        |                      |                |    Receipt"       |              |            |
  |                        |                      |                |   {plan, price,   |              |            |
  |                        |                      |                |    discount, total}              |            |
  |                        |                      |<-- 200 OK ----|                   |              |            |
  |                        |                      |                |                   |              |            |
  |  [Host redirected back to success_url]        |                |                   |              |            |
  |                        |                      |                |                   |              |            |
  |<-- Return to app ------|                      |                |                   |              |            |
  |                        |-- Poll GET /events ->|                |                   |              |            |
  |                        |   /{eventId}         |                |                   |              |            |
  |                        |                      |-- getEvent --->|                   |              |            |
  |                        |                      |                |-- GetItem ------->|              |            |
  |                        |                      |                |<-- Event data ----|              |            |
  |                        |                      |                |   (tier: "paid",  |              |            |
  |                        |                      |                |    paymentStatus:  |              |            |
  |                        |                      |                |    "paid")        |              |            |
  |                        |                      |<-- Upgraded! --|                   |              |            |
  |                        |<-- Show success ------|                |                   |              |            |
  |<-- "Payment confirmed! |                      |                |                   |              |            |
  |     Your event is now  |                      |                |                   |              |            |
  |     on the Paid plan." |                      |                |                   |              |            |
```

---

## 5. Host Flow — Admin Login (Email OTP)

```
Host                     Browser              API Gateway        Lambda             DynamoDB         SES
  |                        |                      |                |                   |               |
  |  [Screen 14: Admin Login]                     |                |                   |               |
  |                        |                      |                |                   |               |
  |-- Enter email -------->|                      |                |                   |               |
  |   (brandon@example.com)|                      |                |                   |               |
  |                        |-- POST /auth/ ------>|                |                   |               |
  |                        |   host/login         |                |                   |               |
  |                        |   {email:            |                |                   |               |
  |                        |    "brandon@         |                |                   |               |
  |                        |     example.com"}    |                |                   |               |
  |                        |                      |-- hostLogin -->|                   |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Query GSI1 ---->|               |
  |                        |                      |                |   GSI1PK=HOST#    |               |
  |                        |                      |                |   brandon@        |               |
  |                        |                      |                |   example.com     |               |
  |                        |                      |                |<-- Results -------|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If email found |               |
  |                        |                      |                |    (1+ events):]  |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Generate OTP ---|               |
  |                        |                      |                |   (6-digit,       |               |
  |                        |                      |                |    crypto random) |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- PutItem ------->|               |
  |                        |                      |                |   PK=HOST_OTP#    |               |
  |                        |                      |                |     {email}       |               |
  |                        |                      |                |   SK=CODE         |               |
  |                        |                      |                |   {code (hashed), |               |
  |                        |                      |                |    attempts: 0,   |               |
  |                        |                      |                |    TTL:           |               |
  |                        |                      |                |    now + 10 min}  |               |
  |                        |                      |                |<-- Stored --------|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- SES SendEmail ->|-------------->|
  |                        |                      |                |   To: brandon@    |  [OTP Login   |
  |                        |                      |                |   example.com     |   Code email] |
  |                        |                      |                |   Template: "OTP  |               |
  |                        |                      |                |   Login Code"     |               |
  |                        |                      |                |   {code: 384921}  |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If email NOT   |               |
  |                        |                      |                |    found:]        |               |
  |                        |                      |                |-- Log warning ----|               |
  |                        |                      |                |   (no email sent, |               |
  |                        |                      |                |    anti-enum)     |               |
  |                        |                      |                |                   |               |
  |                        |                      |<-- Response ---|                   |               |
  |                        |                      |   200 OK       |                   |               |
  |                        |                      |   (ALWAYS same |                   |               |
  |                        |                      |    response)   |                   |               |
  |                        |<-- "If an account ---|                |                   |               |
  |                        |    exists, we sent   |                |                   |               |
  |                        |    a code"           |                |                   |               |
  |                        |                      |                |                   |               |
  |<-- Navigate to OTP ----|                      |                |                   |               |
  |    screen (Screen 15)  |                      |                |                   |               |
  |                        |                      |                |                   |               |
  |  [Host receives email with 6-digit code]      |                |                   |               |
  |                        |                      |                |                   |               |
  |-- Enter OTP code ----->|                      |                |                   |               |
  |   (384921, 6 boxes)    |                      |                |                   |               |
  |                        |-- POST /auth/ ------>|                |                   |               |
  |                        |   host/verify        |                |                   |               |
  |                        |   {email: "brandon@  |                |                   |               |
  |                        |    example.com",     |                |                   |               |
  |                        |    code: "384921"}   |                |                   |               |
  |                        |                      |-- hostVerify ->|                   |               |
  |                        |                      |                |-- GetItem ------->|               |
  |                        |                      |                |   PK=HOST_OTP#    |               |
  |                        |                      |                |     {email}       |               |
  |                        |                      |                |   SK=CODE         |               |
  |                        |                      |                |<-- OTP record ----|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Check: ---------|               |
  |                        |                      |                |   1. Record exists |               |
  |                        |                      |                |      (not expired  |               |
  |                        |                      |                |       by TTL)     |               |
  |                        |                      |                |   2. attempts < 5 |               |
  |                        |                      |                |   3. timingSafe   |               |
  |                        |                      |                |      Equal(       |               |
  |                        |                      |                |      hash(input), |               |
  |                        |                      |                |      stored hash) |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If all pass:]  |               |
  |                        |                      |                |-- DeleteItem ---->|               |
  |                        |                      |                |   (remove OTP     |               |
  |                        |                      |                |    record)        |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Query GSI1 ---->|               |
  |                        |                      |                |   (get all host's |               |
  |                        |                      |                |    events)        |               |
  |                        |                      |                |<-- Event list ----|               |
  |                        |                      |                |                   |               |
  |                        |                      |                |-- Sign JWT -------|               |
  |                        |                      |                |   {email,         |               |
  |                        |                      |                |    role: "host",   |               |
  |                        |                      |                |    eventIds: [...],|               |
  |                        |                      |                |    exp: 7 days}    |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If code wrong:]|               |
  |                        |                      |                |-- UpdateItem ---->|               |
  |                        |                      |                |   attempts += 1   |               |
  |                        |                      |                |-- Return 401 -----|               |
  |                        |                      |                |   INVALID_OTP     |               |
  |                        |                      |                |   remaining: 4-N  |               |
  |                        |                      |                |                   |               |
  |                        |                      |                |   [If 5th attempt:]               |
  |                        |                      |                |-- DeleteItem ---->|               |
  |                        |                      |                |   (burn OTP)      |               |
  |                        |                      |                |-- Return 429 -----|               |
  |                        |                      |                |   TOO_MANY_       |               |
  |                        |                      |                |   ATTEMPTS        |               |
  |                        |                      |                |                   |               |
  |                        |                      |<-- Response ---|                   |               |
  |                        |<-- JWT (role=host) --|                |                   |               |
  |                        |   (stored in         |                |                   |               |
  |                        |    localStorage)     |                |                   |               |
  |                        |                      |                |                   |               |
  |<-- Redirect to --------|                      |                |                   |               |
  |    Admin Dashboard     |                      |                |                   |               |
  |    (Screen 7)          |                      |                |                   |               |
```

---

## 6. Payment Flow (Recurrente) — Detailed

```
Browser                  API Gateway        Lambda             DynamoDB         Recurrente API      SES
  |                          |                |                   |                  |                |
  |  [Triggered by "Pay Now" in purchase flow, after event created]                  |                |
  |                          |                |                   |                  |                |
  |-- POST /checkout ------->|                |                   |                  |                |
  |   {eventId,              |                |                   |                  |                |
  |    plan: "premium",      |                |                   |                  |                |
  |    promoCode: "LAUNCH20",|                |                   |                  |                |
  |    currency: "USD"}      |                |                   |                  |                |
  |                          |-- createCheckout>                  |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- GetItem ------->|                  |                |
  |                          |                |   PK=EVT#{eventId}|                  |                |
  |                          |                |<-- Event data ----|                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- Price calc: ----|                  |                |
  |                          |                |   Premium = $25.00|                  |                |
  |                          |                |   = 2500 cents    |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |   [If promoCode:] |                  |                |
  |                          |                |-- Read promo ---->|                  |                |
  |                          |                |   config          |                  |                |
  |                          |                |<-- {discount:20%} |                  |                |
  |                          |                |   2500 * 0.8      |                  |                |
  |                          |                |   = 2000 cents    |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- POST ----------|----------------->|                |
  |                          |                |   /api/checkouts/ |                  |                |
  |                          |                |   Headers:        |                  |                |
  |                          |                |   X-PUBLIC-KEY    |                  |                |
  |                          |                |   X-SECRET-KEY    |                  |                |
  |                          |                |   Body:           |                  |                |
  |                          |                |   {items: [{      |                  |                |
  |                          |                |     name:          |                  |                |
  |                          |                |     "EventAlbum   |                  |                |
  |                          |                |      Premium",    |                  |                |
  |                          |                |     amount: 2000, |                  |                |
  |                          |                |     currency:     |                  |                |
  |                          |                |     "USD",        |                  |                |
  |                          |                |     quantity: 1   |                  |                |
  |                          |                |   }],             |                  |                |
  |                          |                |   success_url:    |                  |                |
  |                          |                |   "https://app.   |                  |                |
  |                          |                |    eventalbum.io/ |                  |                |
  |                          |                |    payment/       |                  |                |
  |                          |                |    success?       |                  |                |
  |                          |                |    eventId={id}", |                  |                |
  |                          |                |   cancel_url:     |                  |                |
  |                          |                |   "https://app.   |                  |                |
  |                          |                |    eventalbum.io/ |                  |                |
  |                          |                |    payment/       |                  |                |
  |                          |                |    cancel?        |                  |                |
  |                          |                |    eventId={id}", |                  |                |
  |                          |                |   metadata: {     |                  |                |
  |                          |                |     eventId,      |                  |                |
  |                          |                |     plan,         |                  |                |
  |                          |                |     promoCode}    |                  |                |
  |                          |                |   }               |                  |                |
  |                          |                |<-- {id,           |----              |                |
  |                          |                |     checkout_url}  |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- UpdateItem ---->|                  |                |
  |                          |                |   SET checkoutId  |                  |                |
  |                          |                |   SET promoCode   |                  |                |
  |                          |                |   SET amountCents |                  |                |
  |                          |                |<-- Updated -------|                  |                |
  |                          |                |                   |                  |                |
  |                          |<-- {checkoutUrl}                   |                  |                |
  |<-- Redirect to ----------|                |                   |                  |                |
  |    checkout_url          |                |                   |                  |                |
  |                          |                |                   |                  |                |
  |  [User fills card info on Recurrente page: 4242424242424242]  |                  |                |
  |  [Recurrente processes payment]           |                   |                  |                |
  |                          |                |                   |                  |                |
  |                          |  [WEBHOOK fires]                  |                  |                |
  |                          |                |                   |                  |                |
  |              Recurrente POST /webhooks/ -->|                   |                  |                |
  |              payment                      |                   |                  |                |
  |              {event: "payment_intent.     |                   |                  |                |
  |               succeeded",                 |                   |                  |                |
  |               data: {checkoutId,          |                   |                  |                |
  |                metadata: {eventId,        |                   |                  |                |
  |                 plan, promoCode}}}         |                   |                  |                |
  |                          |-- handleWebhook>                   |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- GetItem ------->|                  |                |
  |                          |                |   PK=EVT#{eventId}|                  |                |
  |                          |                |<-- Event data ----|                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- Idempotency: ---|                  |                |
  |                          |                |   paymentStatus   |                  |                |
  |                          |                |   == "paid"?      |                  |                |
  |                          |                |   → return 200 OK |                  |                |
  |                          |                |     (do nothing)  |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- Verify payment -|----------------->|                |
  |                          |                |   GET /api/       |                  |                |
  |                          |                |   checkouts/{id}  |                  |                |
  |                          |                |<-- {status:       |----              |                |
  |                          |                |     "succeeded"}  |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- UpdateItem ---->|                  |                |
  |                          |                |   PK=EVT#{eventId}|                  |                |
  |                          |                |   SET tier =      |                  |                |
  |                          |                |     "premium"     |                  |                |
  |                          |                |   SET paymentStatus                  |                |
  |                          |                |     = "paid"      |                  |                |
  |                          |                |   SET uploadLimit |                  |                |
  |                          |                |     = 1000        |                  |                |
  |                          |                |   SET TTL =       |                  |                |
  |                          |                |     now + 2 years |                  |                |
  |                          |                |   SET paidAt      |                  |                |
  |                          |                |<-- Updated -------|                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- Increment promo |                  |                |
  |                          |                |   usedCount ----->|                  |                |
  |                          |                |   ConditionExpr:  |                  |                |
  |                          |                |   usedCount <     |                  |                |
  |                          |                |   maxUses         |                  |                |
  |                          |                |                   |                  |                |
  |                          |                |-- SES SendEmail ->|                  |--------------->|
  |                          |                |   "Purchase       |                  |  [Receipt     |
  |                          |                |    Receipt"       |                  |   email]      |
  |                          |                |   {plan, price,   |                  |                |
  |                          |                |    discount,      |                  |                |
  |                          |                |    total, method} |                  |                |
  |                          |                |                   |                  |                |
  |                          |<-- 200 OK -----|                   |                  |                |
```

---

## 7. Upload Processing Pipeline — Complete

```
S3 Event              Lambda (processUpload)     DynamoDB              S3                  Rekognition       SES
  |                        |                        |                    |                      |             |
  |-- ObjectCreated ------>|                        |                    |                      |             |
  |   key: events/         |                        |                    |                      |             |
  |   {eventId}/uploads/   |                        |                    |                      |             |
  |   {uuid}.jpg           |                        |                    |                      |             |
  |   size: 824KB          |                        |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- GetItem ------------->|                    |                      |             |
  |                        |   PK=EVT#{eventId}     |                    |                      |             |
  |                        |   SK=META              |                    |                      |             |
  |                        |<-- Event data ----------|                    |                      |             |
  |                        |   {tier, uploadLimit,  |                    |                      |             |
  |                        |    uploadCount,        |                    |                      |             |
  |                        |    autoApprove,        |                    |                      |             |
  |                        |    hostEmail,          |                    |                      |             |
  |                        |    notifyOnUpload}     |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- GetObject ------------|------------------>|                      |             |
  |                        |<-- Image bytes ---------|----               |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- Validate: ------------|                    |                      |             |
  |                        |   1. Magic bytes       |                    |                      |             |
  |                        |   2. File size <= 10MB |                    |                      |             |
  |                        |   3. Image dimensions  |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |   [If INVALID:]        |                    |                      |             |
  |                        |-- DeleteObject ---------|------------------>|                      |             |
  |                        |-- Return (no DB write) |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |   [If VALID:]          |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- Generate thumbnail --|                    |                      |             |
  |                        |   (sharp: 400px wide,  |                    |                      |             |
  |                        |    quality 0.7, WebP)  |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- PutObject ------------|------------------>|                      |             |
  |                        |   events/{eventId}/    |   [thumbs/        |                      |             |
  |                        |   thumbs/{uuid}.webp   |    {uuid}.webp]   |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- Extract EXIF ---------|                    |                      |             |
  |                        |   {dateTaken, camera,  |                    |                      |             |
  |                        |    gps (stripped)}     |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |   [If tier == "premium" AND autoApprove == false:]                 |             |
  |                        |                        |                    |                      |             |
  |                        |-- DetectModerationLabels ------------------>|--------------------->|             |
  |                        |   {Image: {S3Object:   |                    | [Rekognition API]    |             |
  |                        |     Bucket, Key}}      |                    |                      |             |
  |                        |<-- {ModerationLabels:  |                    |----                  |             |
  |                        |     [{Name:            |                    |                      |             |
  |                        |       "Suggestive",    |                    |                      |             |
  |                        |       Confidence: 87.3}|                    |                      |             |
  |                        |     ]}                 |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- Determine status: ---|                    |                      |             |
  |                        |   If any label         |                    |                      |             |
  |                        |   confidence > 70%:    |                    |                      |             |
  |                        |     status = "flagged" |                    |                      |             |
  |                        |   Else:                |                    |                      |             |
  |                        |     status = "visible" |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |   [If tier != "premium" OR autoApprove == true:]                   |             |
  |                        |   status = "visible"   |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- UpdateItem ---------> |                    |                      |             |
  |                        |   PK=EVT#{eventId}     |                    |                      |             |
  |                        |   SK=META              |                    |                      |             |
  |                        |   SET uploadCount += 1 |                    |                      |             |
  |                        |   SET totalStorage     |                    |                      |             |
  |                        |     += fileSize        |                    |                      |             |
  |                        |   Condition:           |                    |                      |             |
  |                        |     uploadCount <      |                    |                      |             |
  |                        |     uploadLimit        |                    |                      |             |
  |                        |<-- Success ------------|                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- PutItem ------------->|                    |                      |             |
  |                        |   PK=EVT#{eventId}     |                    |                      |             |
  |                        |   SK=MEDIA#{uuid}      |                    |                      |             |
  |                        |   {mediaId, s3Key,     |                    |                      |             |
  |                        |    thumbKey, uploadedBy,|                    |                      |             |
  |                        |    fileSize, contentType,                    |                      |             |
  |                        |    status, createdAt,  |                    |                      |             |
  |                        |    exifData,           |                    |                      |             |
  |                        |    moderationLabels}   |                    |                      |             |
  |                        |<-- Success ------------|                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |   [If status == "flagged":]                 |                      |             |
  |                        |-- SES SendEmail --------|----               |                      |------------>|
  |                        |   To: hostEmail        |                    |                      |  [Moderation|
  |                        |   Template:            |                    |                      |   Alert     |
  |                        |   "Moderation Alert"   |                    |                      |   email]    |
  |                        |   {thumbnail (blurred),|                    |                      |             |
  |                        |    label, confidence,  |                    |                      |             |
  |                        |    moderationUrl}      |                    |                      |             |
  |                        |                        |                    |                      |             |
  |                        |-- PutItem ------------->|                    |                      |             |
  |                        |   PK=EVT#{eventId}     |                    |                      |             |
  |                        |   SK=ACTIVITY#{ts}     |                    |                      |             |
  |                        |   {type: "upload",     |                    |                      |             |
  |                        |    guestId, mediaId,   |                    |                      |             |
  |                        |    createdAt}          |                    |                      |             |
```

---

## 8. Content Moderation Flow — Host Review

```
Host                     Browser              API Gateway        Lambda             DynamoDB              S3
  |                        |                      |                |                   |                    |
  |  [Host receives "Moderation Alert" email]     |                |                   |                    |
  |                        |                      |                |                   |                    |
  |-- Click "Review Now" ->|                      |                |                   |                    |
  |                        |-- Navigate to --------|                |                   |                    |
  |                        |   /admin/moderation  |                |                   |                    |
  |                        |                      |                |                   |                    |
  |                        |-- GET /media -------->|                |                   |                    |
  |                        |   ?eventId={id}      |                |                   |                    |
  |                        |   &status=flagged    |                |                   |                    |
  |                        |   Authorization: JWT |                |                   |                    |
  |                        |   (role=host)        |                |                   |                    |
  |                        |                      |-- listMedia -->|                   |                    |
  |                        |                      |                |-- Query --------->|                    |
  |                        |                      |                |   PK=EVT#{eventId}|                    |
  |                        |                      |                |   SK begins MEDIA#|                    |
  |                        |                      |                |   filter:         |                    |
  |                        |                      |                |   status=flagged  |                    |
  |                        |                      |                |<-- Flagged items -|                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Sign CF URLs -->|                    |
  |                        |                      |<-- Media list -|                   |                    |
  |                        |<-- Render Pending tab |                |                   |                    |
  |                        |   (cards with blurred |                |                   |                    |
  |                        |    thumbnails,        |                |                   |                    |
  |                        |    moderation labels, |                |                   |                    |
  |                        |    approve/reject)    |                |                   |                    |
  |                        |                      |                |                   |                    |
  |  [OPTION A: Host clicks "Approve"]            |                |                   |                    |
  |                        |                      |                |                   |                    |
  |-- Click "Approve" ---->|                      |                |                   |                    |
  |                        |-- PATCH /media/ ----->|                |                   |                    |
  |                        |   {mediaId}           |                |                   |                    |
  |                        |   {status: "visible"} |                |                   |                    |
  |                        |                      |-- updateMedia->|                   |                    |
  |                        |                      |                |-- UpdateItem ---->|                    |
  |                        |                      |                |   PK=EVT#{eventId}|                    |
  |                        |                      |                |   SK=MEDIA#{id}   |                    |
  |                        |                      |                |   SET status =    |                    |
  |                        |                      |                |     "visible"     |                    |
  |                        |                      |                |   SET reviewedBy  |                    |
  |                        |                      |                |     = hostEmail   |                    |
  |                        |                      |                |   SET reviewedAt  |                    |
  |                        |                      |                |   (keep moderation|                    |
  |                        |                      |                |    Labels for     |                    |
  |                        |                      |                |    audit trail)   |                    |
  |                        |                      |                |<-- Updated -------|                    |
  |                        |                      |<-- 200 OK ----|                   |                    |
  |                        |<-- Card animates out -|                |                   |                    |
  |                        |   moves to Approved  |                |                   |                    |
  |                        |                      |                |                   |                    |
  |  [OPTION B: Host clicks "Reject"]             |                |                   |                    |
  |                        |                      |                |                   |                    |
  |-- Click "Reject" ----->|                      |                |                   |                    |
  |                        |-- PATCH /media/ ----->|                |                   |                    |
  |                        |   {mediaId}           |                |                   |                    |
  |                        |   {status: "rejected"}|                |                   |                    |
  |                        |                      |-- updateMedia->|                   |                    |
  |                        |                      |                |-- UpdateItem ---->|                    |
  |                        |                      |                |   SET status =    |                    |
  |                        |                      |                |     "rejected"    |                    |
  |                        |                      |                |   SET reviewedBy, |                    |
  |                        |                      |                |     reviewedAt    |                    |
  |                        |                      |                |<-- Updated -------|                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |  [Optional:       |                    |
  |                        |                      |                |   delete S3 obj?  |                    |
  |                        |                      |                |   No — keep for   |                    |
  |                        |                      |                |   audit. Delete   |                    |
  |                        |                      |                |   with event TTL] |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |<-- 200 OK ----|                   |                    |
  |                        |<-- Card animates out -|                |                   |                    |
```

---

## 9. QR Code Scan Tracking

```
Guest                    Browser              API Gateway        Lambda             DynamoDB
  |                        |                      |                |                   |
  |-- Scan QR / open URL ->|                      |                |                   |
  |                        |-- GET /e/{eventId} ->|                |                   |
  |                        |                      |-- getEvent --->|                   |
  |                        |                      |                |                   |
  |                        |                      |                |-- Extract client -|
  |                        |                      |                |   IP from headers |
  |                        |                      |                |   (X-Forwarded-For|
  |                        |                      |                |    or sourceIp)   |
  |                        |                      |                |                   |
  |                        |                      |                |-- SHA-256 hash -->|
  |                        |                      |                |   (IP address)    |
  |                        |                      |                |   for privacy     |
  |                        |                      |                |                   |
  |                        |                      |                |-- UpdateItem ---->|
  |                        |                      |                |   PK=EVT#{eventId}|
  |                        |                      |                |   SK=META         |
  |                        |                      |                |                   |
  |                        |                      |                |   SET totalScans  |
  |                        |                      |                |     = totalScans  |
  |                        |                      |                |       + 1         |
  |                        |                      |                |   SET lastScannedAt|
  |                        |                      |                |     = :now        |
  |                        |                      |                |                   |
  |                        |                      |                |   ADD scanIpHashes|
  |                        |                      |                |     :ipHash       |
  |                        |                      |                |   (String Set —   |
  |                        |                      |                |    ADD is          |
  |                        |                      |                |    idempotent,    |
  |                        |                      |                |    duplicates     |
  |                        |                      |                |    ignored)       |
  |                        |                      |                |                   |
  |                        |                      |                |<-- Updated -------|
  |                        |                      |                |                   |
  |                        |                      |                |   uniqueVisitors  |
  |                        |                      |                |   = size(         |
  |                        |                      |                |     scanIpHashes) |
  |                        |                      |                |   (computed on    |
  |                        |                      |                |    read, not      |
  |                        |                      |                |    stored)        |
  |                        |                      |                |                   |
  |                        |                      |                |-- GetItem ------->|
  |                        |                      |                |   (full event     |
  |                        |                      |                |    data for       |
  |                        |                      |                |    rendering)     |
  |                        |                      |                |<-- Event data ----|
  |                        |                      |                |                   |
  |                        |                      |<-- Event data -|                   |
  |                        |<-- Render entry page-|                |                   |
```

---

## 10. Promo Code Validation

```
Browser                  API Gateway        Lambda             SSM Parameter Store    DynamoDB
  |                          |                |                       |                    |
  |-- POST /promo/validate ->|                |                       |                    |
  |   {code: "LAUNCH20"}    |                |                       |                    |
  |                          |-- validatePromo>                      |                    |
  |                          |                |                       |                    |
  |                          |                |-- GetParameter ------>|                    |
  |                          |                |   /eventalbum/promo/ |                    |
  |                          |                |   LAUNCH20           |                    |
  |                          |                |<-- {discount: 20,    |                    |
  |                          |                |     type: "percent",  |                    |
  |                          |                |     maxUses: 100,    |                    |
  |                          |                |     expiresAt:       |                    |
  |                          |                |     "2026-06-30"}    |                    |
  |                          |                |                       |                    |
  |                          |                |   [If param not found:]                   |
  |                          |                |-- Return 404 ---------|                    |
  |                          |                |   PROMO_NOT_FOUND     |                    |
  |                          |                |                       |                    |
  |                          |                |-- Check expiresAt: --|                    |
  |                          |                |   now > expiresAt?   |                    |
  |                          |                |   → Return 410       |                    |
  |                          |                |     PROMO_EXPIRED    |                    |
  |                          |                |                       |                    |
  |                          |                |-- GetItem ------------|------------------>|
  |                          |                |   PK=PROMO#LAUNCH20  |                    |
  |                          |                |   SK=COUNTER          |                    |
  |                          |                |<-- {usedCount: 42} --|----                |
  |                          |                |                       |                    |
  |                          |                |-- Check: usedCount --|                    |
  |                          |                |   < maxUses (100)?   |                    |
  |                          |                |   42 < 100 → valid   |                    |
  |                          |                |                       |                    |
  |                          |                |   [If maxed out:]    |                    |
  |                          |                |-- Return 410 ---------|                    |
  |                          |                |   PROMO_MAXED_OUT    |                    |
  |                          |                |                       |                    |
  |                          |                |   [If all valid:]    |                    |
  |                          |<-- {valid: true,|                      |                    |
  |                          |     discount: 20,                      |                    |
  |                          |     type: "percent",                   |                    |
  |                          |     message:     |                      |                    |
  |                          |     "20% off!"}  |                      |                    |
  |<-- Update order summary -|                |                       |                    |
  |   (show discount)       |                |                       |                    |
  |                          |                |                       |                    |
  |  [Promo usedCount is incremented ONLY during webhook handler,    |                    |
  |   NOT during validation. This prevents incrementing for          |                    |
  |   abandoned checkouts.]  |                |                       |                    |
```

---

## 11. ZIP Download Flow

```
Host                     Browser              API Gateway        Lambda             DynamoDB              S3
  |                        |                      |                |                   |                    |
  |-- Click "Download All" |                      |                |                   |                    |
  |    (Dashboard or       |                      |                |                   |                    |
  |     Email Summary)     |                      |                |                   |                    |
  |                        |-- POST /events/ ---->|                |                   |                    |
  |                        |   {eventId}/download |                |                   |                    |
  |                        |   Authorization: JWT |                |                   |                    |
  |                        |   (role=host)        |                |                   |                    |
  |                        |                      |-- createZip -->|                   |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Verify JWT -----|                    |
  |                        |                      |                |   (must be host)  |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Check tier ---->|                    |
  |                        |                      |                |   (ZIP download   |                    |
  |                        |                      |                |    is Paid/Premium|                    |
  |                        |                      |                |    only)          |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |   [If free tier:] |                    |
  |                        |                      |                |-- Return 403 -----|                    |
  |                        |                      |                |   TIER_REQUIRED   |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Query all ------>|                    |
  |                        |                      |                |   media items     |                    |
  |                        |                      |                |   PK=EVT#{eventId}|                    |
  |                        |                      |                |   SK begins MEDIA#|                    |
  |                        |                      |                |   status=visible  |                    |
  |                        |                      |                |<-- All media -----|                    |
  |                        |                      |                |   [{s3Key}, ...]  |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Stream from S3 -|------------------>|
  |                        |                      |                |   GetObject for   |  [Read each      |
  |                        |                      |                |   each s3Key      |   original file] |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Create ZIP -----|                    |
  |                        |                      |                |   (archiver lib,  |                    |
  |                        |                      |                |    streaming to   |                    |
  |                        |                      |                |    S3 multipart   |                    |
  |                        |                      |                |    upload)        |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- PutObject ------|------------------>|
  |                        |                      |                |   key: events/    |  [exports/       |
  |                        |                      |                |   {eventId}/      |   {eventId}/     |
  |                        |                      |                |   exports/        |   {title}_       |
  |                        |                      |                |   {title}_{date}  |   {date}.zip]    |
  |                        |                      |                |   .zip            |                    |
  |                        |                      |                |   Tagging:        |                    |
  |                        |                      |                |   auto-delete=    |                    |
  |                        |                      |                |   7days           |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |                |-- Generate -------|                    |
  |                        |                      |                |   presigned GET   |                    |
  |                        |                      |                |   URL for ZIP     |                    |
  |                        |                      |                |   (exp: 7 days)   |                    |
  |                        |                      |                |                   |                    |
  |                        |                      |<-- {downloadUrl,                   |                    |
  |                        |                      |     fileSize,   |                   |                    |
  |                        |                      |     photoCount} |                   |                    |
  |                        |<-- Download link -----|                |                   |                    |
  |                        |                      |                |                   |                    |
  |<-- Browser starts ------|                      |                |                   |                    |
  |    downloading ZIP      |                      |                |                   |                    |
  |                        |                      |                |                   |                    |
  |  [S3 Lifecycle Rule: delete objects in exports/ after 7 days]  |                   |                    |
```

---

## 12. Event Lifecycle — State Machine

```
                    ┌─────────────────────────────────────────────────────────────────────────────────┐
                    |                         EVENT LIFECYCLE                                          |
                    └─────────────────────────────────────────────────────────────────────────────────┘

  POST /events                                                                    DynamoDB TTL fires
  (host creates)                                                                  (auto-delete)
       |                                                                               |
       v                                                                               v
  ┌──────────┐      startDate          ┌──────────┐      endDate         ┌──────────┐         ┌───────────┐
  | CREATED  | -------- reached -----> |  ACTIVE  | ------ reached ----> |  ENDED   | ------> |  DELETED  |
  | (pending)|    (EventBridge cron    |          |   (EventBridge cron  | (read-   |  TTL    | (DynamoDB |
  |          |     checks daily)       |          |    checks daily)     |  only)   | fires   |  removes) |
  └──────────┘                         └──────────┘                      └──────────┘         └───────────┘
       |                                    |                                 |                      |
       |  Upload: BLOCKED                   |  Upload: ALLOWED               |  Upload: BLOCKED     |  All data
       |  Gallery: visible                  |  Gallery: visible              |  Gallery: visible     |  gone
       |  (shows countdown)                 |  QR scan tracking              |  (read-only)          |
       |                                    |  Reactions: ALLOWED            |  Reactions: BLOCKED   |
       |                                    |  Comments: ALLOWED             |  Comments: BLOCKED    |
       |                                    |                                |                       |
       |                                    |                                |                       |
       |                      ┌──────────────────────┐                       |                       |
       |                      | Host clicks "Delete" |                       |                       |
       |                      └──────────────────────┘                       |                       |
       |                                    |                                |                       |
       |                                    v                                |                       |
       |                            ┌───────────────┐    24h grace    ┌───────────┐                  |
       |                            | SOFT-DELETED  | -------------> | HARD-     |                  |
       |                            | (status=      |  (TTL=now+24h) | DELETED   |                  |
       |                            |  deleted)     |                | (same as  |                  |
       |                            |               |                |  DELETED) |                  |
       |                            | Host can      |                └───────────┘                  |
       |                            | "Undo" within |                      |                       |
       |                            | 24 hours      |                      |-- S3 cleanup:         |
       |                            └───────────────┘                      |   Delete all objects  |
       |                                                                   |   in events/{eventId}/|
       |                                                                   |                       |
       |                                                                                            |
       +-- RETENTION PERIODS BY TIER: ------------------------------------------------------------------+
       |  Free:    15 days after creation (TTL = createdAt + 15d)                                   |
       |  Paid:    60 days after event end date (TTL = endDate + 60d)                               |
       |  Premium: 365 days active + 365 days Glacier archive (TTL = endDate + 730d)                |
       |                                                                                            |
       |  Premium Glacier Flow:                                                                     |
       |  ┌──────────┐   365 days    ┌──────────────┐   365 days    ┌──────────┐                   |
       |  |  ENDED   | -----------> | ARCHIVED     | -----------> | DELETED  |                    |
       |  | (S3 std) |  S3 lifecycle | (S3 Glacier  |  S3 lifecycle |          |                    |
       |  |          |  transition   |  Deep Archive)|  expiration  |          |                    |
       |  └──────────┘              └──────────────┘              └──────────┘                    |
       |                             |                                                             |
       |                             | Host can request retrieval                                   |
       |                             | (12-48h restore time)                                       |
       +--------------------------------------------------------------------------------------------+


  EventBridge Scheduled Rules:
  ┌─────────────────────────────────────────────────────────────────┐
  | Rule: check-event-status (daily at 00:00 UTC)                   |
  |   → Lambda: updateEventStatuses                                 |
  |   → Query events where:                                         |
  |     - status=created AND startDate <= now → SET status=active   |
  |     - status=active AND endDate <= now → SET status=ended       |
  |                                                                 |
  | Rule: premium-archive-warning (daily at 00:00 UTC)              |
  |   → Lambda: sendArchiveWarnings                                 |
  |   → Query premium events where:                                 |
  |     - endDate + 358 days <= now (7 days before archive)         |
  |   → SES: send "Your event will be archived soon" email          |
  └─────────────────────────────────────────────────────────────────┘

  S3 Lifecycle Rules:
  ┌─────────────────────────────────────────────────────────────────┐
  | Rule 1: free-tier-cleanup                                       |
  |   Filter: prefix events/, tag tier=free                         |
  |   Expiration: 15 days after object creation                     |
  |                                                                 |
  | Rule 2: paid-tier-cleanup                                       |
  |   Filter: prefix events/, tag tier=paid                         |
  |   Expiration: 90 days after object creation                     |
  |                                                                 |
  | Rule 3: premium-tier-archive                                    |
  |   Filter: prefix events/, tag tier=premium                      |
  |   Transition to Glacier Deep Archive: 365 days                  |
  |   Expiration: 730 days                                          |
  |                                                                 |
  | Rule 4: export-cleanup                                          |
  |   Filter: prefix events/*/exports/                              |
  |   Expiration: 7 days                                            |
  └─────────────────────────────────────────────────────────────────┘
```

---

## 13. Email Notification Batching

```
EventBridge              Lambda                 DynamoDB                    SES
(every 30 min)           (batchNotify)                                      |
  |                        |                        |                       |
  |-- Invoke ------------->|                        |                       |
  |   (scheduled rule,    |                        |                       |
  |    rate: 30 minutes)  |                        |                       |
  |                        |                        |                       |
  |                        |-- Scan/Query --------->|                       |
  |                        |   GSI: notifiable      |                       |
  |                        |   events where:        |                       |
  |                        |   1. notifyOnUpload    |                       |
  |                        |      = true            |                       |
  |                        |   2. status = "active" |                       |
  |                        |   3. lastNotifiedAt    |                       |
  |                        |      < now - 30 min    |                       |
  |                        |      OR null           |                       |
  |                        |<-- Event list ---------|                       |
  |                        |   [{eventId,           |                       |
  |                        |     hostEmail,         |                       |
  |                        |     lastNotifiedAt,    |                       |
  |                        |     eventTitle}]       |                       |
  |                        |                        |                       |
  |                        |-- For each event: ---->|                       |
  |                        |   Query new uploads    |                       |
  |                        |   PK=EVT#{eventId}     |                       |
  |                        |   SK begins MEDIA#     |                       |
  |                        |   filter: createdAt    |                       |
  |                        |     > lastNotifiedAt   |                       |
  |                        |<-- New uploads ---------|                       |
  |                        |   count: 12            |                       |
  |                        |   thumbnails: [4 most  |                       |
  |                        |     recent thumbKeys]  |                       |
  |                        |                        |                       |
  |                        |   [If count == 0:]     |                       |
  |                        |   Skip this event      |                       |
  |                        |   (no new uploads)     |                       |
  |                        |                        |                       |
  |                        |   [If count > 0:]      |                       |
  |                        |                        |                       |
  |                        |-- Get total stats ---->|                       |
  |                        |   (uploadCount,        |                       |
  |                        |    guestCount from     |                       |
  |                        |    event META)         |                       |
  |                        |<-- Stats --------------|                       |
  |                        |                        |                       |
  |                        |-- Generate signed -----|                       |
  |                        |   thumbnail URLs       |                       |
  |                        |   (for email embed)    |                       |
  |                        |                        |                       |
  |                        |-- SES SendEmail -------|---------------------->|
  |                        |   To: hostEmail        |                       |
  |                        |   Template: "Guest     |  [Upload              |
  |                        |   Upload Notification" |   Notification email] |
  |                        |   {eventTitle,         |                       |
  |                        |    newUploadCount: 12, |                       |
  |                        |    timeWindow: "30 min"|                       |
  |                        |    thumbnailUrls: [4], |                       |
  |                        |    totalUploads: 47,   |                       |
  |                        |    totalGuests: 23,    |                       |
  |                        |    galleryUrl,         |                       |
  |                        |    settingsUrl}        |                       |
  |                        |                        |                       |
  |                        |-- UpdateItem --------->|                       |
  |                        |   PK=EVT#{eventId}     |                       |
  |                        |   SK=META              |                       |
  |                        |   SET lastNotifiedAt   |                       |
  |                        |     = :now             |                       |
  |                        |<-- Updated ------------|                       |
  |                        |                        |                       |
  |                        |-- Repeat for next event|                       |
  |                        |                        |                       |
  |                        |   [After all events    |                       |
  |                        |    processed:]         |                       |
  |                        |-- Log summary: --------|                       |
  |                        |   "Processed 8 events, |                       |
  |                        |    sent 5 notifications"|                      |
```

---

## 14. Event Summary Email — Triggered at Event End

```
EventBridge              Lambda                 DynamoDB              S3                   SES
(daily cron)             (sendEventSummaries)                                               |
  |                        |                        |                  |                     |
  |-- Invoke ------------->|                        |                  |                     |
  |                        |                        |                  |                     |
  |                        |-- Query events ------->|                  |                     |
  |                        |   where:               |                  |                     |
  |                        |   status just changed  |                  |                     |
  |                        |   to "ended" today     |                  |                     |
  |                        |   AND summaryEmailSent |                  |                     |
  |                        |   = false              |                  |                     |
  |                        |<-- Ended events -------|                  |                     |
  |                        |                        |                  |                     |
  |                        |-- For each event: ---->|                  |                     |
  |                        |   1. Get upload count  |                  |                     |
  |                        |   2. Count unique guests|                 |                     |
  |                        |      (Query GUEST# SKs)|                  |                     |
  |                        |   3. Sum all reactions |                  |                     |
  |                        |   4. Count comments    |                  |                     |
  |                        |   5. Get top 3 most    |                  |                     |
  |                        |      reacted photos    |                  |                     |
  |                        |<-- Aggregated stats ---|                  |                     |
  |                        |                        |                  |                     |
  |                        |-- Sign thumbnail URLs -|                  |                     |
  |                        |   for top photos       |                  |                     |
  |                        |                        |                  |                     |
  |                        |-- Calculate retention -|                  |                     |
  |                        |   date based on tier   |                  |                     |
  |                        |   Free: now + 15d      |                  |                     |
  |                        |   Paid: now + 60d      |                  |                     |
  |                        |   Premium: now + 365d  |                  |                     |
  |                        |                        |                  |                     |
  |                        |   [If Paid/Premium:]   |                  |                     |
  |                        |-- Create ZIP download -|                  |                     |
  |                        |   (see Flow 11)        |                  |                     |
  |                        |                        |                  |                     |
  |                        |-- SES SendEmail -------|------------------|-------------------->|
  |                        |   Template: "Event     |                  |  [Event Summary    |
  |                        |   Summary"             |                  |   email]           |
  |                        |   {eventTitle, dates,  |                  |                     |
  |                        |    coverImageUrl,      |                  |                     |
  |                        |    photoCount,         |                  |                     |
  |                        |    guestCount,         |                  |                     |
  |                        |    reactionCount,      |                  |                     |
  |                        |    commentCount,       |                  |                     |
  |                        |    topPhotoUrls,       |                  |                     |
  |                        |    downloadAllUrl,     |                  |                     |
  |                        |    galleryUrl,         |                  |                     |
  |                        |    retentionDate}      |                  |                     |
  |                        |                        |                  |                     |
  |                        |-- UpdateItem --------->|                  |                     |
  |                        |   SET summaryEmailSent |                  |                     |
  |                        |     = true             |                  |                     |
```
