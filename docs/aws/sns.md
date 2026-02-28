# SNS Configuration (SMS)

## Purpose

Send OTP verification codes to guests via SMS (Paid/Premium events only). Free tier events do not include OTP verification.

---

## SMS Type

- **Transactional** (not Promotional)
- Transactional SMS has higher deliverability, higher cost, and bypasses opt-out lists
- Priority routing ensures OTP codes are delivered quickly

```bash
aws sns set-sms-attributes \
  --attributes '{
    "DefaultSMSType": "Transactional",
    "DefaultSenderID": "EventAlbum",
    "MonthlySpendLimit": "50",
    "UsageReportS3Bucket": "eventalbum-logs-prod",
    "DeliveryStatusSuccessSamplingRate": "100"
  }' \
  --profile codersatelier
```

---

## Sender ID

| Setting | Value | Notes |
|---|---|---|
| Sender ID | `EventAlbum` | Displayed as sender name where supported |
| Max length | 11 characters | Alphanumeric |

### Country Support

| Country | Sender ID Supported | What Recipient Sees |
|---|---|---|
| Guatemala (+502) | Yes | `EventAlbum` |
| Mexico (+52) | Yes | `EventAlbum` |
| Colombia (+57) | Yes | `EventAlbum` |
| US (+1) | No | Random short code or long code |
| Canada (+1) | No | Random long code |

For US/Canada, consider purchasing a dedicated origination number for consistent sender identity (see Origination Number section below).

---

## Sandbox Mode

**Default behavior:** SNS SMS starts in sandbox mode. You can only send to phone numbers that have been manually verified.

### Verify Test Numbers (Sandbox)

```bash
# Add a phone number to the sandbox (sends verification OTP)
aws sns create-sms-sandbox-phone-number \
  --phone-number "+50212345678" \
  --profile codersatelier

# Verify the phone number with the received code
aws sns verify-sms-sandbox-phone-number \
  --phone-number "+50212345678" \
  --one-time-password "123456" \
  --profile codersatelier

# List sandbox phone numbers
aws sns list-sms-sandbox-phone-numbers \
  --profile codersatelier

# Check sandbox status
aws sns get-sms-sandbox-account-status \
  --profile codersatelier
```

### Request Production Access

Must be done before launch to send SMS to any phone number:

```bash
# Via AWS Support Console:
# 1. Go to AWS Support -> Create case
# 2. Service: SNS
# 3. Category: SMS
# 4. Request type: Service limit increase
#
# Provide in the request:
#   - Company name: Coders Atelier
#   - Website: https://eventalbum.app
#   - Use case description:
#     "EventAlbum is a SaaS platform for private event photo sharing.
#      We send OTP verification codes to event guests to verify their
#      identity before they can upload photos. OTP codes are 6 digits,
#      expire in 5 minutes, and are sent only when a guest explicitly
#      requests verification. We do NOT send marketing or promotional
#      messages."
#   - Expected monthly SMS volume: 500-2,000 initially
#   - Target countries: Guatemala (+502), US (+1), Mexico (+52), Colombia (+57)
#   - Message type: Transactional (OTP codes only)
#   - Opt-in process: User-initiated (guest clicks "Verify" button in app)
```

**Typical approval time:** 1-3 business days.

---

## Spend Limit

```bash
# Set monthly spend limit (hard cap - SNS stops sending when reached)
aws sns set-sms-attributes \
  --attributes '{"MonthlySpendLimit": "50"}' \
  --profile codersatelier

# Check current spend
aws sns get-sms-attributes \
  --attributes MonthlySpendLimit \
  --profile codersatelier
```

| Environment | Spend Limit | Reason |
|---|---|---|
| dev | $5 | Testing only |
| staging | $10 | QA testing |
| prod | $50 (initial) | Scale with revenue |

**Important:** This is a hard cap. Once the monthly spend reaches the limit, ALL SMS from the account are blocked for the rest of the month. Set CloudWatch alarms to warn before hitting the limit.

### Scaling the Spend Limit

```bash
# Increase limit as revenue grows
aws sns set-sms-attributes \
  --attributes '{"MonthlySpendLimit": "200"}' \
  --profile codersatelier
```

---

## Pricing (Key Markets)

