# SES Configuration (Email)

## Purpose

1. **OTP codes** — Send email-based OTP verification to guests (email fallback when SMS is unavailable or for email-only verification) and hosts (email-only login flow)
2. **Transactional emails** — Event created confirmation, purchase receipts, upload notifications, moderation alerts, post-event summary

---

## Domain Verification

### Step 1: Verify Domain Identity

```bash
aws ses verify-domain-identity \
  --domain eventalbum.app \
  --region us-east-1 \
  --profile codersatelier
```

This returns a TXT record value. Add it to Route 53.

### Step 2: DKIM Setup

```bash
aws ses verify-domain-dkim \
  --domain eventalbum.app \
  --region us-east-1 \
  --profile codersatelier
```

Returns 3 DKIM token strings. Create 3 CNAME records in Route 53.

### Step 3: SES v2 Domain Identity (Recommended)

```bash
# SES v2 handles both domain verification and DKIM in one call
aws sesv2 create-email-identity \
  --email-identity eventalbum.app \
  --dkim-signing-attributes '{"DomainSigningSelector":"eventalbum","DomainSigningPrivateKey":"..."}' \
  --region us-east-1 \
  --profile codersatelier

# Or let SES manage DKIM keys (Easy DKIM - recommended)
aws sesv2 create-email-identity \
  --email-identity eventalbum.app \
  --region us-east-1 \
  --profile codersatelier
```

### DNS Records Required

| Type | Name | Value | Purpose |
|---|---|---|---|
| TXT | `_amazonses.eventalbum.app` | *(provided by SES)* | Domain verification |
| CNAME | `{token1}._domainkey.eventalbum.app` | `{token1}.dkim.amazonses.com` | DKIM signature (1 of 3) |
| CNAME | `{token2}._domainkey.eventalbum.app` | `{token2}.dkim.amazonses.com` | DKIM signature (2 of 3) |
| CNAME | `{token3}._domainkey.eventalbum.app` | `{token3}.dkim.amazonses.com` | DKIM signature (3 of 3) |
| TXT | `eventalbum.app` | `v=spf1 include:amazonses.com ~all` | SPF authorization |
| TXT | `_dmarc.eventalbum.app` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@eventalbum.app; pct=100` | DMARC policy |
| MX | `mail.eventalbum.app` | `10 feedback-smtp.us-east-1.amazonses.com` | Bounce handling (MAIL FROM) |
| TXT | `mail.eventalbum.app` | `v=spf1 include:amazonses.com ~all` | SPF for MAIL FROM domain |

### Route 53 CLI (Add DNS Records)

```bash
# Add SPF record
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "eventalbum.app",
        "Type": "TXT",
        "TTL": 3600,
        "ResourceRecords": [{"Value": "\"v=spf1 include:amazonses.com ~all\""}]
      }
    }]
  }' \
  --profile codersatelier

# Add DMARC record
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_dmarc.eventalbum.app",
        "Type": "TXT",
        "TTL": 3600,
        "ResourceRecords": [{"Value": "\"v=DMARC1; p=quarantine; rua=mailto:dmarc@eventalbum.app; pct=100\""}]
      }
    }]
  }' \
  --profile codersatelier
```

---

## MAIL FROM Domain

Custom MAIL FROM domain improves deliverability and passes strict SPF/DMARC checks.

```bash
aws sesv2 put-email-identity-mail-from-attributes \
  --email-identity eventalbum.app \
  --mail-from-domain mail.eventalbum.app \
  --behavior-on-mx-failure USE_DEFAULT_VALUE \
  --region us-east-1 \
  --profile codersatelier
```

Without MAIL FROM: emails show `via amazonses.com` in some clients.
With MAIL FROM: clean `From: noreply@eventalbum.app` header.

---

## Sandbox Mode

**Default:** SES starts in sandbox mode. You can only send to verified email addresses.

### Verify Test Email Addresses (Sandbox)

```bash
# Verify individual email addresses for testing
aws sesv2 create-email-identity \
  --email-identity test@example.com \
  --region us-east-1 \
  --profile codersatelier

# List verified identities
aws sesv2 list-email-identities \
  --region us-east-1 \
  --profile codersatelier
