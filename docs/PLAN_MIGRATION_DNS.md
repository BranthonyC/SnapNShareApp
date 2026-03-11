# Domain Migration Plan: `codersatelier.com` → `inlovingmemory.com`

## Current State

| Resource | Current Domain |
|---|---|
| Frontend (prod) | `eventalbum.codersatelier.com` |
| API (prod) | `eventalbum-api.codersatelier.com` |
| Media CDN (prod) | `eventalbum-cdn.codersatelier.com` |
| SES Sender | `noreply@codersatelier.com` |
| Contact Email | `hola@codersatelier.com` |

## Target State

| Resource | New Domain |
|---|---|
| Frontend (prod) | `inlovingmemory.com` (or `www.inlovingmemory.com`) |
| API (prod) | `api.inlovingmemory.com` |
| Media CDN (prod) | `cdn.inlovingmemory.com` |
| SES Sender | `noreply@inlovingmemory.com` |
| Contact Email | `hola@inlovingmemory.com` |

> **Staging stays on `codersatelier.com`** — no changes needed there.

---

## Prerequisites

1. **Buy domain** `inlovingmemory.com`
2. **Set up Route53 Hosted Zone** for the new domain (or point registrar nameservers to Route53)
3. Note the new **Hosted Zone ID** — needed for SAM template

---

## Step 1: ACM Certificate

```bash
aws acm request-certificate \
  --domain-name "inlovingmemory.com" \
  --subject-alternative-names "*.inlovingmemory.com" \
  --validation-method DNS \
  --region us-east-1 --profile codersatelier
```

- Add the DNS validation CNAME records in Route53 (or registrar DNS)
- Wait for certificate status to be `ISSUED`
- Note the new **Certificate ARN**

---

## Step 2: Update SAM Config (`samconfig.toml`)

Update the `[prod.deploy.parameters]` section:

```toml
parameter_overrides = [
  "CertificateArn=arn:aws:acm:us-east-1:155209345372:certificate/<NEW_CERT_ID>",
  "DomainName=inlovingmemory.com",
  "HostedZoneId=<NEW_HOSTED_ZONE_ID>",
  ...
]
```

---

## Step 3: Update `template.yaml`

### API Gateway Custom Domain
Change the API custom domain from `eventalbum-api.codersatelier.com` to `api.inlovingmemory.com`:

```yaml
ApiDomainName:
  Type: AWS::ApiGatewayV2::DomainName
  Properties:
    DomainName: !Sub "api.${DomainName}"  # api.inlovingmemory.com
```

### CloudFront Distributions
Update alternate domain names (aliases):

- **Frontend Distribution**: `inlovingmemory.com`
- **Media Distribution**: `cdn.inlovingmemory.com`

### Route53 Records
Update A-alias records to point to:
- `inlovingmemory.com` → Frontend CloudFront distribution
- `api.inlovingmemory.com` → API Gateway custom domain
- `cdn.inlovingmemory.com` → Media CloudFront distribution

### CORS
Update prod CORS allowed origin:
```yaml
# From:
AllowOrigins: ["https://eventalbum.codersatelier.com"]
# To:
AllowOrigins: ["https://inlovingmemory.com"]
```

---

## Step 4: Update Lambda Environment Variables

Update `FRONTEND_URL` in template.yaml Globals or per-function:

```yaml
# From:
FRONTEND_URL: https://eventalbum.codersatelier.com
# To:
FRONTEND_URL: https://inlovingmemory.com
```

This affects email links (admin dashboard URL, QR URL, etc.) in:
- `createEvent`
- `createCheckout` (success/cancel URLs)
- `handleWebhook` (event-created email QR URL)

---

## Step 5: SES Sender Identity

```bash
# Verify the new domain in SES
aws sesv2 create-email-identity \
  --email-identity inlovingmemory.com \
  --region us-east-1 --profile codersatelier
```

- Add the DKIM CNAME records SES provides to Route53
- Update `SES_FROM_EMAIL` env var: `noreply@inlovingmemory.com`

