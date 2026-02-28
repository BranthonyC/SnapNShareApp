# WAF Configuration (Deferred)

## Status: DEFERRED

WAF is deferred until monthly revenue exceeds approximately $100/month. The minimum cost is $6/month (web ACL + 1 rule), which is disproportionate for a pre-revenue product targeting near-zero idle cost.

---

## Why Defer?

| Factor | Detail |
|---|---|
| Minimum cost | $5/month (web ACL) + $1/month per rule + $0.60 per million requests |
| Current monthly cost target | Near $0 at idle |
| Revenue threshold to enable | ~$100/month recurring |
| Risk without WAF | Low — API Gateway throttling + Lambda-level checks provide baseline protection |

---

## Current Protections (Pre-WAF)

These mitigations are active from Day 1 without WAF:

| Threat | Mitigation | Implementation |
|---|---|---|
| Brute force (event auth) | Rate limit: 10 attempts per 5 min per IP | Lambda middleware, DynamoDB counter with TTL |
| OTP abuse (SMS/email) | Rate limit: 3 sends per 10 min per destination | Lambda middleware, DynamoDB counter with TTL |
| Upload abuse | Presigned URL with Content-Length-Range header | S3 presigned URL conditions |
| DDoS (volumetric) | API Gateway burst limit: 100, sustained: 50/sec | API Gateway default throttling |
| DDoS (application) | CloudFront caching absorbs read traffic | CloudFront cache behaviors |
| SQL injection | Not applicable — DynamoDB is NoSQL | No SQL database |
| XSS | Input sanitization + CSP headers | Lambda response headers, React escaping |
| Large payloads | API Gateway max 10 MB payload | API Gateway configuration |
| Bot/scraping | hCaptcha on event creation + checkout | Frontend CAPTCHA (free tier) |
| Credential stuffing | No traditional passwords — event password + host magic link | Architecture design |
| CORS abuse | Strict CORS origin whitelist | API Gateway CORS configuration |

### Lambda Rate Limiting Implementation

