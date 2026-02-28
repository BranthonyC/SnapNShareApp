# ACM & Route 53 Configuration

## Purpose

DNS management (Route 53) and SSL/TLS certificates (ACM) for the eventalbum.app domain. These are foundational services — everything else (CloudFront, API Gateway, SES) depends on them.

---

## Route 53

### Create Hosted Zone

```bash
aws route53 create-hosted-zone \
  --name eventalbum.app \
  --caller-reference "eventalbum-$(date +%s)" \
  --profile codersatelier
```

After creation, update the domain registrar's nameservers to point to the Route 53 NS records returned by this command.

### List Hosted Zones

```bash
aws route53 list-hosted-zones \
  --profile codersatelier
```

### Get Hosted Zone Details

```bash
aws route53 get-hosted-zone \
  --id Z1234567890ABC \
  --profile codersatelier
```

---

### DNS Records

| Type | Name | Value | TTL | Purpose |
|---|---|---|---|---|
| A (Alias) | eventalbum.app | CloudFront frontend distribution | — | Main website |
| A (Alias) | www.eventalbum.app | CloudFront frontend distribution | — | WWW redirect |
| A (Alias) | cdn.eventalbum.app | CloudFront media distribution | — | Media CDN |
| A (Alias) | api.eventalbum.app | API Gateway custom domain | — | API endpoint |
| A (Alias) | staging.eventalbum.app | CloudFront staging distribution | — | Staging environment |
| CNAME | `xxx._domainkey.eventalbum.app` | `xxx.dkim.amazonses.com` | 3600 | SES DKIM (3 records) |
| TXT | `_amazonses.eventalbum.app` | (SES verification token) | 3600 | SES domain verification |
| TXT | eventalbum.app | `v=spf1 include:amazonses.com ~all` | 3600 | SPF for email deliverability |
| TXT | `_dmarc.eventalbum.app` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@eventalbum.app; pct=100` | 3600 | DMARC policy |
| CNAME | `_acme-challenge.eventalbum.app` | (ACM validation value) | 300 | SSL certificate DNS validation |

### Create DNS Records CLI

```bash
# Create A record alias for CloudFront frontend
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "eventalbum.app",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d111111abcdef8.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }' \
  --profile codersatelier
```

Note: `Z2FDTNDATAQYW2` is the CloudFront hosted zone ID (constant for all CloudFront distributions).

```bash
# Create A record alias for API Gateway custom domain
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.eventalbum.app",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<api-gateway-hosted-zone-id>",
          "DNSName": "<api-gateway-domain-name>.execute-api.us-east-1.amazonaws.com",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }' \
  --profile codersatelier
```

```bash
# Create SPF record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "eventalbum.app",
        "Type": "TXT",
        "TTL": 3600,
        "ResourceRecords": [
          {"Value": "\"v=spf1 include:amazonses.com ~all\""}
        ]
      }
    }]
  }' \
  --profile codersatelier
```

```bash
# Create DMARC record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_dmarc.eventalbum.app",
        "Type": "TXT",
        "TTL": 3600,
        "ResourceRecords": [
          {"Value": "\"v=DMARC1; p=quarantine; rua=mailto:dmarc@eventalbum.app; pct=100\""}
        ]
      }
    }]
  }' \
  --profile codersatelier
```

### List All Records

```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --profile codersatelier
```

---

## ACM (AWS Certificate Manager)

### Request Wildcard Certificate

```bash
aws acm request-certificate \
  --domain-name eventalbum.app \
  --subject-alternative-names "*.eventalbum.app" \
  --validation-method DNS \
  --region us-east-1 \
  --profile codersatelier
```

**CRITICAL:** The certificate MUST be in `us-east-1` for CloudFront. CloudFront only accepts certificates from us-east-1, regardless of where your other resources are deployed.

### Validation

- **Method:** DNS (recommended over email)
- ACM provides a CNAME record to add to Route 53
- Once the CNAME is in place, validation completes in minutes
- ACM **auto-renews** DNS-validated certificates indefinitely

### Get Validation CNAME

```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:<account-id>:certificate/<cert-id> \
  --region us-east-1 \
  --profile codersatelier \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

### Add Validation CNAME to Route 53

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_abc123.eventalbum.app",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {"Value": "_xyz789.acm-validations.aws."}
        ]
      }
    }]
  }' \
  --profile codersatelier
```

### Check Certificate Status

```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:<account-id>:certificate/<cert-id> \
  --region us-east-1 \
  --query 'Certificate.Status' \
  --profile codersatelier
```

Expected: `ISSUED` (after DNS validation completes).

### List Certificates

```bash
aws acm list-certificates \
  --region us-east-1 \
  --profile codersatelier
