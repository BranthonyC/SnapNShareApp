# Freemium Model

## Tier Comparison


| Feature                    | Free              | Paid ($9 / Q75)      | Premium ($25 / Q200)    |
| -------------------------- | ----------------- | -------------------- | ----------------------- |
| **Events**                 | 1 active          | 1 active             | 1 active                |
| **Image uploads**          | 150 per event     | 500 per event        | 1000 per event          |
| **Video uploads**          | No                | Yes (30MB/file)      | Yes (100MB/file)        |
| **Audio uploads**          | No                | Yes (10MB/file)      | Yes (20MB/file)         |
| **Max file size (images)** | 2MB               | 5MB                  | 10MB                    |
| **Storage retention**      | 30 days after end | 1 year               | 2 Year ( glacier )      |
| **Reactions**              | Basic (3 emojis)  | Full sticker set     | Full + custom           |
| **Comments**               | Yes               | Yes                  | Yes                     |
| **Gifts**                  | No                | Yes                  | Yes                     |
| **Watermark**              | Yes               | No                   | No                      |
| **ZIP download**           | No                | Yes                  | Yes                     |
| **Custom welcome page**    | Title only        | Full customization   | Full customization      |
| **QR code**                | Basic             | Branded              | Branded + printable kit |
| **Analytics**              | No                | Basic (upload count) | Full dashboard          |
| **NSFW auto-moderation**   | No                | No                   | Yes (Rekognition)       |
| **AI highlight reel**      | No                | No                   | Yes (future)            |
| **Guest OTP verification** | No                | Yes (SMS/email)      | Yes (SMS/email)         |


---

## Pricing Strategy

### Per-Event Model (Not Subscription)

Weddings, parties, and corporate events are **one-time** occasions. Monthly subscription makes no psychological sense. Charge per event.


| Tier                        | GTQ  | USD |
| --------------------------- | ---- | --- |
| Free                        | Q0   | $0  |
| Paid                        | Q75  | $9  |
| Premium                     | Q200 | $25 |
| Storage Extension (+1 year) | Q40  | $5  |


### Why These Prices?

- **Guatemala market:** Q75 (~$9.50 USD) is accessible for middle-class weddings
- **US market:** $9 is an impulse purchase
- **Premium:** positioned for high-end weddings, corporate events
- **Comparison:** Wedding photographers charge Q3,000+ — Q75 for a shared album is trivial

---

## Cost Per Event (What You Pay AWS)

### Free Event (Typical: 100 uploads, images only)


| Component                           | Cost                     |
| ----------------------------------- | ------------------------ |
| S3 storage (100 images x 500KB avg) | 50MB = $0.001            |
| S3 PUT requests (100)               | $0.0005                  |
| DynamoDB writes (100)               | $0.000125                |
| DynamoDB reads (500)                | $0.000125                |
| Lambda invocations (200)            | $0.00004                 |
| CloudFront transfer (gallery views) | Free tier                |
| **Total per free event**            | **~$0.002**              |
| **After 30 days**                   | **$0.00 (auto-deleted)** |


### Paid Event (Typical: 500 uploads, images + some video)


| Component                              | Cost         |
| -------------------------------------- | ------------ |
| S3 storage (500 files, 2GB avg)        | $0.046/month |
| S3 PUT requests (500)                  | $0.0025      |
| DynamoDB writes (600)                  | $0.00075     |
| DynamoDB reads (2000)                  | $0.0005      |
| Lambda (700 invocations)               | $0.00014     |
| CloudFront transfer (5GB views)        | ~$0.43       |
| WhatsApp OTP (200 guests)              | ~$2.26       |
| **Total per paid event (first month)** | **~$2.76**   |
| **Monthly ongoing (storage only)**     | **~$0.05**   |
| **12-month total cost**                | **~$3.30**   |
| **Revenue**                            | **$9.00**    |
| **Margin**                             | **~63%**     |


### Premium Event (Wedding: 2000 uploads, heavy video)


| Component                                 | Cost        |
| ----------------------------------------- | ----------- |
| S3 storage (2000 files, 20GB)             | $0.46/month |
| After Glacier transition (6mo)            | $0.08/month |
| S3 PUT requests (2000)                    | $0.01       |
| DynamoDB writes (3000)                    | $0.00375    |
| Lambda (3500)                             | $0.0007     |
| CloudFront transfer (50GB)                | ~$4.25      |
| WhatsApp OTP (500 guests)                 | ~$5.65      |
| **Total per premium event (first month)** | **~$10.65** |
| **12-month total cost**                   | **~$13.65** |
| **Revenue**                               | **$25.00**  |
| **Margin**                                | **~45%**    |


