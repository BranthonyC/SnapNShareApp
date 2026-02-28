# Lambda Configuration

## Global Defaults

| Setting | Value | Reason |
|---|---|---|
| Runtime | `nodejs22.x` | Latest LTS, native ES modules, top-level await |
| Architecture | `arm64` (Graviton2) | 20% cheaper, better perf/watt |
| Memory | 128 MB (default) | Sufficient for API handlers |
| Timeout | 10 seconds (default) | API responses should be fast |
| Ephemeral storage | 512 MB (default) | Free, included with every invocation |
| Handler | `index.handler` | ESM entry point |
| Log format | JSON | Structured logging for CloudWatch Insights |
| Tracing | PassThrough (no X-Ray) | Enable X-Ray later if needed ($5/million traces) |

---

## Function Inventory

### API Handlers

| Function | Memory | Timeout | Purpose |
|---|---|---|---|
| `createEvent` | 128 MB | 10s | Create new event, hash password, store in DDB |
| `authEvent` | 128 MB | 10s | Verify password, issue JWT |
| `getEvent` | 128 MB | 10s | Return event details with signed CDN URLs |
| `updateEvent` | 128 MB | 10s | Update event title, date, settings |
| `deleteEvent` | 128 MB | 30s | Delete event + all S3 objects + DDB records |
| `getUploadUrl` | 128 MB | 10s | Generate S3 presigned PUT URL |
| `listMedia` | 128 MB | 10s | List media with paginated signed CDN URLs |
| `deleteMedia` | 128 MB | 10s | Delete single media from S3 + DDB |
| `bulkDeleteMedia` | 128 MB | 30s | Delete multiple media items |
| `clearAllMedia` | 256 MB | 60s | Delete all media in an event |
| `searchMedia` | 128 MB | 10s | Filter/search media by metadata |
| `addReaction` | 128 MB | 5s | Add/toggle reaction on media |
| `addComment` | 128 MB | 5s | Add comment to media |
| `listComments` | 128 MB | 10s | List comments for media |
| `reportMedia` | 128 MB | 5s | Flag media for review |
| `moderateMedia` | 128 MB | 10s | Accept/reject reported media |
| `sendOtp` | 128 MB | 15s | Send SMS/email OTP via SNS/SES |
| `verifyOtp` | 128 MB | 5s | Verify OTP code |
| `getStats` | 128 MB | 10s | Event statistics dashboard |
| `getActivity` | 128 MB | 10s | Activity feed for host |
| `getQrStats` | 128 MB | 10s | QR scan analytics |
| `getStorage` | 128 MB | 10s | Storage usage per event |
| `updateSettings` | 128 MB | 10s | Update event settings |
| `createCheckout` | 128 MB | 15s | Create Recurrente checkout session |
| `validatePromo` | 128 MB | 5s | Validate promo/discount code |
| `downloadZip` | 512 MB | 120s | Stream S3 objects into ZIP |
| `hostLogin` | 128 MB | 10s | Send OTP to host email |
| `hostVerify` | 128 MB | 10s | Verify host OTP, issue JWT |
| `handleWebhook` | 128 MB | 15s | Process Recurrente payment webhook |
| `getConfig` | 128 MB | 5s | Return public app config (tiers, limits) |

### Background/Event-Driven Functions

| Function | Memory | Timeout | Trigger | Purpose |
|---|---|---|---|---|
| `processUpload` | 512 MB | 60s | S3 Event (ObjectCreated) | Generate thumbnails, extract EXIF, moderate |
| `cleanupExpiredEvents` | 256 MB | 300s | EventBridge (daily) | Delete expired events and S3 objects |
| `sendUploadNotifications` | 128 MB | 60s | EventBridge (every 30 min) | Batch email notifications to hosts |
| `sendEventSummary` | 128 MB | 60s | EventBridge (daily) | Send post-event summary email |
| `processBounce` | 128 MB | 10s | SNS (SES bounce topic) | Update suppression list |

---

## Function-Specific Overrides

| Function | Memory | Timeout | Reason |
|---|---|---|---|
| `processUpload` | 512 MB | 60s | Sharp image processing (resize, convert to WebP), EXIF extraction, optional Rekognition call |
| `downloadZip` | 512 MB | 120s | Stream multiple S3 objects, create ZIP in /tmp, upload to S3, return presigned URL |
| `cleanupExpiredEvents` | 256 MB | 300s | Scan DDB for expired events, batch delete S3 objects across many events |
| `clearAllMedia` | 256 MB | 60s | List and delete all objects in an event prefix, may be hundreds of files |
| `deleteEvent` | 128 MB | 30s | Delete S3 objects + DDB records (could be large) |
| `bulkDeleteMedia` | 128 MB | 30s | Delete up to 50 items per request |