```

### Request Production Access

```bash
# Via AWS Console -> SES -> Account dashboard -> Request production access
# Or via AWS Support case
#
# Provide:
#   Website URL: https://eventalbum.app
#   Use case type: Transactional
#   Use case description:
#     "EventAlbum is a SaaS platform for private event photo sharing.
#      We send the following transactional emails:
#      1. OTP verification codes for guest and host authentication
#      2. Event creation confirmation with QR code details
#      3. Purchase receipts for paid/premium tier events
#      4. Upload notifications (batched every 30 minutes) to event hosts
#      5. Content moderation alerts when uploads are flagged
#      6. Post-event summary with statistics and download link
#
#      We do NOT send marketing, promotional, or bulk emails.
#      All emails are triggered by explicit user actions."
#
#   Expected volume: 1,000-5,000 emails/month initially
#   How you handle bounces: SNS notification -> Lambda suppression handler
#   How you handle complaints: Automatic account-level suppression list
#   Will you send to acquired lists: No
```

**Typical approval time:** 24-48 hours.

---

## From Addresses

| Address | Purpose | Used By |
|---|---|---|
| `noreply@eventalbum.app` | OTP codes, upload notifications, event summary | sendOtp, sendUploadNotifications, sendEventSummary |
| `receipts@eventalbum.app` | Purchase receipts | handleWebhook |
| `alerts@eventalbum.app` | Moderation alerts to host | processUpload (moderation) |

All addresses use the verified `eventalbum.app` domain -- no individual email verification needed.

---

## Configuration Set

```bash
aws sesv2 create-configuration-set \
  --configuration-set-name EventAlbum \
  --delivery-options '{"SendingPoolName":"ses-default-pool"}' \
  --reputation-options '{"ReputationMetricsEnabled":true,"LastFreshStart":"2026-01-01T00:00:00Z"}' \
  --sending-options '{"SendingEnabled":true}' \
  --suppression-options '{"SuppressedReasons":["BOUNCE","COMPLAINT"]}' \
  --region us-east-1 \
  --profile codersatelier
```

### Event Destinations (Bounce/Complaint Handling)

```bash
# Create SNS topic for bounce/complaint notifications
aws sns create-topic \
  --name EventAlbum-SES-Notifications \
  --profile codersatelier

# Add event destination to configuration set
aws sesv2 create-configuration-set-event-destination \
  --configuration-set-name EventAlbum \
  --event-destination-name BounceComplaintHandler \
  --event-destination '{
    "Enabled": true,
    "MatchingEventTypes": ["BOUNCE","COMPLAINT","REJECT"],
    "SnsDestination": {
      "TopicArn": "arn:aws:sns:us-east-1:<ACCOUNT_ID>:EventAlbum-SES-Notifications"
    }
  }' \
  --region us-east-1 \
  --profile codersatelier
```

---

## Email Templates (SES v2)

### 1. OTPLoginCode

```bash
aws sesv2 create-email-template \
  --template-name OTPLoginCode \
  --template-content '{
    "Subject": "Tu codigo de acceso: {{code}}",
    "Html": "<html><body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;\"><div style=\"background:#6366f1;padding:20px;text-align:center;\"><h1 style=\"color:white;margin:0;\">EventAlbum</h1></div><div style=\"padding:30px;background:#ffffff;\"><h2 style=\"color:#1f2937;\">Tu codigo de verificacion</h2><p style=\"color:#4b5563;font-size:16px;\">Usa este codigo para acceder a <strong>{{eventTitle}}</strong>:</p><div style=\"background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:20px 0;\"><span style=\"font-size:32px;font-weight:bold;letter-spacing:8px;color:#6366f1;\">{{code}}</span></div><p style=\"color:#9ca3af;font-size:14px;\">Este codigo es valido por {{expiryMinutes}} minutos. No lo compartas con nadie.</p></div><div style=\"padding:20px;text-align:center;color:#9ca3af;font-size:12px;\"><p>EventAlbum - Comparte los mejores momentos</p></div></body></html>",
    "Text": "Tu codigo para {{eventTitle}}: {{code}}. Valido por {{expiryMinutes}} minutos. No lo compartas con nadie. - EventAlbum"
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `code`, `eventTitle`, `expiryMinutes`

