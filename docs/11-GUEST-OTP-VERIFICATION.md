# OTP Verification & Host Authentication

## Overview

Two distinct OTP flows:

1. **Guest OTP** (Paid/Premium) — Verifies guest identity before uploads. SMS-first with email fallback.
2. **Host OTP** (All tiers) — Email-only admin login. No password — host enters email, receives OTP, gets admin access.

**Free tier guests:** Password-only access, no OTP required.

---

## Channel Strategy (All AWS-Native)

Everything stays centralized in AWS. No third-party messaging providers.

| Flow | Primary Channel | Fallback | TTL |
|---|---|---|---|
| Guest OTP | AWS SNS SMS | Amazon SES Email | 5 minutes |
| Host OTP | Amazon SES Email | None (email only) | 10 minutes |

### Why SMS-First for Guests?
- Event guests are on-site, phone in hand
- SMS is immediate, no email app needed
- Guatemala market: phone-first culture
- Fallback to email if SMS fails or guest prefers it

### Why Email-Only for Hosts?
- Host already provided email at event creation
- Email is free ($0.0001 vs $0.034 for SMS to Guatemala)
- Host accesses admin from desktop (email readily available)
- Simpler, cheaper, more secure (no phone number management)

---

## Guest OTP Flow (Paid/Premium — Upload Verification)

### Sequence

```
Guest taps "Upload" → Phone number input (E.164, +502 default)
  │
  ▼
POST /events/{eventId}/otp/send
  body: {channel: "sms", destination: "+50212345678"}
  │
  ▼
Lambda:
  → Validate event tier is paid/premium
  → Check rate limit (3 sends per destination per 10 min)
  → Generate 6-digit code: crypto.randomInt(100000, 999999)
  → Store in DynamoDB: PK=EVENT#eventId, SK=OTP#destination, TTL=5min
  → Call SNS Publish (Transactional SMS)
  │
  ├── SNS SUCCESS:
  │   → Response: {sent: true, channel: "sms", expiresIn: 300}
  │
  └── SNS FAILURE (delivery error, invalid number):
      → Response: {sent: false, channel: "sms", fallback: true}
      → Frontend shows: "SMS failed. Enter your email or try SMS again"
      → Guest enters email → retry with channel: "email"
      → SES sends OTP email
  │
  ▼
Guest enters 6-digit code
  │
  ▼
POST /events/{eventId}/otp/verify
  body: {code: "483927", destination: "+50212345678"}
  │
  ▼
Lambda:
  → Get OTP record from DynamoDB
  → Check attempts < 5 (max)
  → Increment attempt counter (atomic)
  → crypto.timingSafeEqual(storedCode, submittedCode)
  → If valid: delete OTP record, issue new JWT with verified=true
  → Response: {token: "new-jwt", verified: true}
```

### Auth Flow by Tier

#### Free Tier (No OTP)
```
Scan QR → Enter guest password → Get JWT (verified: true) → Upload immediately
```

#### Paid/Premium Tier
```
Scan QR → Enter guest password → Get JWT (verified: false)
  → See gallery (read-only)
  → Tap "Upload" → prompted to verify
  → Enter phone (SMS-first) or email
  → Receive OTP
  → Enter OTP code → Get new JWT (verified: true)
  → Upload enabled for this session
```

---

## Host OTP Flow (Admin Login — Email ONLY)

### Sequence

```
Host navigates to /admin-login
  │
  ▼
Host enters email on login form (NO password field)
  │
  ▼
POST /auth/host/login
  body: {email: "carlos@email.com"}
  │
  ▼
Lambda:
  → Query GSI1 for HOST#carlos@email.com
  │
  ├── IF email found in DB:
  │   → Generate 6-digit OTP
  │   → Store in DynamoDB: PK=HOST_OTP#email, SK=OTP#email, TTL=10min
  │   → Send OTP via SES email ONLY (never SMS for hosts)
  │
  └── IF email NOT found:
      → Do NOT reveal this to frontend (prevents enumeration)
      → Still return 200 with identical response shape
      → Log the attempt for security monitoring (IP, email, timestamp)
  │
  ▼
Response ALWAYS (regardless of email existence):
  {message: "If an account exists, we sent a code", expiresIn: 600}
  │
  ▼
Host enters 6-digit code
  │
  ▼
POST /auth/host/verify
  body: {email: "carlos@email.com", code: "483927"}
  │
  ▼
Lambda:
  → Get OTP record: PK=HOST_OTP#email, SK=OTP#email
  → Check attempts < 5
  → crypto.timingSafeEqual(storedCode, submittedCode)
  → If valid:
    → Delete OTP record
    → Query GSI1 for all events by this host
    → Issue JWT: {role: "host", eventIds: [...], exp: 24h}
  → Response: {token: "jwt", role: "host", events: [...]}
```

