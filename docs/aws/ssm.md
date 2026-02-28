# SSM Parameter Store Configuration

## Purpose

Store all configuration values, tier limits, pricing, feature flags, and secrets. SSM Parameter Store is free ($0/month for Standard parameters), natively integrated with Lambda, and cached at cold start for zero-latency reads.

---

## Parameter Hierarchy

```
/eventalbum/
├── config/
│   ├── tiers/
│   │   ├── free              → String (JSON)
│   │   ├── paid              → String (JSON)
│   │   └── premium           → String (JSON)
│   ├── pricing               → String (JSON)
│   └── discounts             → String (JSON)
├── secrets/
│   ├── jwt-secret            → SecureString
│   ├── recurrente-public     → SecureString
│   ├── recurrente-secret     → SecureString
│   ├── cf-key-pair-id        → String
│   └── cf-private-key        → SecureString
└── features/
    ├── maintenance-mode      → String ("true"/"false")
    └── max-events-per-host   → String ("10")
```

---

## Tier Configuration Values

### /eventalbum/config/tiers/free

```json
{
  "uploadLimit": 150,
  "maxFileSizeImage": 2097152,
  "maxFileSizeVideo": 0,
  "maxFileSizeAudio": 0,
  "mediaTypes": ["image"],
  "storageRetentionDays": 15,
  "storageClass": "STANDARD",
  "watermark": true,
  "zipDownload": false,
  "customWelcomePage": false,
  "otp": false,
  "autoApprove": false,
  "guestReporting": false,
  "rekognition": false,
  "analytics": false,
  "reactions": ["❤️", "👍", "🎉"],
  "gifts": false,
  "allowVideo": false,
  "allowAudio": false,
  "allowDownloads": false,
  "emailNotifications": false
}
```

### /eventalbum/config/tiers/paid

```json
{
  "uploadLimit": 500,
  "maxFileSizeImage": 5242880,
  "maxFileSizeVideo": 31457280,
  "maxFileSizeAudio": 10485760,
  "mediaTypes": ["image", "video", "audio"],
  "storageRetentionDays": 180,
  "storageClass": "GLACIER_AFTER_90",
  "watermark": false,
  "zipDownload": true,
  "customWelcomePage": true,
  "otp": true,
  "autoApprove": false,
  "guestReporting": true,
  "rekognition": false,
  "analytics": true,
  "reactions": "all",
  "gifts": true,
  "allowVideo": true,
  "allowAudio": true,
  "allowDownloads": true,
  "emailNotifications": true
}
```

### /eventalbum/config/tiers/premium

```json
{
  "uploadLimit": 1000,
  "maxFileSizeImage": 10485760,
  "maxFileSizeVideo": 104857600,
  "maxFileSizeAudio": 20971520,
  "mediaTypes": ["image", "video", "audio"],
  "storageRetentionDays": 365,
  "storageClass": "GLACIER_DEEP_AFTER_180",
  "watermark": false,
  "zipDownload": true,
  "customWelcomePage": true,
  "otp": true,
  "autoApprove": true,
  "guestReporting": true,
  "rekognition": true,
  "analytics": true,
  "reactions": "all",
  "gifts": true,
  "allowVideo": true,
  "allowAudio": true,
  "allowDownloads": true,
  "emailNotifications": true
}
```

---

## Pricing Configuration

### /eventalbum/config/pricing

```json
{
  "paid": { "GTQ": 7500, "USD": 900 },
  "premium": { "GTQ": 20000, "USD": 2500 },
  "storageExtension": { "GTQ": 4000, "USD": 500 }
}
```

All amounts in **cents** (GTQ centavos / USD cents). Q75.00 = 7500, $9.00 = 900.

---

## Discount Codes Configuration

### /eventalbum/config/discounts

```json
{
  "codes": {
    "LAUNCH50": {
      "type": "percent",
      "value": 50,
      "maxUses": 100,
      "usedCount": 0,
      "expiresAt": "2026-06-01"
    },
    "FRIEND10": {
      "type": "fixed",
      "value": { "GTQ": 1000, "USD": 100 },
      "maxUses": null,
      "usedCount": 0,
      "expiresAt": null
    }
  }
}
```