### 2. HostOTPLogin

```bash
aws sesv2 create-email-template \
  --template-name HostOTPLogin \
  --template-content '{
    "Subject": "Tu codigo de acceso a EventAlbum: {{code}}",
    "Html": "<html><body style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;\"><div style=\"background:#6366f1;padding:20px;text-align:center;\"><h1 style=\"color:white;margin:0;\">EventAlbum</h1></div><div style=\"padding:30px;background:#ffffff;\"><h2 style=\"color:#1f2937;\">Inicio de sesion</h2><p style=\"color:#4b5563;font-size:16px;\">Ingresa este codigo para acceder a tu panel de administracion:</p><div style=\"background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:20px 0;\"><span style=\"font-size:32px;font-weight:bold;letter-spacing:8px;color:#6366f1;\">{{code}}</span></div><p style=\"color:#9ca3af;font-size:14px;\">Valido por 10 minutos. Si no solicitaste este codigo, ignora este correo.</p></div></body></html>",
    "Text": "Tu codigo de acceso a EventAlbum: {{code}}. Valido por 10 minutos. Si no solicitaste este codigo, ignora este correo."
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `code`

### 3. EventCreated

```bash
aws sesv2 create-email-template \
  --template-name EventCreated \
  --template-content '{
    "Subject": "Tu evento {{eventTitle}} esta listo",
    "Html": "...",
    "Text": "Tu evento {{eventTitle}} esta listo. Fecha: {{eventDate}}. Comparte el QR con tus invitados: {{qrUrl}}. Contrasena para invitados: {{guestPassword}}. Administra tu evento: {{adminUrl}} - EventAlbum"
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `eventTitle`, `eventDate`, `qrUrl`, `guestPassword`, `adminUrl`
**Sent when:** Event created (free tier) or payment succeeded (paid/premium tier)

### 4. PurchaseReceipt

```bash
aws sesv2 create-email-template \
  --template-name PurchaseReceipt \
  --template-content '{
    "Subject": "Recibo de pago - {{eventTitle}} ({{tier}})",
    "Html": "...",
    "Text": "Recibo de pago para {{eventTitle}}. Plan: {{tier}}. Monto: {{currency}} {{amount}}. Metodo: {{paymentMethod}}. Fecha: {{date}}. Gracias por tu compra. - EventAlbum"
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `eventTitle`, `tier`, `amount`, `currency`, `paymentMethod`, `date`
**Sent when:** Recurrente webhook `payment_intent.succeeded` processed

### 5. GuestUploadNotification

```bash
aws sesv2 create-email-template \
  --template-name GuestUploadNotification \
  --template-content '{
    "Subject": "{{newPhotoCount}} nuevas fotos en {{eventTitle}}",
    "Html": "...",
    "Text": "Tienes {{newPhotoCount}} nuevas fotos en {{eventTitle}} ({{totalCount}} en total). Ve la galeria: {{galleryUrl}} - EventAlbum"
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `eventTitle`, `newPhotoCount`, `totalCount`, `thumbnailUrls` (array), `galleryUrl`
**Sent when:** EventBridge schedule every 30 minutes, batched if new uploads exist
**Note:** Only sent to event hosts who have email notifications enabled

### 6. ModerationAlert

```bash
aws sesv2 create-email-template \
  --template-name ModerationAlert \
  --template-content '{
    "Subject": "Contenido reportado en {{eventTitle}}",
    "Html": "...",
    "Text": "Se detecto contenido potencialmente inapropiado en {{eventTitle}}. Categorias: {{moderationLabels}}. Revisa y toma accion: {{reviewUrl}} - EventAlbum"
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `eventTitle`, `mediaId`, `moderationLabels`, `reviewUrl`
**Sent when:** AWS Rekognition flags content with confidence >= 60% (Premium tier only)

### 7. EventSummary

```bash
aws sesv2 create-email-template \
  --template-name EventSummary \
  --template-content '{
    "Subject": "Resumen de {{eventTitle}}",
    "Html": "...",
    "Text": "Resumen de {{eventTitle}}: {{totalUploads}} fotos, {{totalGuests}} invitados, {{totalReactions}} reacciones. Descarga todas las fotos: {{downloadZipUrl}}. Ver galeria: {{galleryUrl}} - EventAlbum"
  }' \
  --region us-east-1 \
  --profile codersatelier