```

---

### Certificate Covers

| Domain | Used By | Purpose |
|---|---|---|
| `eventalbum.app` | CloudFront frontend distribution | Main website |
| `*.eventalbum.app` | All subdomains | Wildcard covers everything below |
| `www.eventalbum.app` | CloudFront frontend distribution | WWW redirect |
| `cdn.eventalbum.app` | CloudFront media distribution | Media CDN with signed URLs |
| `api.eventalbum.app` | API Gateway HTTP API custom domain | REST API |
| `staging.eventalbum.app` | CloudFront staging distribution | Staging environment |

A single wildcard certificate covers all subdomains, so only one certificate is needed.

---

## API Gateway Custom Domain

### Create Custom Domain Name

```bash
aws apigatewayv2 create-domain-name \
  --domain-name api.eventalbum.app \
  --domain-name-configurations CertificateArn=arn:aws:acm:us-east-1:<account-id>:certificate/<cert-id> \
  --region us-east-1 \
  --profile codersatelier
```

### Create API Mapping

```bash
aws apigatewayv2 create-api-mapping \
  --domain-name api.eventalbum.app \
  --api-id <api-id> \
  --stage '$default' \
  --region us-east-1 \
  --profile codersatelier
```

### SAM Template

```yaml
ApiDomainName:
  Type: AWS::ApiGatewayV2::DomainName
  Properties:
    DomainName: api.eventalbum.app
    DomainNameConfigurations:
      - CertificateArn: !Ref CertificateArn
        EndpointType: REGIONAL

ApiMapping:
  Type: AWS::ApiGatewayV2::ApiMapping
  Properties:
    DomainName: !Ref ApiDomainName
    ApiId: !Ref HttpApi
    Stage: !Ref HttpApiStage
```

---

## CloudFront Custom Domain Setup

### SAM/CloudFormation Snippet

```yaml
FrontendDistribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Aliases:
        - eventalbum.app
        - www.eventalbum.app
      ViewerCertificate:
        AcmCertificateArn: !Ref CertificateArn
        SslSupportMethod: sni-only
        MinimumProtocolVersion: TLSv1.2_2021
      # ... other config

MediaDistribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Aliases:
        - cdn.eventalbum.app
      ViewerCertificate:
        AcmCertificateArn: !Ref CertificateArn
        SslSupportMethod: sni-only
        MinimumProtocolVersion: TLSv1.2_2021
      # ... other config
```

---

## Email DNS Records (SES)

SES requires three types of DNS records for email deliverability. These are created automatically when you verify a domain in SES, but you must add the provided values to Route 53.

### DKIM (3 CNAME records)

```bash
# SES provides 3 DKIM CNAME records when you verify a domain
# Example (actual values from SES console):
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "abc123._domainkey.eventalbum.app",
          "Type": "CNAME",
          "TTL": 3600,
          "ResourceRecords": [{"Value": "abc123.dkim.amazonses.com"}]
        }
      },
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "def456._domainkey.eventalbum.app",
          "Type": "CNAME",
          "TTL": 3600,
          "ResourceRecords": [{"Value": "def456.dkim.amazonses.com"}]
        }
      },
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "ghi789._domainkey.eventalbum.app",
          "Type": "CNAME",
          "TTL": 3600,
          "ResourceRecords": [{"Value": "ghi789.dkim.amazonses.com"}]
        }
      }
    ]
  }' \
  --profile codersatelier
```

### SES Domain Verification (TXT)

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_amazonses.eventalbum.app",
        "Type": "TXT",
        "TTL": 3600,
        "ResourceRecords": [
          {"Value": "\"<ses-verification-token>\""}
        ]
      }
    }]
  }' \
  --profile codersatelier
```

---

## Setup Order

Execute in this order to avoid dependency issues:

1. **Register domain** (if not already done) at your registrar
2. **Create Route 53 hosted zone** and update registrar nameservers
3. **Request ACM certificate** (wildcard) in us-east-1
4. **Add ACM DNS validation CNAME** to Route 53
5. **Wait for certificate to be ISSUED** (usually 5-15 minutes)
6. **Verify domain in SES** and add DKIM + SPF + DMARC records
7. **Create CloudFront distributions** with custom domains + certificate
8. **Create API Gateway custom domain** with certificate
9. **Add A (Alias) records** for all subdomains pointing to CloudFront / API Gateway

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Certificate stuck in `PENDING_VALIDATION` | DNS CNAME not propagated | Verify CNAME exists in Route 53; wait up to 30 min |
| CloudFront rejects certificate | Cert not in us-east-1 | Re-request certificate in us-east-1 |
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | MinimumProtocolVersion too high for old clients | Use `TLSv1.2_2021` (good balance) |
| API Gateway 403 on custom domain | API mapping missing | Create API mapping for the custom domain |
| Email going to spam | Missing SPF/DKIM/DMARC | Add all three DNS records |
| DNS not resolving | Nameservers not updated at registrar | Update registrar NS records to Route 53 values |

---

## Cost

| Service | Component | Monthly Cost |
|---|---|---|
| Route 53 | Hosted zone (1) | $0.50 |
| Route 53 | DNS queries (~100K) | $0.04 |
| ACM | Public certificate (1 wildcard) | $0.00 |
| **Total** | | **$0.54** |

### Cost at Idle

| Service | Monthly |
|---|---|
| Route 53 hosted zone | $0.50 |
| ACM certificate | $0.00 |
| **Total** | **$0.50** |

Route 53 is the only AWS service in EventAlbum with a non-zero idle cost. The $0.50/month is unavoidable if using AWS DNS.