---

## Secrets

| Parameter | Type | Description |
|---|---|---|
| `/eventalbum/secrets/jwt-secret` | SecureString | 256-bit random secret for JWT signing (HS256) |
| `/eventalbum/secrets/recurrente-public` | SecureString | Recurrente X-PUBLIC-KEY |
| `/eventalbum/secrets/recurrente-secret` | SecureString | Recurrente X-SECRET-KEY |
| `/eventalbum/secrets/cf-key-pair-id` | String | CloudFront key pair ID for signed URLs |
| `/eventalbum/secrets/cf-private-key` | SecureString | CloudFront RSA private key (PEM format) |

### Generate JWT Secret

```bash
# Generate a 256-bit random secret
JWT_SECRET=$(openssl rand -base64 32)

aws ssm put-parameter \
  --name "/eventalbum/secrets/jwt-secret" \
  --value "${JWT_SECRET}" \
  --type SecureString \
  --profile codersatelier
```

### Store Recurrente Keys

```bash
# Public key
aws ssm put-parameter \
  --name "/eventalbum/secrets/recurrente-public" \
  --value "pk_test_xxxxxxxxxxxx" \
  --type SecureString \
  --profile codersatelier

# Secret key
aws ssm put-parameter \
  --name "/eventalbum/secrets/recurrente-secret" \
  --value "sk_test_xxxxxxxxxxxx" \
  --type SecureString \
  --profile codersatelier
```

### Store CloudFront Key Pair

```bash
# Key pair ID (not secret, but store in SSM for consistency)
aws ssm put-parameter \
  --name "/eventalbum/secrets/cf-key-pair-id" \
  --value "K2XXXXXXXXXX" \
  --type String \
  --profile codersatelier

# Private key (PEM file content)
aws ssm put-parameter \
  --name "/eventalbum/secrets/cf-private-key" \
  --value file://cloudfront-private-key.pem \
  --type SecureString \
  --profile codersatelier
```

---

## Feature Flags

| Parameter | Value | Purpose |
|---|---|---|
| `/eventalbum/features/maintenance-mode` | `"false"` | When `"true"`, API returns 503 for all non-health endpoints |
| `/eventalbum/features/max-events-per-host` | `"10"` | Max events a single host email can create |

```bash
# Set maintenance mode
aws ssm put-parameter \
  --name "/eventalbum/features/maintenance-mode" \
  --value "true" \
  --type String \
  --overwrite \
  --profile codersatelier

# Disable maintenance mode
aws ssm put-parameter \
  --name "/eventalbum/features/maintenance-mode" \
  --value "false" \
  --type String \
  --overwrite \
  --profile codersatelier
```

---

## CLI: Create All Parameters

### Tier Configs

```bash
aws ssm put-parameter \
  --name "/eventalbum/config/tiers/free" \
  --value '{"uploadLimit":150,"maxFileSizeImage":2097152,"maxFileSizeVideo":0,"maxFileSizeAudio":0,"mediaTypes":["image"],"storageRetentionDays":15,"storageClass":"STANDARD","watermark":true,"zipDownload":false,"customWelcomePage":false,"otp":false,"autoApprove":false,"guestReporting":false,"rekognition":false,"analytics":false,"reactions":["❤️","👍","🎉"],"gifts":false,"allowVideo":false,"allowAudio":false,"allowDownloads":false,"emailNotifications":false}' \
  --type String \
  --profile codersatelier

aws ssm put-parameter \
  --name "/eventalbum/config/tiers/paid" \
  --value '{"uploadLimit":500,"maxFileSizeImage":5242880,"maxFileSizeVideo":31457280,"maxFileSizeAudio":10485760,"mediaTypes":["image","video","audio"],"storageRetentionDays":180,"storageClass":"GLACIER_AFTER_90","watermark":false,"zipDownload":true,"customWelcomePage":true,"otp":true,"autoApprove":false,"guestReporting":true,"rekognition":false,"analytics":true,"reactions":"all","gifts":true,"allowVideo":true,"allowAudio":true,"allowDownloads":true,"emailNotifications":true}' \
  --type String \
  --profile codersatelier

aws ssm put-parameter \
  --name "/eventalbum/config/tiers/premium" \
  --value '{"uploadLimit":1000,"maxFileSizeImage":10485760,"maxFileSizeVideo":104857600,"maxFileSizeAudio":20971520,"mediaTypes":["image","video","audio"],"storageRetentionDays":365,"storageClass":"GLACIER_DEEP_AFTER_180","watermark":false,"zipDownload":true,"customWelcomePage":true,"otp":true,"autoApprove":true,"guestReporting":true,"rekognition":true,"analytics":true,"reactions":"all","gifts":true,"allowVideo":true,"allowAudio":true,"allowDownloads":true,"emailNotifications":true}' \
  --type String \
  --profile codersatelier
```