```

**Variables:** `eventTitle`, `totalUploads`, `totalGuests`, `totalReactions`, `downloadZipUrl`, `galleryUrl`
**Sent when:** EventBridge daily check, 1 day after event `endDate`

### List Templates

```bash
aws sesv2 list-email-templates \
  --region us-east-1 \
  --profile codersatelier
```

### Test a Template

```bash
aws sesv2 send-email \
  --from-email-address noreply@eventalbum.app \
  --destination '{"ToAddresses":["test@example.com"]}' \
  --content '{
    "Template": {
      "TemplateName": "OTPLoginCode",
      "TemplateData": "{\"code\":\"123456\",\"eventTitle\":\"Boda de Ana y Carlos\",\"expiryMinutes\":\"5\"}"
    }
  }' \
  --configuration-set-name EventAlbum \
  --region us-east-1 \
  --profile codersatelier
```

---

## Lambda Integration

### Send Templated Email

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({ region: 'us-east-1' });

export async function sendTemplatedEmail(params: {
  to: string;
  template: string;
  templateData: Record<string, string>;
  from?: string;
}) {
  const { to, template, templateData, from = process.env.SES_FROM_EMAIL } = params;

  await ses.send(new SendEmailCommand({
    FromEmailAddress: from,
    Destination: {
      ToAddresses: [to],
    },
    Content: {
      Template: {
        TemplateName: template,
        TemplateData: JSON.stringify(templateData),
      },
    },
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
  }));
}

// Usage examples:

// Send OTP email
await sendTemplatedEmail({
  to: 'guest@example.com',
  template: 'OTPLoginCode',
  templateData: {
    code: '847293',
    eventTitle: 'Boda de Ana y Carlos',
    expiryMinutes: '5',
  },
});

// Send purchase receipt
await sendTemplatedEmail({
  to: 'host@example.com',
  template: 'PurchaseReceipt',
  from: 'receipts@eventalbum.app',
  templateData: {
    eventTitle: 'Boda de Ana y Carlos',
    tier: 'Premium',
    amount: '299.00',
    currency: 'GTQ',
    paymentMethod: 'Visa ****4242',
    date: '2026-02-28',
  },
});
```

### Send Raw Email (Fallback)

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({ region: 'us-east-1' });

await ses.send(new SendEmailCommand({
  FromEmailAddress: 'noreply@eventalbum.app',
  Destination: {
    ToAddresses: ['user@example.com'],
  },
  Content: {
    Simple: {
      Subject: {
        Data: 'Tu codigo: 123456',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: 'Tu codigo de verificacion es: 123456. Valido por 5 minutos.',
          Charset: 'UTF-8',
        },
        Html: {
          Data: '<html>...</html>',
          Charset: 'UTF-8',
        },
      },
    },
  },
  ConfigurationSetName: 'EventAlbum',
}));
```

---

## Bounce and Complaint Handling

### Account-Level Suppression List

```bash
# Enable account-level suppression list (automatic)
aws sesv2 put-account-suppression-attributes \
  --suppressed-reasons BOUNCE COMPLAINT \
  --region us-east-1 \
  --profile codersatelier
```

SES automatically adds addresses that bounce or complain to the suppression list. Future sends to those addresses are silently dropped.

### SNS-Based Processing (For Custom Logic)

```bash
# Create SNS topic for SES notifications
aws sns create-topic \
  --name EventAlbum-SES-Bounces \
  --profile codersatelier

aws sns create-topic \
  --name EventAlbum-SES-Complaints \
  --profile codersatelier

# Subscribe Lambda to process bounces
aws sns subscribe \
  --topic-arn "arn:aws:sns:us-east-1:<ACCOUNT_ID>:EventAlbum-SES-Bounces" \
  --protocol lambda \
  --notification-endpoint "arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:EventAlbum-processBounce-prod" \
  --profile codersatelier