### Why 10-Minute TTL for Hosts?
- Host is on desktop, may need time to switch to email client
- Less time pressure than on-site guest scenario
- 10 minutes is still secure enough (6-digit code = 1M possibilities)

---

## Lambda Implementation

### sendOtp Lambda

```javascript
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import crypto from 'crypto';

const dynamodb = new DynamoDBClient();
const sns = new SNSClient();
const ses = new SESv2Client();

export async function handler(event) {
  const { eventId } = event.pathParameters;
  const { channel, destination } = JSON.parse(event.body);

  // Validate JWT
  const session = verifyToken(event.headers.authorization);
  if (!session || session.eventId !== eventId) {
    return response(401, { error: { code: 'UNAUTHORIZED' } });
  }

  // Check event tier allows OTP
  const eventData = await getEvent(eventId);
  if (eventData.tier === 'free') {
    return response(403, {
      error: { code: 'OTP_NOT_AVAILABLE', message: 'OTP verification is only available for paid events.' }
    });
  }

  // Rate limit: max 3 OTP requests per destination per 10 minutes
  const rateLimitOk = await checkOtpRateLimit(eventId, destination);
  if (!rateLimitOk) {
    return response(429, {
      error: { code: 'OTP_RATE_LIMITED', message: 'Too many OTP requests. Wait a few minutes.' }
    });
  }

  // Generate 6-digit OTP (cryptographically random)
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const otpId = crypto.randomUUID();

  // Store OTP in DynamoDB with 5-minute TTL
  await dynamodb.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      PK: { S: `EVENT#${eventId}` },
      SK: { S: `OTP#${destination}` },
      otpCode: { S: otpCode },
      otpId: { S: otpId },
      channel: { S: channel },
      destination: { S: destination },
      attempts: { N: '0' },
      createdAt: { S: new Date().toISOString() },
      expiresAtTTL: { N: String(Math.floor(Date.now() / 1000) + 300) }
    }
  }));

  // Send OTP
  if (channel === 'sms') {
    try {
      await sendSmsOtp(destination, eventData.title, otpCode);
      return response(200, { sent: true, channel: 'sms', expiresIn: 300 });
    } catch (err) {
      console.error('SMS send failed:', err);
      return response(200, { sent: false, channel: 'sms', fallback: true });
    }
  } else {
    await sendEmailOtp(destination, eventData.title, otpCode);
    return response(200, { sent: true, channel: 'email', expiresIn: 300 });
  }
}

async function sendSmsOtp(phoneNumber, eventTitle, otpCode) {
  await sns.send(new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: `Tu código para ${eventTitle}: ${otpCode}. Válido por 5 minutos. - EventAlbum`,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional'
      },
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: 'EventAlbum'
      }
    }
  }));
}

async function sendEmailOtp(email, eventTitle, otpCode) {
  await ses.send(new SendEmailCommand({
    FromEmailAddress: process.env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Content: {
      Template: {
        TemplateName: 'OTPVerification',
        TemplateData: JSON.stringify({ otpCode, eventTitle, expiryMinutes: '5' })
      }
    },
    ConfigurationSetName: 'EventAlbum'
  }));
}
```

### verifyOtp Lambda

```javascript
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import crypto from 'crypto';

const dynamodb = new DynamoDBClient();