---

## Layers

### 1. Sharp Layer

- **Purpose:** Image processing for thumbnail generation (resize, crop, WebP conversion)
- **Size:** ~15 MB (ARM64 native build)
- **Used by:** `processUpload`
- **Runtime:** Node.js 22.x
- **Architecture:** arm64

```bash
# Build sharp for ARM64 Lambda
mkdir -p sharp-layer/nodejs
cd sharp-layer/nodejs
npm init -y
npm install sharp --arch=arm64 --platform=linux
cd ..

# Package layer
zip -r sharp-layer.zip nodejs/

# Publish layer
aws lambda publish-layer-version \
  --layer-name EventAlbum-sharp \
  --description "Sharp image processing for ARM64 Node.js 22" \
  --compatible-runtimes nodejs22.x \
  --compatible-architectures arm64 \
  --zip-file fileb://sharp-layer.zip \
  --profile codersatelier

# Store layer ARN
aws ssm put-parameter \
  --name "/eventalbum/layers/sharp-arn" \
  --type String \
  --value "<LAYER_VERSION_ARN>" \
  --profile codersatelier
```

### 2. Bcrypt Layer

- **Purpose:** Password hashing (bcryptjs is pure JS, but native bcrypt is faster)
- **Size:** ~5 MB (ARM64 native build)
- **Used by:** `createEvent`, `authEvent`
- **Alternative:** Use `bcryptjs` (pure JS, no native addon) — slower but no layer needed

```bash
# Build bcrypt for ARM64 Lambda
mkdir -p bcrypt-layer/nodejs
cd bcrypt-layer/nodejs
npm init -y
npm install bcrypt --arch=arm64 --platform=linux
cd ..

zip -r bcrypt-layer.zip nodejs/

aws lambda publish-layer-version \
  --layer-name EventAlbum-bcrypt \
  --description "Bcrypt native addon for ARM64 Node.js 22" \
  --compatible-runtimes nodejs22.x \
  --compatible-architectures arm64 \
  --zip-file fileb://bcrypt-layer.zip \
  --profile codersatelier
```

**Decision note:** Consider using `bcryptjs` (pure JavaScript) instead to avoid maintaining a native layer. Trade-off: ~3x slower hashing (~300ms vs ~100ms for 10 salt rounds), but simplifies deployment. For our use case (low-frequency password hashing), `bcryptjs` is acceptable.

---

## Environment Variables

### All Functions

| Variable | Source | Example Value |
|---|---|---|
| `TABLE_NAME` | SAM `!Ref` | `EventAlbum-dev` |
| `MEDIA_BUCKET` | SAM `!Ref` | `eventalbum-media-dev` |
| `STAGE` | SAM `!Ref Environment` | `dev` / `staging` / `prod` |
| `LOG_LEVEL` | SAM parameter | `debug` / `info` / `warn` |

### Auth Functions (createEvent, authEvent, hostLogin, hostVerify)

| Variable | Source | Value |
|---|---|---|
| `JWT_SECRET` | SSM SecureString | HS256 signing secret (min 256-bit) |
| `JWT_EXPIRY` | SAM parameter | `24h` |

### Media Functions (getEvent, listMedia, getUploadUrl)

| Variable | Source | Value |
|---|---|---|
| `CLOUDFRONT_DOMAIN` | SAM `!GetAtt` | `cdn.eventalbum.app` |
| `CLOUDFRONT_KEY_PAIR_ID` | SSM String | CloudFront key pair ID |
| `CLOUDFRONT_PRIVATE_KEY` | SSM SecureString | RSA private key (PEM) |

### Notification Functions (sendOtp, sendUploadNotifications, sendEventSummary)

| Variable | Source | Value |
|---|---|---|
| `SES_FROM_EMAIL` | SSM String | `noreply@eventalbum.app` |
| `SES_CONFIGURATION_SET` | SAM parameter | `EventAlbum` |

### Payment Functions (createCheckout, handleWebhook)

| Variable | Source | Value |
|---|---|---|
| `RECURRENTE_PUBLIC_KEY` | SSM SecureString | Recurrente API public key |
| `RECURRENTE_SECRET_KEY` | SSM SecureString | Recurrente API secret key |
| `RECURRENTE_API_URL` | SAM parameter | `https://app.recurrente.com` / `https://sandbox.recurrente.com` |

### SSM Parameter Setup