```

### Bounce Processing Lambda

```typescript
export async function handler(event: SNSEvent) {
  for (const record of event.Records) {
    const notification = JSON.parse(record.Sns.Message);

    if (notification.notificationType === 'Bounce') {
      const bounce = notification.bounce;
      for (const recipient of bounce.bouncedRecipients) {
        // Log and optionally update application state
        log.warn('Email bounced', {
          email: recipient.emailAddress,
          bounceType: bounce.bounceType,       // Permanent or Transient
          bounceSubType: bounce.bounceSubType, // General, NoEmail, Suppressed, etc.
        });

        if (bounce.bounceType === 'Permanent') {
          // Mark email as invalid in our database
          await markEmailInvalid(recipient.emailAddress);
        }
      }
    }

    if (notification.notificationType === 'Complaint') {
      const complaint = notification.complaint;
      for (const recipient of complaint.complainedRecipients) {
        log.warn('Email complaint', { email: recipient.emailAddress });
        // SES suppression list handles this automatically
      }
    }
  }
}
```

---

## Sending Limits

### Sandbox Limits

| Limit | Value |
|---|---|
| Max sends/day | 200 |
| Max sends/second | 1 |
| Recipients | Verified emails only |

### Production Limits (After Approval)

| Limit | Initial Value | Can Increase |
|---|---|---|
| Max sends/day | 50,000 | Yes, via support request |
| Max sends/second | 14 | Yes, automatically based on reputation |

```bash
# Check current sending limits
aws sesv2 get-account \
  --region us-east-1 \
  --profile codersatelier
```

---

## Email Validation

```typescript
// Validate email format before sending
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

// Check suppression list before sending (optional, SES handles this)
async function isEmailSuppressed(email: string): Promise<boolean> {
  try {
    await ses.send(new GetSuppressedDestinationCommand({
      EmailAddress: email,
    }));
    return true;  // Email is on suppression list
  } catch (error) {
    return false;  // Email is not suppressed
  }
}
```

---

## Rate Limiting (Application Level)

| Limit | Value | Key | Purpose |
|---|---|---|---|
| OTP emails per address | 3 per 5 minutes | `OTP#{eventId}#{email}` | Prevent abuse |
| Notification emails per host | 1 per 30 minutes | EventBridge schedule | Batching |
| Receipt emails | 1 per payment | Payment webhook dedup | Prevent duplicates |

---

## IAM Policy (For Lambda Functions)

### sendOtp / sendUploadNotifications / sendEventSummary

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSendTemplatedEmail",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendTemplatedEmail"
      ],
      "Resource": [
        "arn:aws:ses:us-east-1:<ACCOUNT_ID>:identity/eventalbum.app",
        "arn:aws:ses:us-east-1:<ACCOUNT_ID>:configuration-set/EventAlbum"
      ],
      "Condition": {
        "StringEquals": {
          "ses:FromAddress": [
            "noreply@eventalbum.app",
            "receipts@eventalbum.app",
            "alerts@eventalbum.app"
          ]
        }
      }
    },
    {
      "Sid": "AllowGetTemplate",
      "Effect": "Allow",
      "Action": [
        "ses:GetEmailTemplate"
      ],
      "Resource": "arn:aws:ses:us-east-1:<ACCOUNT_ID>:template/*"
    }
  ]
}
```

---

## Monitoring

### CloudWatch Metrics

| Metric | Alarm Threshold | Action |
|---|---|---|
| `Send` | Baseline + 50% | Unusual sending volume |
| `Bounce` | > 5% of sends | Investigate email list quality |
| `Complaint` | > 0.1% of sends | Immediately investigate |
| `Reject` | > 0 | SES rejected the email (content/policy issue) |
| `Delivery` | < 95% | Deliverability problem |

### Reputation Dashboard

```bash
# Check sending statistics
aws sesv2 get-account \
  --region us-east-1 \
  --profile codersatelier

# Get detailed sending stats
aws ses get-send-statistics \
  --region us-east-1 \
  --profile codersatelier
```

### CloudWatch Alarms

```bash
# Alarm on bounce rate > 5%
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-SES-HighBounceRate" \
  --metric-name "Bounce" \
  --namespace "AWS/SES" \
  --statistic Sum \
  --period 3600 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:us-east-1:<ACCOUNT_ID>:EventAlbum-AdminAlerts" \
  --profile codersatelier