---

## Step 6: Code Changes

### `frontend/index.html`
- `og:url` → `https://inlovingmemory.com/`
- `og:image` → `https://inlovingmemory.com/og-image.png`

### `backend/shared/email.mjs`
- Hardcoded admin dashboard link: `eventalbum.codersatelier.com/e/${eventId}/admin` → use `FRONTEND_URL` env var (or `inlovingmemory.com`)
- Email footer domain references

### `backend/functions/createCheckout/index.mjs`
- `FRONTEND_URL` fallback: `'https://eventalbum.codersatelier.com'` → `'https://inlovingmemory.com'`

### `backend/functions/handleWebhook/index.mjs`
- `FRONTEND_URL` fallback: `'https://eventalbum.codersatelier.com'` → `'https://inlovingmemory.com'`

### `frontend/src/pages/landing/LandingPage.tsx`
- Footer contact email: `hola@codersatelier.com` → `hola@inlovingmemory.com`

### `frontend/src/services/api.ts`
- Verify `VITE_API_URL` is used (not hardcoded) — should be fine already

---

## Step 7: Frontend Prod Build & Deploy

```bash
cd frontend
VITE_API_URL=https://api.inlovingmemory.com npm run build
aws s3 sync dist s3://eventalbum-frontend-prod --delete --region us-east-1 --profile codersatelier
aws cloudfront create-invalidation --distribution-id E3DKK23J7LNRCL --paths "/*" --region us-east-1 --profile codersatelier
```

---

## Step 8: Backend Deploy

```bash
cd /path/to/EventAlbum
sam build --region us-east-1 --profile codersatelier
sam deploy --config-env prod --region us-east-1 --profile codersatelier
```

---

## Step 9: Transition Period (Critical)

**Existing QR codes in the wild point to `eventalbum.codersatelier.com/e/...`** — those MUST keep working.

### Option A: CloudFront Function 301 Redirect (Recommended)
Add a CloudFront Function to the OLD frontend distribution that 301-redirects all requests to the new domain:

```javascript
function handler(event) {
  var request = event.request;
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://inlovingmemory.com' + request.uri }
    }
  };
}
```

### Option B: Keep Old Domain as Alias
Add `eventalbum.codersatelier.com` as an additional alias on the NEW frontend distribution. Cheapest but keeps dependency on old domain.

### API Redirect
Similarly, keep `eventalbum-api.codersatelier.com` working during transition:
- Either keep it as an additional API Gateway custom domain mapping
- Or set up a 301 redirect

---

## Order of Operations (Zero Downtime)

1. **Certificate + DNS setup** (can take minutes to hours for validation)
2. **SES domain verification** (can do in parallel with #1)
3. **Add new domains as ADDITIONAL aliases** (old domains still work)
4. **Update env vars + code** and redeploy backend
5. **Rebuild frontend** with new `VITE_API_URL` and deploy
6. **Verify everything works** on new domain
7. **Set up 301 redirects** on old domain → new domain
8. **Eventually remove old aliases** (keep redirects indefinitely for old QR codes)

---

## Checklist

- [ ] Domain purchased
- [ ] Route53 Hosted Zone created
- [ ] ACM certificate requested and validated
- [ ] SES domain verified + DKIM records added
- [ ] `samconfig.toml` updated (CertificateArn, DomainName, HostedZoneId)
- [ ] `template.yaml` updated (API domain, CloudFront aliases, CORS, Route53 records)
- [ ] Lambda env vars updated (FRONTEND_URL, SES_FROM_EMAIL)
- [ ] Code changes (hardcoded URLs in email.mjs, createCheckout, handleWebhook, index.html, LandingPage)
- [ ] Backend deployed (`sam deploy --config-env prod`)
- [ ] Frontend built with `VITE_API_URL=https://api.inlovingmemory.com` and deployed
- [ ] New domain verified working (frontend, API, media CDN, emails)
- [ ] Old domain 301 redirect set up
- [ ] Old QR codes tested (scan → redirect → new domain → event)