```bash
# JWT secret (generate a strong random key)
aws ssm put-parameter \
  --name "/eventalbum/dev/jwt-secret" \
  --type SecureString \
  --value "$(openssl rand -base64 48)" \
  --profile codersatelier

# CloudFront key pair ID
aws ssm put-parameter \
  --name "/eventalbum/dev/cloudfront-key-pair-id" \
  --type String \
  --value "<KEY_PAIR_ID>" \
  --profile codersatelier

# CloudFront private key (PEM file)
aws ssm put-parameter \
  --name "/eventalbum/dev/cloudfront-private-key" \
  --type SecureString \
  --value file://cf-private-key.pem \
  --profile codersatelier

# SES from email
aws ssm put-parameter \
  --name "/eventalbum/dev/ses-from-email" \
  --type String \
  --value "noreply@eventalbum.app" \
  --profile codersatelier

# Recurrente keys
aws ssm put-parameter \
  --name "/eventalbum/dev/recurrente-public-key" \
  --type SecureString \
  --value "<PUBLIC_KEY>" \
  --profile codersatelier

aws ssm put-parameter \
  --name "/eventalbum/dev/recurrente-secret-key" \
  --type SecureString \
  --value "<SECRET_KEY>" \
  --profile codersatelier
```

---

## Concurrency

| Setting | Value | Notes |
|---|---|---|
| Reserved concurrency | Not set | Uses account default (1,000 concurrent) |
| Provisioned concurrency | Not set | $0 at idle, cold starts acceptable |

### Cost Control: Reserved Concurrency Limits

If runaway invocations are a concern, set per-function reserved concurrency:

```bash
aws lambda put-function-concurrency \
  --function-name EventAlbum-createEvent-dev \
  --reserved-concurrent-executions 10 \
  --profile codersatelier

aws lambda put-function-concurrency \
  --function-name EventAlbum-processUpload-dev \
  --reserved-concurrent-executions 25 \
  --profile codersatelier
```

| Function | Suggested Reserve | Reason |
|---|---|---|
| `processUpload` | 25 | Heaviest function (512 MB), prevent cost spike |
| `createEvent` | 10 | Low frequency, rate-limited in Lambda |
| `sendOtp` | 10 | Limit SMS spend |
| `downloadZip` | 5 | Heavy memory, long duration |
| All others | Not set | Share remaining pool |

**Warning:** Total reserved concurrency across all functions cannot exceed account limit (1,000). Unreserved functions share whatever is left.

---

## Lambda Function URLs

**Not used.** All functions are invoked exclusively via API Gateway HTTP API. Function URLs would bypass our JWT authorizer and CORS configuration.

---

## IAM Execution Role