# Alarm on complaint rate > 0.1%
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-SES-Complaints" \
  --metric-name "Complaint" \
  --namespace "AWS/SES" \
  --statistic Sum \
  --period 3600 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:us-east-1:<ACCOUNT_ID>:EventAlbum-AdminAlerts" \
  --profile codersatelier
```

**Critical:** AWS will suspend your SES sending if bounce rate exceeds 10% or complaint rate exceeds 0.5%. Monitor these metrics closely.

---

## Pricing

| Item | Cost | Notes |
|---|---|---|
| Per email sent | $0.10/1,000 ($0.0001 each) | |
| Attachments | $0.12/GB | We don't send attachments |
| Free tier | 3,000 emails/month | First 12 months, if sending from EC2/Lambda |
| Dedicated IP | $24.95/month | Not needed (shared pool is fine for our volume) |

### Cost Estimates

| Volume | Monthly Cost | Notes |
|---|---|---|
| 1,000 emails/month | $0.10 | Early stage |
| 5,000 emails/month | $0.50 | Growing |
| 10,000 emails/month | $1.00 | Healthy traction |
| 50,000 emails/month | $5.00 | Consider dedicated IP |

---

## Testing

### Send Test Email (Sandbox)

```bash
aws sesv2 send-email \
  --from-email-address noreply@eventalbum.app \
  --destination '{"ToAddresses":["your-verified@email.com"]}' \
  --content '{
    "Simple": {
      "Subject": {"Data": "Test from EventAlbum"},
      "Body": {
        "Text": {"Data": "This is a test email from EventAlbum SES configuration."},
        "Html": {"Data": "<h1>Test</h1><p>This is a test email from EventAlbum.</p>"}
      }
    }
  }' \
  --configuration-set-name EventAlbum \
  --region us-east-1 \
  --profile codersatelier
```

### SES Mailbox Simulator (No Sandbox Restriction)

Use these addresses to test without needing verified recipients:

| Address | Behavior |
|---|---|
| `success@simulator.amazonses.com` | Successful delivery |
| `bounce@simulator.amazonses.com` | Hard bounce |
| `complaint@simulator.amazonses.com` | Complaint |
| `suppressionlist@simulator.amazonses.com` | Suppression list |
| `ooto@simulator.amazonses.com` | Out of office auto-reply |

```bash
aws sesv2 send-email \
  --from-email-address noreply@eventalbum.app \
  --destination '{"ToAddresses":["success@simulator.amazonses.com"]}' \
  --content '{
    "Template": {
      "TemplateName": "OTPLoginCode",
      "TemplateData": "{\"code\":\"123456\",\"eventTitle\":\"Test Event\",\"expiryMinutes\":\"5\"}"
    }
  }' \
  --configuration-set-name EventAlbum \
  --region us-east-1 \
  --profile codersatelier
```

---

## Cost Summary

| Resource | Idle Cost | Notes |
|---|---|---|
| SES (no emails sent) | $0.00/month | Pay per email only |
| Free tier | 3,000 emails/month | First 12 months |
| After free tier | $0.10/1,000 emails | Extremely cheap |
| **No emails sent** | **$0.00/month** | Near-zero idle cost |

## Security Checklist

- [x] Domain verified with DKIM (3 CNAME records)
- [x] SPF record configured (`include:amazonses.com`)
- [x] DMARC policy set (`p=quarantine`)
- [x] Custom MAIL FROM domain (`mail.eventalbum.app`)
- [x] Configuration set with reputation metrics enabled
- [x] Account-level suppression list for bounces and complaints
- [x] SNS notifications for bounce/complaint processing
- [x] IAM policy restricts From addresses
- [x] Email templates use SES v2 (not legacy v1)
- [x] Rate limiting at application level (3 OTPs per 5 min per address)
- [x] No links to external domains in OTP emails (anti-phishing)
- [x] TLS enforced by SES by default (STARTTLS + TLS 1.2+)
- [x] Sandbox mode for dev/staging (no accidental sends to real users)
- [x] CloudWatch alarms on bounce rate (>5%) and complaint rate (>0.1%)