export async function handler(event) {
  const { eventId } = event.pathParameters;
  const { code, destination } = JSON.parse(event.body);

  const session = verifyToken(event.headers.authorization);

  // Get OTP record from DynamoDB
  const otpRecord = await dynamodb.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: { S: `EVENT#${eventId}` },
      SK: { S: `OTP#${destination}` }
    }
  }));

  if (!otpRecord.Item) {
    return response(400, {
      error: { code: 'OTP_EXPIRED', message: 'Code expired or not found. Request a new one.' }
    });
  }

  const attempts = parseInt(otpRecord.Item.attempts.N);

  // Max 5 attempts
  if (attempts >= 5) {
    await deleteOtpRecord(eventId, destination, 'EVENT');
    return response(429, {
      error: { code: 'OTP_MAX_ATTEMPTS', message: 'Too many attempts. Request a new code.' }
    });
  }

  // Increment attempt counter (atomic)
  await dynamodb.send(new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: { PK: { S: `EVENT#${eventId}` }, SK: { S: `OTP#${destination}` } },
    UpdateExpression: 'SET attempts = attempts + :one',
    ExpressionAttributeValues: { ':one': { N: '1' } }
  }));

  // Timing-safe comparison (prevents timing attacks)
  const storedCode = Buffer.from(otpRecord.Item.otpCode.S);
  const submittedCode = Buffer.from(code);

  if (storedCode.length !== submittedCode.length ||
      !crypto.timingSafeEqual(storedCode, submittedCode)) {
    return response(400, {
      error: { code: 'OTP_INVALID', message: 'Invalid code. Try again.' }
    });
  }

  // OTP valid — delete record (single use)
  await deleteOtpRecord(eventId, destination, 'EVENT');

  // Issue new JWT with verified=true
  const newToken = signToken({
    sub: session.sub,
    eventId: eventId,
    role: session.role,
    nickname: session.nickname,
    verified: true,
    verifiedVia: otpRecord.Item.channel.S,
    verifiedDestination: hashDestination(destination),
    exp: session.exp
  });

  return response(200, { token: newToken, verified: true });
}
```

### hostLogin Lambda

```javascript
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import crypto from 'crypto';

const dynamodb = new DynamoDBClient();
const ses = new SESv2Client();

export async function handler(event) {
  const { email } = JSON.parse(event.body);

  // Rate limit: 3 requests per email per 10 minutes
  const rateLimitOk = await checkHostOtpRateLimit(email);
  if (!rateLimitOk) {
    // Still return same response (anti-enumeration)
    return response(200, { message: 'If an account exists, we sent a code', expiresIn: 600 });
  }

  // Query GSI1 for events by this host email
  const result = await dynamodb.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `HOST#${email}` } }
  }));

  if (result.Items && result.Items.length > 0) {
    // Host exists — generate and send OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    await dynamodb.send(new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        PK: { S: `HOST_OTP#${email}` },
        SK: { S: `OTP#${email}` },
        otpCode: { S: otpCode },
        channel: { S: 'email' },
        destination: { S: email },
        attempts: { N: '0' },
        sendCount: { N: '1' },
        createdAt: { S: new Date().toISOString() },
        expiresAtTTL: { N: String(Math.floor(Date.now() / 1000) + 600) } // 10 min
      }
    }));

    // Send OTP via SES email
    await ses.send(new SendEmailCommand({
      FromEmailAddress: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [email] },
      Content: {
        Template: {
          TemplateName: 'OTPLoginCode',
          TemplateData: JSON.stringify({
            code: otpCode,
            expiryMinutes: '10',
            eventTitle: 'your EventAlbum dashboard'
          })
        }
      },
      ConfigurationSetName: 'EventAlbum'
    }));
  } else {
    // Host NOT found — do nothing, but log attempt
    console.log('Host login attempt for unknown email', {
      email: hashDestination(email),
      ip: event.requestContext?.http?.sourceIp,
      timestamp: new Date().toISOString()
    });
  }

  // ALWAYS return same response (anti-enumeration)
  return response(200, {
    message: 'If an account exists, we sent a code',
    expiresIn: 600
  });
}
```

### hostVerify Lambda

```javascript
import { DynamoDBClient, GetItemCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import crypto from 'crypto';

const dynamodb = new DynamoDBClient();

export async function handler(event) {
  const { email, code } = JSON.parse(event.body);

  // Get OTP record
  const otpRecord = await dynamodb.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: { S: `HOST_OTP#${email}` },
      SK: { S: `OTP#${email}` }
    }
  }));

  if (!otpRecord.Item) {
    return response(400, {
      error: { code: 'OTP_EXPIRED', message: 'Code expired or not found. Request a new one.' }
    });
  }

  const attempts = parseInt(otpRecord.Item.attempts.N);

  if (attempts >= 5) {
    await dynamodb.send(new DeleteItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: { PK: { S: `HOST_OTP#${email}` }, SK: { S: `OTP#${email}` } }
    }));
    return response(429, {
      error: { code: 'OTP_MAX_ATTEMPTS', message: 'Too many attempts. Request a new code.' }
    });
  }

  // Increment attempt counter
  await incrementAttempts(`HOST_OTP#${email}`, `OTP#${email}`);

  // Timing-safe comparison
  const storedCode = Buffer.from(otpRecord.Item.otpCode.S);
  const submittedCode = Buffer.from(code);

  if (storedCode.length !== submittedCode.length ||
      !crypto.timingSafeEqual(storedCode, submittedCode)) {
    return response(400, {
      error: { code: 'OTP_INVALID', message: 'Invalid code. Try again.' }
    });
  }

  // OTP valid — delete record
  await dynamodb.send(new DeleteItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: { PK: { S: `HOST_OTP#${email}` }, SK: { S: `OTP#${email}` } }
  }));

  // Get all events for this host
  const eventsResult = await dynamodb.send(new QueryCommand({
    TableName: process.env.TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `HOST#${email}` } },
    ProjectionExpression: 'eventId, title, #s',
    ExpressionAttributeNames: { '#s': 'status' }
  }));

  const events = eventsResult.Items.map(item => ({
    eventId: item.eventId.S,
    title: item.title.S,
    status: item.status.S
  }));

  // Issue JWT with role=host, 24h expiry
  const token = signToken({
    sub: `host_${email}`,
    email: email,
    role: 'host',
    eventIds: events.map(e => e.eventId),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  });

  return response(200, { token, role: 'host', events });
}
```

---

## DynamoDB Schema

### Guest OTP Record

| Attribute | Key | Value |
|---|---|---|
| `PK` | Key | `EVENT#evt_abc123` |
| `SK` | Key | `OTP#50212345678` or `OTP#user@email.com` |
| `otpCode` | | `483927` (6 digits) |
| `otpId` | | UUID |
| `channel` | | `sms` / `email` |
| `destination` | | phone (E.164) or email |
| `attempts` | | 0-5 (verify attempts) |
| `sendCount` | | 1-3 (send attempts) |
| `createdAt` | | ISO timestamp |
| `expiresAtTTL` | | Unix timestamp (5 min from creation) |