---

## Cost Control Mechanisms

### 1. Client-Side Compression (Biggest Savings)

Reduce all images to max 1920px, JPEG quality 0.8 before upload.


| Without compression  | With compression       |
| -------------------- | ---------------------- |
| 3-5MB per photo      | 300-800KB per photo    |
| 200 photos = 1GB     | 200 photos = 100-160MB |
| $0.023/month storage | $0.003/month storage   |


**Savings: ~85% on storage costs**

### 2. S3 Lifecycle Rules

```
Free tier events:
  - After event.endDate + 30 days → DELETE all objects
  - DynamoDB TTL deletes metadata automatically

Paid tier events:
  - After 90 days → Transition to S3 Glacier Flexible Retrieval
  - Storage drops from $0.023/GB to $0.0036/GB (84% savings)

Premium tier events:
  - After 180 days → Transition to Glacier Deep Archive
  - Storage drops to $0.00099/GB (96% savings)
```

### 3. Upload Caps

Enforce in Lambda before issuing presigned URL:

```javascript
// Atomic counter check
const result = await dynamodb.update({
  TableName: 'EventAlbum',
  Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
  UpdateExpression: 'SET uploadCount = uploadCount + :one',
  ConditionExpression: 'uploadCount < uploadLimit',
  ExpressionAttributeValues: { ':one': 1 },
  ReturnValues: 'UPDATED_NEW'
});
// If ConditionExpression fails → ConditionalCheckFailedException → return 429
```

### 4. Video = Paid Only

Video is the #1 cost driver:

- 30-second phone video = 50-100MB
- 10 videos = 500MB-1GB
- Free tier allows ZERO video → protects margins completely

### 5. CloudFront Caching

- Thumbnails cached for 24 hours → reduces S3 GET requests
- Static assets cached for 1 year → near-zero transfer cost
- Only unique first-views hit origin

---

## Free-to-Paid Conversion Strategy

### Soft Walls (Encourage Upgrade)

1. **Upload counter visible:** "47/150 uploads used" — creates urgency
2. **Watermark on gallery:** subtle "eventalbum.app" watermark — annoys enough to pay
3. **"Video disabled" message:** when guest tries to upload video → "Upgrade to enable video"
4. **30-day countdown:** "Your event expires in 12 days. Upgrade to keep memories forever."
5. **Download blocked:** "Upgrade to download all photos as ZIP"

### Hard Walls (Enforce Limits)

1. Upload count strictly enforced (atomic counter)
2. Video/audio MIME types rejected at presigned URL generation
3. File size enforced in presigned POST conditions
4. DynamoDB TTL auto-deletes free events

### Conversion Prompt Moments

- After 100 uploads (66% of limit)
- When guest tries video upload
- When host tries to download ZIP
- 7 days before event expires
- On gallery view (watermark CTA)

---

## Revenue Projections

### Conservative (Year 1)


| Month | Free Events | Paid Conversions | Premium | Revenue    |
| ----- | ----------- | ---------------- | ------- | ---------- |
| 1-3   | 50/mo       | 5 (10%)          | 1       | ~$70/mo    |
| 4-6   | 200/mo      | 30 (15%)         | 3       | ~$345/mo   |
| 7-9   | 500/mo      | 75 (15%)         | 8       | ~$875/mo   |
| 10-12 | 1000/mo     | 200 (20%)        | 20      | ~$2,300/mo |


**Year 1 total: ~$10,000-15,000**
**AWS cost: ~$500-1,000 total**
**Net margin: >90%**

### At Scale (Year 2+)


| Metric                 | Value    |
| ---------------------- | -------- |
| Monthly events         | 5,000    |
| Paid conversions (20%) | 1,000    |
| Premium (4%)           | 200      |
| Monthly revenue        | ~$14,000 |
| Monthly AWS cost       | ~$400    |
| Monthly margin         | ~97%     |


---

## Future Upsells


| Feature                  | Price     | Margin            |
| ------------------------ | --------- | ----------------- |
| Printed photobook        | Q150-300  | 40% (partnership) |
| AI highlight video       | Q50       | 80%               |
| Custom domain            | Q100/year | 95%               |
| Extended storage (+1yr)  | Q40       | 90%               |
| Event analytics report   | Q25       | 95%               |
| Branded QR printable kit | Q35       | 90%               |