| Country | Country Code | Cost/SMS (Transactional) | Notes |
|---|---|---|---|
| Guatemala | +502 | ~$0.0338 | Primary market |
| US | +1 | ~$0.00645 + carrier fee (~$0.003) | ~$0.013 total |
| Mexico | +52 | ~$0.0291 | |
| Colombia | +57 | ~$0.0262 | |
| El Salvador | +503 | ~$0.0253 | |
| Honduras | +504 | ~$0.0338 | |
| Costa Rica | +506 | ~$0.0248 | |

**Free tier:** 100 SMS to US numbers/month (perpetual, not limited to 12 months).

### Cost Per OTP Verification

Each OTP flow sends 1 SMS. At Guatemala pricing ($0.0338/SMS):
- 100 verifications/month = ~$3.38
- 500 verifications/month = ~$16.90
- 2,000 verifications/month = ~$67.60

---

## Origination Number

### Initially: Not Purchasing

Use the shared SMS pool (no monthly cost). Messages come from random short/long codes in countries without Sender ID support (US/Canada).

### When to Purchase

Consider a dedicated origination number if:
- US deliverability drops below 80%
- Users report not receiving OTP codes
- Need consistent sender identity for trust

### Dedicated Number Options

| Type | Cost | Use Case |
|---|---|---|
| Long code (10DLC for US) | ~$1/month + registration | US A2P messaging |
| Short code | ~$1,000/month | High volume (not needed for us) |
| Toll-free | ~$2/month | US/Canada |

```bash
# Request a toll-free number for US (cheapest dedicated option)
# Done via AWS Pinpoint console or SNS console -> Origination numbers
# Registration required for 10DLC (takes 2-4 weeks for approval)
```

---

## Message Format

### Spanish (Default - Guatemala Market)

```
Tu codigo para {eventTitle}: {otpCode}. Valido por 5 min. - EventAlbum
```

### English

```
Your code for {eventTitle}: {otpCode}. Valid for 5 min. - EventAlbum
```

### Message Guidelines

| Rule | Value | Reason |
|---|---|---|
| Max length | 160 characters (1 SMS segment) | Avoid multi-segment charges |
| No links | Never include URLs | Reduces spam filtering, prevents phishing |
| No special chars | Avoid emojis, accented chars | GSM-7 encoding = 160 chars; Unicode = 70 chars |
| Include app name | Always end with `- EventAlbum` | Brand recognition |
| Include expiry | `Valido por 5 min` | User knows urgency |

**Important:** Using Unicode characters (accented letters like "codigo" with accent) reduces the SMS segment to 70 characters. Use ASCII equivalents (`codigo` not `c\u00f3digo`) to stay within 160 chars per segment.

---

## Lambda Integration

### Send OTP via SMS

```typescript
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({ region: 'us-east-1' });

export async function sendSmsOtp(phoneNumber: string, otpCode: string, eventTitle: string) {
  const message = `Tu codigo para ${eventTitle}: ${otpCode}. Valido por 5 min. - EventAlbum`;

  await sns.send(new PublishCommand({
    PhoneNumber: phoneNumber,  // E.164 format: +50212345678
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: 'EventAlbum',
      },
    },
  }));
}
```

### Phone Number Validation

```typescript
// Validate E.164 format before sending
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function validatePhoneNumber(phone: string): boolean {
  return E164_REGEX.test(phone);
}

// Normalize input (strip spaces, dashes, parentheses)
function normalizePhone(input: string): string {
  return input.replace(/[\s\-\(\)]/g, '');
}
```

---

## Rate Limiting (Application Level)

SNS does not have built-in per-user rate limiting. Implement in the `sendOtp` Lambda:

| Limit | Value | Key | Storage |
|---|---|---|---|
| Per phone number | 3 OTPs per 5 minutes | `OTP#{eventId}#{phone}` | DynamoDB with TTL |
| Per event | 50 OTPs per hour | Counter in DDB STATS | DynamoDB atomic counter |
| Per account | Controlled by MonthlySpendLimit | SNS attribute | AWS-managed |

```typescript
// Check rate limit before sending
const recentOtps = await ddb.send(new QueryCommand({
  TableName: TABLE_NAME,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': `OTP#${eventId}#${phoneNumber}`,
    ':sk': 'SENT#',
  },
  ScanIndexForward: false,
  Limit: 3,
}));

