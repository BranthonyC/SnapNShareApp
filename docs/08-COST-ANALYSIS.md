# AWS Cost Analysis

## Design Principle: Near-Zero When Idle

Every service chosen has **zero base cost**. You only pay for actual usage.

---

## Service-by-Service Breakdown

### 1. S3 — Static Website (Frontend)

| Item | Cost |
|---|---|
| Storage (~5MB build) | $0.0001/month |
| PUT (deploys, ~100 files) | $0.0005/deploy |
| GET (served via CloudFront) | $0.00 |
| **Idle cost** | **~$0.00** |

### 2. S3 — Media Storage (Biggest Variable Cost)

| Tier | Cost/GB/month |
|---|---|
| S3 Standard | $0.023 |
| S3 Glacier Flexible | $0.0036 |
| S3 Glacier Deep Archive | $0.00099 |

| Scenario | Storage | Monthly Cost |
|---|---|---|
| 10 events (MVP) | ~1GB | $0.023 |
| 100 events | ~30GB | $0.69 |
| 1,000 events | ~300GB | $6.90 |
| 1,000 events (after Glacier) | ~300GB | $1.08 |

**PUT requests:** $0.005/1,000 → 10,000 uploads = $0.05
**GET requests (via CloudFront):** $0.0004/1,000 → usually negligible

### 3. CloudFront — CDN

| Item | Free Tier (first 12 months) | After Free Tier |
|---|---|---|
| Data transfer | 1TB/month free | $0.085/GB |
| Requests (HTTPS) | 10M/month free | $0.01/10,000 |
| **Idle cost** | **$0.00** | **$0.00** |

**Key insight:** CloudFront free tier is generous. Most early-stage usage fits within it.

After free tier, media-heavy events will drive transfer costs:
- 100 events, 500 gallery views each, 50 thumbnails/view = ~25GB = ~$2.13

### 4. API Gateway — HTTP API

| Item | Cost |
|---|---|
| First 300M requests/month | $1.00/million |
| **Idle cost** | **$0.00** |

| Scenario | Requests | Cost |
|---|---|---|
| 10 events | ~5,000 | $0.005 |
| 100 events | ~50,000 | $0.05 |
| 1,000 events | ~500,000 | $0.50 |

### 5. Lambda

| Item | Cost |
|---|---|
| First 1M invocations/month | Free |
| After: per invocation | $0.0000002 |
| Compute (128MB, 100ms avg) | $0.0000001667/100ms |
| **Idle cost** | **$0.00** |

| Scenario | Invocations | Cost |
|---|---|---|
| 10 events | ~2,000 | $0.00 (free tier) |
| 100 events | ~20,000 | $0.00 (free tier) |
| 1,000 events | ~200,000 | $0.00 (free tier) |
| 10,000 events | ~2,000,000 | ~$0.40 |

**Note:** Lambda free tier is 1M invocations + 400,000 GB-seconds/month — **perpetual, not 12-month limited**.

### 6. DynamoDB — On-Demand

| Item | Cost |
|---|---|
| Write request unit (WRU) | $1.25/million |
| Read request unit (RRU) | $0.25/million |
| Storage | $0.25/GB/month |
| **Idle cost** | **$0.00** |

| Scenario | Writes | Reads | Storage | Cost |
|---|---|---|---|---|
| 10 events | 1,000 | 5,000 | <1MB | $0.003 |
| 100 events | 10,000 | 50,000 | ~10MB | $0.02 |
| 1,000 events | 100,000 | 500,000 | ~100MB | $0.25 |

### 7. AWS WAF (Optional at MVP)

| Item | Cost |
|---|---|
| Web ACL | $5.00/month |
| Rules | $1.00/rule/month |
| Requests | $0.60/million |
| **Idle cost** | **$5.00/month** |

**Recommendation:** Skip WAF at MVP. Use API Gateway throttling + Lambda rate limiting instead. Add WAF when revenue > $100/month.

### 8. Secrets Manager

| Item | Cost |
|---|---|
| Per secret | $0.40/month |
| API calls | $0.05/10,000 |
| **For 3 secrets** | **~$1.20/month** |

**Alternative:** Use Lambda environment variables encrypted with default KMS key = $0.00. Less secure but free. Good for MVP.

### 9. Route 53 (Domain)

| Item | Cost |
|---|---|
| Hosted zone | $0.50/month |
| Queries | $0.40/million |
| Domain registration | ~$12/year (.app) |

---

## Total Cost Scenarios

### Scenario 1: Pre-Launch / Development

| Service | Cost |
|---|---|
| Everything | $0.00 |
| Domain (Route 53) | $0.50 |
| **Total** | **~$0.50/month** |

### Scenario 2: Soft Launch (10 events/month)

| Service | Cost |
|---|---|
| S3 storage | $0.02 |
| CloudFront | $0.00 (free tier) |
| API Gateway | $0.01 |
| Lambda | $0.00 (free tier) |
| DynamoDB | $0.01 |
| Route 53 | $0.50 |
| **Total** | **~$0.55/month** |
| **Revenue (2 paid @ $9)** | **$18.00** |

### Scenario 3: Growth (100 events/month)

| Service | Cost |
|---|---|
| S3 storage (cumulative 100GB) | $2.30 |
| CloudFront | $0.00 (free tier) |
| API Gateway | $0.05 |
| Lambda | $0.00 (free tier) |
| DynamoDB | $0.15 |
| Route 53 | $0.50 |
| **Total** | **~$3.00/month** |
| **Revenue (20 paid @ $9)** | **$180.00** |
| **Margin** | **~98%** |

### Scenario 4: Scale (1,000 events/month)

| Service | Cost |
|---|---|
| S3 storage (cumulative 1TB) | $23.00 |
| S3 Glacier (older events) | $3.60 |
| CloudFront | $8.50 |
| API Gateway | $0.50 |
| Lambda | $0.40 |
| DynamoDB | $2.50 |
| WAF | $7.00 |
| Route 53 | $0.50 |
| Secrets Manager | $1.20 |
| **Total** | **~$47.00/month** |
| **Revenue (200 paid @ $9, 20 premium @ $25)** | **$2,300/month** |
| **Margin** | **~98%** |

---

## Worst-Case Abuse Scenario

**What if someone scripts 100,000 uploads to a free event?**

Without protections:
- 100,000 x 5MB = 500GB storage = $11.50/month
- 100,000 PUT requests = $0.50
- Lambda invocations = $0.02
- **Total damage: ~$12/month**

With protections (upload cap = 150):
- Max 150 x 2MB = 300MB = $0.007/month
- **Damage contained to < $0.01**

This is why upload caps + file size limits are **P0 security.**

---

## Cost Optimization Checklist

- [x] HTTP API (not REST API) — 70% cheaper
- [x] Lambda ARM64 (Graviton2) — 20% cheaper
- [x] Lambda 128MB memory — minimum cost
- [x] DynamoDB on-demand — zero idle cost
- [x] S3 lifecycle rules — auto-transition to Glacier
- [x] TTL auto-deletion — free events cleaned up
- [x] Client-side compression — 70-85% storage reduction
- [x] CloudFront caching — reduce origin requests
- [x] No NAT Gateway — everything goes through public endpoints
- [x] No VPC for Lambdas — faster cold starts, no VPC costs
- [x] No RDS/Aurora — DynamoDB on-demand is much cheaper at low scale
- [x] No ECS/EC2 — fully serverless, zero idle
- [x] No Cognito — custom JWT, zero cost
- [x] Skip WAF at MVP — use Lambda-level rate limiting instead
- [x] Environment variables for secrets at MVP — upgrade to Secrets Manager later