### Host OTP Record

| Attribute | Key | Value |
|---|---|---|
| `PK` | Key | `HOST_OTP#carlos@email.com` |
| `SK` | Key | `OTP#carlos@email.com` |
| `otpCode` | | `891234` (6 digits) |
| `channel` | | `email` (always) |
| `destination` | | email address |
| `attempts` | | 0-5 |
| `sendCount` | | 1-3 |
| `createdAt` | | ISO timestamp |
| `expiresAtTTL` | | Unix timestamp (10 min from creation) |

TTL auto-deletes expired records — no cleanup Lambda needed.

---

## JWT Token Lifecycle

### Guest: Before OTP (temporary token)
```json
{
  "sub": "session_abc",
  "eventId": "evt_abc123",
  "role": "guest",
  "nickname": "Guest_42",
  "verified": false,
  "exp": 1710572400
}
```

### Guest: After OTP (full token)
```json
{
  "sub": "session_abc",
  "eventId": "evt_abc123",
  "role": "guest",
  "nickname": "Guest_42",
  "verified": true,
  "verifiedVia": "sms",
  "verifiedDestination": "hashed_phone",
  "exp": 1710572400
}
```

### Host: After Login OTP
```json
{
  "sub": "host_carlos@email.com",
  "email": "carlos@email.com",
  "role": "host",
  "eventIds": ["evt_abc123", "evt_def456"],
  "exp": 1710658800
}
```

**Upload check:** For paid/premium events, `getUploadUrl` Lambda rejects requests where `verified !== true`.

---

## Abuse Protection

| Protection | Layer | Detail |
|---|---|---|
| Rate limit OTP sends | API Gateway | 50 requests/sec burst (global), per-function limits in Lambda |
| Rate limit OTP sends | DynamoDB | 3 per destination per 10 min (checked via `sendCount` + TTL) |
| Rate limit OTP verify | Lambda | 10 attempts per IP per 5 min (tracked in DynamoDB) |
| Max verify attempts | DynamoDB | 5 per code, then invalidate and force new code |
| SNS spend limit | AWS SNS | $50/month hard cap — SNS stops sending when reached |
| CAPTCHA after failures | Frontend | hCaptcha after 2 failed OTP sends (free tier) |
| Bot detection | Lambda | Check User-Agent, reject empty/suspicious patterns |
| No enumeration | Lambda | `/auth/host/login` returns identical response for valid/invalid emails |
| Timing-safe compare | Lambda | `crypto.timingSafeEqual` for OTP verification |
| IP hashing in logs | Lambda | Never log raw email/phone, only hashed values |
| Destination hashing | JWT | `verifiedDestination` stores hash, not raw phone/email |

---

## Frontend UX Flow

### Guest Entry (Paid/Premium Events)