### Pricing and Discounts

```bash
aws ssm put-parameter \
  --name "/eventalbum/config/pricing" \
  --value '{"paid":{"GTQ":7500,"USD":900},"premium":{"GTQ":20000,"USD":2500},"storageExtension":{"GTQ":4000,"USD":500}}' \
  --type String \
  --profile codersatelier

aws ssm put-parameter \
  --name "/eventalbum/config/discounts" \
  --value '{"codes":{"LAUNCH50":{"type":"percent","value":50,"maxUses":100,"usedCount":0,"expiresAt":"2026-06-01"},"FRIEND10":{"type":"fixed","value":{"GTQ":1000,"USD":100},"maxUses":null,"usedCount":0,"expiresAt":null}}}' \
  --type String \
  --profile codersatelier
```

### Feature Flags

```bash
aws ssm put-parameter \
  --name "/eventalbum/features/maintenance-mode" \
  --value "false" \
  --type String \
  --profile codersatelier

aws ssm put-parameter \
  --name "/eventalbum/features/max-events-per-host" \
  --value "10" \
  --type String \
  --profile codersatelier
```

---

## Lambda Integration

### Config Loader (Cached at Cold Start)

```javascript
// src/shared/config.mjs
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient();
let cachedConfig = null;

export async function getTierConfig(tier) {
  if (!cachedConfig) {
    const [free, paid, premium, pricing, discounts] = await Promise.all([
      getParam('/eventalbum/config/tiers/free'),
      getParam('/eventalbum/config/tiers/paid'),
      getParam('/eventalbum/config/tiers/premium'),
      getParam('/eventalbum/config/pricing'),
      getParam('/eventalbum/config/discounts'),
    ]);
    cachedConfig = { free, paid, premium, pricing, discounts };
  }
  return cachedConfig[tier];
}

export async function getPricing() {
  if (!cachedConfig) await getTierConfig('free'); // Force load
  return cachedConfig.pricing;
}

export async function getDiscounts() {
  if (!cachedConfig) await getTierConfig('free'); // Force load
  return cachedConfig.discounts;
}

async function getParam(name) {
  const { Parameter } = await ssm.send(new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  }));
  return JSON.parse(Parameter.Value);
}
```

### Secret Loader

```javascript
// src/shared/secrets.mjs
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient();
const secretCache = {};

export async function getSecret(name) {
  if (!secretCache[name]) {
    const { Parameter } = await ssm.send(new GetParameterCommand({
      Name: `/eventalbum/secrets/${name}`,
      WithDecryption: true,
    }));
    secretCache[name] = Parameter.Value;
  }
  return secretCache[name];
}

// Usage:
// const jwtSecret = await getSecret('jwt-secret');
// const recurrentePublic = await getSecret('recurrente-public');
// const cfPrivateKey = await getSecret('cf-private-key');
```

### Feature Flag Loader

```javascript
// src/shared/features.mjs
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient();
let featureCache = null;
let featureCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (features change more often)

export async function getFeatureFlag(flag) {
  const now = Date.now();
  if (!featureCache || now - featureCacheTime > CACHE_TTL_MS) {
    const [maintenance, maxEvents] = await Promise.all([
      getStringParam('/eventalbum/features/maintenance-mode'),
      getStringParam('/eventalbum/features/max-events-per-host'),
    ]);
    featureCache = {
      'maintenance-mode': maintenance === 'true',
      'max-events-per-host': parseInt(maxEvents, 10),
    };
    featureCacheTime = now;
  }
  return featureCache[flag];
}

async function getStringParam(name) {
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: name }));
  return Parameter.Value;
}
```