```javascript
// src/shared/rateLimit.mjs
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient();
const TABLE = process.env.TABLE_NAME;

export async function checkRateLimit(key, maxAttempts, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  const result = await ddb.send(new UpdateItemCommand({
    TableName: TABLE,
    Key: {
      PK: { S: `RATE#${key}` },
      SK: { S: `WINDOW#${windowSeconds}` },
    },
    UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl, #windowStart = if_not_exists(#windowStart, :now)',
    ExpressionAttributeNames: {
      '#count': 'count',
      '#ttl': 'ttl',
      '#windowStart': 'windowStart',
    },
    ExpressionAttributeValues: {
      ':zero': { N: '0' },
      ':one': { N: '1' },
      ':ttl': { N: String(now + windowSeconds) },
      ':now': { N: String(now) },
    },
    ReturnValues: 'ALL_NEW',
  }));

  const count = parseInt(result.Attributes.count.N);
  const windowStartTime = parseInt(result.Attributes.windowStart.N);

  // Reset if window has expired
  if (windowStartTime < windowStart) {
    await ddb.send(new UpdateItemCommand({
      TableName: TABLE,
      Key: {
        PK: { S: `RATE#${key}` },
        SK: { S: `WINDOW#${windowSeconds}` },
      },
      UpdateExpression: 'SET #count = :one, #windowStart = :now, #ttl = :ttl',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#windowStart': 'windowStart',
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':one': { N: '1' },
        ':now': { N: String(now) },
        ':ttl': { N: String(now + windowSeconds) },
      },
    }));
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (count > maxAttempts) {
    return { allowed: false, remaining: 0, retryAfter: windowSeconds };
  }

  return { allowed: true, remaining: maxAttempts - count };
}
```

---

## Planned WAF Rules (When Activated)

### Web ACL: `EventAlbum-WAF`

- **Scope:** CLOUDFRONT (global, us-east-1)
- **Associated resources:** CloudFront frontend distribution, CloudFront media distribution, API Gateway (via CloudFront)

### Rules (Priority Order)

| Priority | Rule Name | Type | Action | Description |
|---|---|---|---|---|
| 1 | `AWS-AWSManagedRulesCommonRuleSet` | AWS Managed | Block | Core rule set: XSS, path traversal, bad bots, etc. |
| 2 | `AWS-AWSManagedRulesKnownBadInputsRuleSet` | AWS Managed | Block | Log4j, known exploit patterns |
| 3 | `AWS-AWSManagedRulesSQLiRuleSet` | AWS Managed | Block | SQL injection patterns (defense in depth) |
| 4 | `RateLimit-Global` | Rate-based | Block | > 2000 requests per 5 min per IP |
| 5 | `RateLimit-Auth` | Rate-based | Block | > 20 requests per 5 min per IP on `/auth/*` |
| 6 | `RateLimit-OTP` | Rate-based | Block | > 10 requests per 5 min per IP on `/otp/*` |
| 7 | `GeoBlock` | Custom | Block | Configurable country blocklist (optional) |
| 8 | `AWS-AWSManagedRulesBotControlRuleSet` | AWS Managed | Challenge | Bot detection with CAPTCHA challenge |

### Create Web ACL CLI

```bash
aws wafv2 create-web-acl \
  --name EventAlbum-WAF \
  --scope CLOUDFRONT \
  --region us-east-1 \
  --default-action '{"Allow":{}}' \
  --visibility-config '{"SampledRequestsEnabled":true,"CloudWatchMetricsEnabled":true,"MetricName":"EventAlbumWAF"}' \
  --rules file://waf-rules.json \
  --profile codersatelier
```

### WAF Rules JSON (waf-rules.json)

```json
[
  {
    "Name": "AWS-AWSManagedRulesCommonRuleSet",
    "Priority": 1,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesCommonRuleSet"
      }
    },
    "OverrideAction": { "None": {} },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "CommonRuleSet"
    }
  },
  {
    "Name": "AWS-AWSManagedRulesKnownBadInputsRuleSet",
    "Priority": 2,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesKnownBadInputsRuleSet"
      }
    },
    "OverrideAction": { "None": {} },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "KnownBadInputsRuleSet"
    }
  },
  {
    "Name": "AWS-AWSManagedRulesSQLiRuleSet",
    "Priority": 3,
    "Statement": {
      "ManagedRuleGroupStatement": {
        "VendorName": "AWS",
        "Name": "AWSManagedRulesSQLiRuleSet"
      }
    },
    "OverrideAction": { "None": {} },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "SQLiRuleSet"
    }
  },
  {
    "Name": "RateLimit-Global",
    "Priority": 4,
    "Statement": {
      "RateBasedStatement": {
        "Limit": 2000,
        "AggregateKeyType": "IP"
      }
    },
    "Action": { "Block": {} },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "RateLimitGlobal"
    }
  },
  {
    "Name": "RateLimit-Auth",
    "Priority": 5,
    "Statement": {
      "RateBasedStatement": {
        "Limit": 20,
        "AggregateKeyType": "IP",
        "ScopeDownStatement": {
          "ByteMatchStatement": {
            "FieldToMatch": { "UriPath": {} },
            "PositionalConstraint": "STARTS_WITH",
            "SearchString": "/auth",
            "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }]
          }
        }
      }
    },
    "Action": { "Block": {} },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "RateLimitAuth"
    }
  },
  {
    "Name": "RateLimit-OTP",
    "Priority": 6,
    "Statement": {
      "RateBasedStatement": {
        "Limit": 10,
        "AggregateKeyType": "IP",
        "ScopeDownStatement": {
          "ByteMatchStatement": {
            "FieldToMatch": { "UriPath": {} },
            "PositionalConstraint": "STARTS_WITH",
            "SearchString": "/otp",
            "TextTransformations": [{ "Priority": 0, "Type": "LOWERCASE" }]
          }
        }
      }
    },
    "Action": { "Block": {} },
    "VisibilityConfig": {
      "SampledRequestsEnabled": true,
      "CloudWatchMetricsEnabled": true,
      "MetricName": "RateLimitOTP"
    }
  }
]
```

### Associate with CloudFront

```bash
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:us-east-1:<account-id>:global/webacl/EventAlbum-WAF/<web-acl-id> \
  --resource-arn arn:aws:cloudfront::<account-id>:distribution/<distribution-id> \
  --profile codersatelier
```

---

## Cost Breakdown (When Active)

| Component | Unit Cost | Quantity | Monthly Cost |
|---|---|---|---|
| Web ACL | $5.00/month | 1 | $5.00 |
| Rules (managed, 3) | $1.00/rule/month | 3 | $3.00 |
| Rules (rate-based, 3) | $1.00/rule/month | 3 | $3.00 |
| Rules (geo-block, 1) | $1.00/rule/month | 1 | $1.00 |
| Bot Control rule group | $10.00/month | 1 | $10.00 |
| Request inspection | $0.60/million | ~0.5M | $0.30 |
| Bot Control requests | $1.00/million | ~0.5M | $0.50 |
| **Total (all rules)** | | | **~$22.80** |
| **Total (managed rules only, no bot control)** | | | **~$12.30** |
| **Total (minimum: ACL + 1 managed)** | | | **~$6.60** |

---

## Phased Activation Plan

### Phase 1: Revenue reaches ~$100/month

Enable basic managed rules only:

| Component | Cost |
|---|---|
| Web ACL | $5.00 |
| AWSManagedRulesCommonRuleSet | $1.00 |
| AWSManagedRulesKnownBadInputsRuleSet | $1.00 |
| AWSManagedRulesSQLiRuleSet | $1.00 |
| **Total** | **$8.00/month** |

### Phase 2: Revenue reaches ~$300/month

Add rate-based rules:

| Component | Additional Cost |
|---|---|
| RateLimit-Global | $1.00 |
| RateLimit-Auth | $1.00 |
| RateLimit-OTP | $1.00 |
| **Added** | **$3.00/month** |
| **Running total** | **$11.00/month** |

### Phase 3: Revenue reaches ~$500/month

Add bot control:

| Component | Additional Cost |
|---|---|
| AWSManagedRulesBotControlRuleSet | $10.00 |
| Bot Control request inspection | ~$0.50 |
| **Added** | **~$10.50/month** |
| **Running total** | **~$21.50/month** |

---

## SAM Template (For Future Activation)

```yaml
Parameters:
  EnableWAF:
    Type: String
    Default: "false"
    AllowedValues: ["true", "false"]

Conditions:
  WAFEnabled: !Equals [!Ref EnableWAF, "true"]

Resources:
  WebACL:
    Type: AWS::WAFv2::WebACL
    Condition: WAFEnabled
    Properties:
      Name: !Sub "EventAlbum-${Environment}-WAF"
      Scope: CLOUDFRONT
      DefaultAction:
        Allow: {}
      VisibilityConfig:
        SampledRequestsEnabled: true
        CloudWatchMetricsEnabled: true
        MetricName: !Sub "EventAlbum${Environment}WAF"
      Rules:
        - Name: AWSManagedRulesCommonRuleSet
          Priority: 1
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesCommonRuleSet
          OverrideAction:
            None: {}
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: CommonRuleSet
        - Name: AWSManagedRulesKnownBadInputsRuleSet
          Priority: 2
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesKnownBadInputsRuleSet
          OverrideAction:
            None: {}
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: KnownBadInputsRuleSet
        - Name: RateLimitGlobal
          Priority: 4
          Statement:
            RateBasedStatement:
              Limit: 2000
              AggregateKeyType: IP
          Action:
            Block: {}
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: RateLimitGlobal

  WebACLAssociation:
    Type: AWS::WAFv2::WebACLAssociation
    Condition: WAFEnabled
    Properties:
      WebACLArn: !GetAtt WebACL.Arn
      ResourceArn: !Sub "arn:aws:cloudfront::${AWS::AccountId}:distribution/${FrontendDistribution}"
```

Enable WAF by deploying with:

```bash
sam deploy --parameter-overrides EnableWAF=true \
  --profile codersatelier
```

---

## Monitoring WAF (When Active)

### View Sampled Requests

```bash
aws wafv2 get-sampled-requests \
  --web-acl-arn arn:aws:wafv2:us-east-1:<account-id>:global/webacl/EventAlbum-WAF/<id> \
  --rule-metric-name RateLimitGlobal \
  --scope CLOUDFRONT \
  --time-window '{"StartTime":"2026-03-15T00:00:00Z","EndTime":"2026-03-15T23:59:59Z"}' \
  --max-items 100 \
  --profile codersatelier
```

### CloudWatch Metrics (Auto-Generated)

| Metric | Description |
|---|---|
| `AllowedRequests` | Requests that passed all rules |
| `BlockedRequests` | Requests blocked by any rule |
| `CountedRequests` | Requests matched in Count mode |
| `PassedRequests` | Requests that passed a specific rule |

### Alarm for High Block Rate

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-WAF-HighBlockRate" \
  --namespace "AWS/WAFV2" \
  --metric-name "BlockedRequests" \
  --dimensions Name=WebACL,Value=EventAlbum-WAF Name=Region,Value=us-east-1 Name=Rule,Value=ALL \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier
```

---

## Cost at Idle (Current)

**$0.00/month** — WAF is not deployed. All current protections are built into Lambda-level rate limiting and API Gateway throttling at zero additional cost.