```
1. Scan QR → Land on event page
2. Enter guest password → "Correct!"
3. See gallery (read-only)
4. Tap "Upload" button
5. Prompt: "Verify your identity to upload"
   → Phone number input (E.164, +502 default for Guatemala)
   → "Or verify via email" link below
6. Phone input with country code (+502 default) OR email input
7. "Send code" button → loading spinner
8. OTP input screen:
   → 6 individual digit boxes (auto-advance on input)
   → Timer: "Code expires in 4:32" countdown
   → "Didn't receive it? Resend" (disabled for 60 seconds)
   → "Back" link to re-enter phone/email
9. "Verify" → success animation
10. Upload now enabled for this session
```

### Host Admin Login

```
1. Navigate to /admin-login
2. See clean login card with email input only (no password!)
3. Enter email → "Send login code"
4. OTP screen:
   → "Check your email" heading
   → Masked email: c****s@email.com
   → 6-digit code input
   → Timer: "Code expires in 8:42"
   → "Resend code" link (60s cooldown)
   → "Back to login" link
5. Enter code → Verify
6. Redirect to admin dashboard
   → If host has multiple events, show event selector
   → If single event, go directly to dashboard
```

---

## Cost Analysis

### SMS Pricing (per OTP)

| Country | Code | Cost/SMS |
|---|---|---|
| Guatemala | +502 | ~$0.0338 |
| US | +1 | ~$0.013 |
| Mexico | +52 | ~$0.0291 |
| Colombia | +57 | ~$0.0262 |

**Free tier:** 100 SMS to US numbers/month (perpetual).

### Email Pricing (per OTP)

| Item | Cost |
|---|---|
| Per email | $0.0001 ($0.10/1,000) |
| Free tier | 3,000/month (first 12 months) |

### Cost Per Event Scenarios

| Guests | SMS (GT) | SES Email | Savings |
|---|---|---|---|
| 50 | $1.69 | $0.005 | $1.685 |
| 200 | $6.76 | $0.02 | $6.74 |
| 500 | $16.90 | $0.05 | $16.85 |

### Impact on Margins

| Tier | Revenue | OTP (200 guests SMS GT) | OTP (200 guests email) | Margin (SMS) | Margin (email) |
|---|---|---|---|---|---|
| Paid ($9) | $9.00 | $6.76 | $0.02 | ~19% | ~89% |
| Premium ($25) | $25.00 | $6.76 | $0.02 | ~53% | ~89% |

### Strategy
- Default UI shows phone number input (SMS-first for guest convenience)
- If SMS fails, auto-fallback to email
- Guest can manually choose "Verify via email" link
- Host login is ALWAYS email (free, reliable)
- Monitor SMS costs via CloudWatch alarm on `SMSMonthToDateSpentUSD`

---

## Security Considerations

1. **OTP brute-force:** Max 5 attempts per code, then invalidated
2. **OTP flood:** Max 3 sends per destination per 10 minutes
3. **Phone number privacy:** Store only hashed phone in JWT and session
4. **Single-use codes:** Deleted from DynamoDB immediately after successful verification
5. **Timing-safe comparison:** `crypto.timingSafeEqual` prevents timing attacks
6. **TTL expiry:** Guest 5 min, Host 10 min — auto-cleaned by DynamoDB
7. **No long-term storage:** Guest phone/email NOT stored beyond OTP verification
8. **Anti-enumeration:** Host login always returns same response shape
9. **Rate limiting:** Multiple layers (API Gateway, Lambda, DynamoDB)
10. **SNS spend limit:** $50/month cap prevents cost explosion from abuse

---

## IAM Policies

### sendOtp Lambda

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "*",
      "Condition": {
        "StringEquals": { "sns:Protocol": "sms" }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendTemplatedEmail"],
      "Resource": "arn:aws:ses:*:*:identity/eventalbum.app"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/EventAlbum*"
    }
  ]
}
```

### hostLogin Lambda

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendTemplatedEmail"],
      "Resource": "arn:aws:ses:*:*:identity/eventalbum.app"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:*:*:table/EventAlbum*/index/GSI1"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem", "dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/EventAlbum*"
    }
  ]
}
```

### hostVerify Lambda

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/EventAlbum*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:*:*:table/EventAlbum*/index/GSI1"
    }
  ]
}
```

---

## Cost at Idle

| Component | Monthly Cost |
|---|---|
| SNS (no SMS sent) | $0.00 |
| SES (no email sent) | $0.00 |
| DynamoDB (OTP records auto-expire) | $0.00 |
| Lambda (no invocations) | $0.00 |
| **Total** | **$0.00** |