### Base Role (All Functions)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:<ACCOUNT_ID>:log-group:/aws/lambda/EventAlbum-*"
    },
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/EventAlbum-*",
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/EventAlbum-*/index/*"
      ]
    },
    {
      "Sid": "SSMParameters",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:us-east-1:<ACCOUNT_ID>:parameter/eventalbum/*"
    }
  ]
}
```

### Additional Permissions per Function

| Function | Extra Permissions | Resource |
|---|---|---|
| `getUploadUrl` | `s3:PutObject` | `eventalbum-media-{env}/events/*` |
| `processUpload` | `s3:GetObject`, `s3:PutObject`, `s3:PutObjectTagging` | `eventalbum-media-{env}/*` |
| `processUpload` | `rekognition:DetectModerationLabels` | `*` |
| `deleteMedia` | `s3:DeleteObject` | `eventalbum-media-{env}/events/*` |
| `deleteEvent` | `s3:ListBucket`, `s3:DeleteObject` | `eventalbum-media-{env}` |
| `downloadZip` | `s3:GetObject`, `s3:PutObject` | `eventalbum-media-{env}/*` |
| `sendOtp` | `sns:Publish` | `*` (SMS requires `*`) |
| `sendOtp` | `ses:SendTemplatedEmail` | `arn:aws:ses:us-east-1:<ACCOUNT_ID>:identity/*` |
| `sendUploadNotifications` | `ses:SendTemplatedEmail` | `arn:aws:ses:*:*:identity/*` |
| `listMedia`, `getEvent` | `cloudfront:CreateSignedUrl` | N/A (done via SDK, no IAM needed) |

---

## Logging

### CloudWatch Log Groups

```bash
# Create log groups with retention (SAM handles this, but manual reference)
aws logs create-log-group \
  --log-group-name /aws/lambda/EventAlbum-createEvent-dev \
  --profile codersatelier

aws logs put-retention-policy \
  --log-group-name /aws/lambda/EventAlbum-createEvent-dev \
  --retention-in-days 30 \
  --profile codersatelier
```

### Log Retention per Environment

| Environment | Retention |
|---|---|
| dev | 7 days |
| staging | 14 days |
| prod | 30 days |

### Structured Logging Pattern

```typescript
const log = {
  info: (msg: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'INFO', msg, ...data, ts: Date.now() })),
  warn: (msg: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'WARN', msg, ...data, ts: Date.now() })),
  error: (msg: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'ERROR', msg, ...data, ts: Date.now() })),
};

// Usage
log.info('Upload URL generated', { eventId, mediaId, contentType });
log.error('DynamoDB write failed', { eventId, error: err.message });
```

---

## Cold Start Optimization

| Technique | Impact | Implementation |
|---|---|---|
| ARM64 + Node.js 22 | ~200ms cold start | Runtime/arch selection |
| Lazy-load SDK clients | Reduce init time | Import at top, instantiate in handler |
| Cache SSM at init | Avoid per-request SSM calls | Module-level variable, fetch once |
| Small function bundles | Faster code download | Single responsibility, tree-shake |
| Avoid `node_modules` bloat | Smaller package | Use layers for large deps (sharp) |
| ES modules | Faster parsing | `"type": "module"` in package.json |

### SDK Client Pattern

```typescript
// Import at module level (parsed during init)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Create client at module level (reused across warm invocations)
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// SSM parameter cache
let cachedConfig: Record<string, string> | null = null;

async function getConfig() {
  if (cachedConfig) return cachedConfig;
  // Fetch from SSM once per cold start
  cachedConfig = await fetchSSMParameters();
  return cachedConfig;
}

export async function handler(event: APIGatewayProxyEventV2) {
  const config = await getConfig();
  // ... handler logic
}
```

---

## Event-Driven Triggers

### S3 Event Notification (processUpload)

```bash
# Configured via SAM template — S3 triggers Lambda when objects are created
# Filter: prefix=events/, suffix=.jpg,.jpeg,.png,.webp,.mp4,.mov,.heic
```

### EventBridge Schedules

| Schedule | Function | Cron | Purpose |
|---|---|---|---|
| Daily cleanup | `cleanupExpiredEvents` | `cron(0 6 * * ? *)` | Delete expired free events |
| Upload digest | `sendUploadNotifications` | `rate(30 minutes)` | Batch notify hosts of new uploads |
| Event summary | `sendEventSummary` | `cron(0 9 * * ? *)` | Post-event summary emails |

```bash
# EventBridge rule example (managed by SAM)
aws events put-rule \
  --name EventAlbum-DailyCleanup-dev \
  --schedule-expression "cron(0 6 * * ? *)" \
  --state ENABLED \
  --profile codersatelier
```

---

## Deployment (SAM)

### SAM Function Definition Example

```yaml
CreateEventFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub EventAlbum-createEvent-${Environment}
    Handler: index.handler
    Runtime: nodejs22.x
    Architectures:
      - arm64
    MemorySize: 128
    Timeout: 10
    CodeUri: src/functions/createEvent/
    Environment:
      Variables:
        TABLE_NAME: !Ref EventAlbumTable
        MEDIA_BUCKET: !Ref MediaBucket
        STAGE: !Ref Environment
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref EventAlbumTable
    Events:
      Api:
        Type: HttpApi
        Properties:
          ApiId: !Ref HttpApi
          Method: POST
          Path: /events
```

---

## Cost Summary

| Resource | Idle Cost | Notes |
|---|---|---|
| Lambda (no invocations) | $0.00/month | Pay per request + duration only |
| Free tier | 1M requests/month | Perpetual (not 12-month limited) |
| Free tier | 400,000 GB-seconds/month | Perpetual |
| 128 MB x 10s invocation | $0.0000167 each | After free tier |
| 512 MB x 60s invocation | $0.0005002 each | processUpload heavy function |
| CloudWatch Logs | $0.50/GB ingested | Log retention cost only |
| **No invocations** | **$0.00/month** | Near-zero idle cost |

## Security Checklist

- [x] ARM64 architecture (Graviton2) for cost + performance
- [x] Minimal IAM permissions per function (least privilege)
- [x] Secrets stored in SSM SecureString (not env vars directly)
- [x] Lambda resolves SSM at cold start, caches in memory
- [x] No function URLs exposed (API Gateway only)
- [x] Structured JSON logging
- [x] Log retention set (not indefinite)
- [x] Reserved concurrency considered for cost control
- [x] No provisioned concurrency ($0 idle)
- [x] Environment variables for non-secret config only