---

## Update Parameters (Configuration Changes)

Changes take effect on the next Lambda cold start. To force immediate propagation:

### Method 1: Wait for Natural Cold Starts

Lambda instances recycle naturally. Most changes propagate within 15 minutes.

### Method 2: Force Redeployment

```bash
# Update all Lambda functions to force cold starts
aws lambda update-function-configuration \
  --function-name EventAlbum-prod-createEvent \
  --environment '{"Variables":{"CONFIG_VERSION":"2026-03-15-1"}}' \
  --profile codersatelier
```

### Method 3: Update the Parameter (Overwrite)

```bash
# Example: increase max events per host from 10 to 20
aws ssm put-parameter \
  --name "/eventalbum/features/max-events-per-host" \
  --value "20" \
  --type String \
  --overwrite \
  --profile codersatelier
```

### Rotate JWT Secret

```bash
NEW_SECRET=$(openssl rand -base64 32)
aws ssm put-parameter \
  --name "/eventalbum/secrets/jwt-secret" \
  --value "${NEW_SECRET}" \
  --type SecureString \
  --overwrite \
  --profile codersatelier

# Then force cold starts on all auth-related Lambdas
```

Schedule: Rotate every 90 days. Consider a dual-secret strategy (accept both old and new for 24 hours) to avoid invalidating active JWTs.

---

## List All Parameters

```bash
# List all EventAlbum parameters
aws ssm get-parameters-by-path \
  --path "/eventalbum/" \
  --recursive \
  --with-decryption \
  --profile codersatelier

# List only config parameters (no secrets)
aws ssm get-parameters-by-path \
  --path "/eventalbum/config/" \
  --recursive \
  --profile codersatelier

# Get a specific parameter
aws ssm get-parameter \
  --name "/eventalbum/config/tiers/paid" \
  --profile codersatelier

# Get a secret (with decryption)
aws ssm get-parameter \
  --name "/eventalbum/secrets/jwt-secret" \
  --with-decryption \
  --profile codersatelier
```

---

## Environment Separation

For dev vs prod, use environment-prefixed paths OR separate AWS accounts.

**Option A: Prefixed paths** (simpler, single account)

```
/eventalbum/dev/config/tiers/free
/eventalbum/prod/config/tiers/free
```

**Option B: Same paths, different accounts** (more secure, recommended for Phase 4+)

Both dev and prod use `/eventalbum/config/tiers/free` but in different AWS accounts.

For MVP (Phase 1-3): Use Option A with the Lambda environment variable `ENVIRONMENT` to construct the path prefix.

```javascript
const ENV = process.env.ENVIRONMENT || 'dev';
const paramPath = `/eventalbum/${ENV}/config/tiers/${tier}`;
```

---

## IAM Policy for Lambda Access

```yaml
# SAM template — read config parameters
- SSMParameterReadPolicy:
    ParameterName: eventalbum/config/*

# SAM template — read secrets
- SSMParameterReadPolicy:
    ParameterName: eventalbum/secrets/*

# SAM template — read feature flags
- SSMParameterReadPolicy:
    ParameterName: eventalbum/features/*
```

---

## Cost

| Component | Monthly Cost |
|---|---|
| Standard parameters (up to 10,000) | $0.00 |
| SecureString with AWS managed KMS key | $0.00 |
| API calls (Standard throughput, 40 TPS) | $0.00 |
| Advanced parameters (not needed) | $0.05/parameter/month |
| Higher throughput (not needed) | $0.05/10,000 API calls |

**Total idle cost: $0.00/month**

SSM Parameter Store Standard tier is completely free for storage, encryption (AWS managed key), and API calls at Standard throughput.

---

## Limits

| Limit | Value |
|---|---|
| Max parameters (Standard) | 10,000 |
| Max parameter value size (Standard) | 4 KB |
| Max parameter value size (Advanced) | 8 KB |
| Max API throughput (Standard) | 40 TPS |
| Max parameter name length | 2048 characters |
| Max hierarchy depth | 15 levels |

EventAlbum uses approximately 12 parameters total, well within all limits.