const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
const recentCount = recentOtps.Items?.filter(i => i.sentAt > fiveMinutesAgo).length ?? 0;

if (recentCount >= 3) {
  return { statusCode: 429, body: JSON.stringify({ error: 'TOO_MANY_OTPS' }) };
}
```

---

## CloudWatch Monitoring

### Metrics

| Metric | Namespace | Alarm Threshold | Action |
|---|---|---|---|
| `SMSMonthToDateSpentUSD` | `AWS/SNS` | > $40 (80% of limit) | SNS alarm to admin email |
| `NumberOfMessagesPublished` | `AWS/SNS` | > 100/hour | Investigate potential abuse |
| `SMSSuccessRate` | `AWS/SNS` | < 80% | Check carrier/number issues |
| `NumberOfNotificationsFailed` | `AWS/SNS` | > 10/hour | Delivery issues |

### CloudWatch Alarm Setup

```bash
# Alarm when SMS spend reaches 80% of monthly limit
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-SMS-SpendWarning" \
  --metric-name "SMSMonthToDateSpentUSD" \
  --namespace "AWS/SNS" \
  --statistic Maximum \
  --period 3600 \
  --threshold 40 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:us-east-1:<ACCOUNT_ID>:EventAlbum-AdminAlerts" \
  --profile codersatelier
```

### SMS Delivery Logs

```bash
# Enable delivery status logging
aws sns set-sms-attributes \
  --attributes '{
    "DeliveryStatusIAMRole": "arn:aws:iam::<ACCOUNT_ID>:role/SNSDeliveryStatusRole",
    "DeliveryStatusSuccessSamplingRate": "100"
  }' \
  --profile codersatelier
```

Delivery logs go to CloudWatch Logs group: `sns/us-east-1/<ACCOUNT_ID>/DirectPublishToPhoneNumber`

---

## IAM Policy (for sendOtp Lambda)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSMSPublish",
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "sns:Protocol": "sms"
        }
      }
    }
  ]
}
```

**Note:** SNS SMS `Publish` requires `Resource: "*"` — you cannot scope it to specific phone numbers or topics. The `Condition` restricts usage to SMS only (not SNS topics, email, etc.).

### SNS Delivery Status IAM Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:<ACCOUNT_ID>:log-group:sns/*"
    }
  ]
}
```

---

## Testing

### Sandbox Testing

```bash
# Send test SMS (sandbox - only verified numbers)
aws sns publish \
  --phone-number "+50212345678" \
  --message "Test OTP: 123456. Valido por 5 min. - EventAlbum" \
  --message-attributes '{
    "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
    "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "EventAlbum"}
  }' \
  --profile codersatelier
```

### Check SMS Delivery Status

```bash
# Check if SMS was delivered (via CloudWatch Logs)
aws logs filter-log-events \
  --log-group-name "sns/us-east-1/<ACCOUNT_ID>/DirectPublishToPhoneNumber" \
  --filter-pattern '"DELIVERED"' \
  --start-time $(date -d '1 hour ago' +%s000) \
  --profile codersatelier
```

---

## Cost Summary

| Resource | Idle Cost | Notes |
|---|---|---|
| SNS SMS (no messages) | $0.00/month | Pay per SMS only |
| Free tier (US only) | 100 SMS/month | Perpetual |
| Guatemala SMS | $0.0338/each | Primary market |
| Monthly spend cap | $50 (configurable) | Hard limit prevents surprise bills |
| **No messages sent** | **$0.00/month** | Near-zero idle cost |

## Security Checklist

- [x] Transactional SMS type (not promotional)
- [x] Monthly spend limit set ($50 initial)
- [x] CloudWatch alarm at 80% spend
- [x] Application-level rate limiting (3 per phone per 5 min)
- [x] Phone number validated (E.164 format) before sending
- [x] OTP codes are 6 digits, expire in 5 minutes
- [x] No links in SMS messages (anti-phishing)
- [x] ASCII only (no Unicode) to maximize characters per segment
- [x] IAM policy restricted to SMS protocol only
- [x] Delivery status logging enabled
- [x] Sandbox mode for development (no accidental sends)
