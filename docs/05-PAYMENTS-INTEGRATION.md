# Payments Integration — Recurrente API

## Why Recurrente?

- Guatemala-based payment processor (primary market)
- Supports GTQ and USD
- Simple API (no complex OAuth flows)
- Hosted checkout page (PCI compliance handled by them)
- Webhooks for payment confirmation
- Embedded checkout option (iframe in our SPA)
- Sandbox environment for testing

## Authentication

Every API call requires two headers:

```
X-PUBLIC-KEY: your_public_key
X-SECRET-KEY: your_secret_key
```

**Keys stored in:** AWS Secrets Manager, loaded by Lambda at cold start.

**Two key sets:**
- **TEST keys** — sandbox, card `4242 4242 4242 4242`, no real charges
- **LIVE keys** — production, real charges

---

## Payment Flow

### Step-by-Step

```
Host clicks "Upgrade to Paid"
        │
        ▼
Frontend calls POST /events/{id}/checkout
        │
        ▼
Lambda creates Recurrente checkout
(POST https://app.recurrente.com/api/checkouts/)
        │
        ▼
Lambda returns checkout URL to frontend
        │
        ▼
Option A: Redirect to Recurrente hosted page
Option B: Embed checkout in iframe (recurrente-checkout JS)
        │
        ▼
Host pays on Recurrente page
        │
        ▼
Recurrente sends webhook to POST /webhooks/recurrente
(event: payment_intent.succeeded)
        │
        ▼
Lambda upgrades event tier in DynamoDB:
  - tier: "free" → "paid"
  - uploadLimit: 150 → -1 (unlimited)
  - mediaTypes: ["image"] → ["image","video","audio"]
  - expiresAt: extend to 1 year from now
  - paymentStatus: "paid"
        │
        ▼
Host redirected to success_url → sees upgraded event
```

---

## Creating a Checkout (Lambda Code)

### Product Pricing

| Tier | GTQ | USD |
|---|---|---|
| Paid Event | Q75.00 (7500 cents) | $9.00 (900 cents) |
| Premium Event | Q200.00 (20000 cents) | $25.00 (2500 cents) |
| Storage Extension (1yr) | Q40.00 (4000 cents) | $5.00 (500 cents) |

### Request to Recurrente

```javascript
// Lambda: createCheckout
const response = await fetch('https://app.recurrente.com/api/checkouts/', {
  method: 'POST',
  headers: {
    'X-PUBLIC-KEY': process.env.RECURRENTE_PUBLIC_KEY,
    'X-SECRET-KEY': process.env.RECURRENTE_SECRET_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [{
      name: `EventAlbum - Plan ${tier}`,
      currency: currency, // "GTQ" or "USD"
      amount_in_cents: TIER_PRICES[tier][currency],
      image_url: 'https://eventalbum.app/logo.png',
      quantity: 1
    }],
    success_url: `https://eventalbum.app/e/${eventId}/admin?payment=success`,
    cancel_url: `https://eventalbum.app/e/${eventId}/admin?payment=cancelled`,
    metadata: {
      event_id: eventId,
      tier: tier,
      host_email: event.hostEmail
    },
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
  })
});

const { id, checkout_url } = await response.json();

// Store checkout reference in DynamoDB
await dynamodb.update({
  TableName: 'EventAlbum',
  Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
  UpdateExpression: 'SET checkoutId = :cid, paymentStatus = :ps',
  ExpressionAttributeValues: {
    ':cid': id,
    ':ps': 'pending'
  }
});

return { checkoutUrl: checkout_url, checkoutId: id };
```

---

## Webhook Handler

### Setup

Register webhook endpoint in Recurrente dashboard or via API:

```javascript
// One-time setup
POST https://app.recurrente.com/api/webhook_endpoints/
{
  "url": "https://api.eventalbum.app/v1/webhooks/recurrente",
  "events": ["payment_intent.succeeded", "payment_intent.failed"]
}
```

### Handling `payment_intent.succeeded`

```javascript
// Lambda: handleWebhook
exports.handler = async (event) => {
  const body = JSON.parse(event.body);

  // Verify this is from Recurrente (check headers or use IP whitelist)
  // Note: Recurrente doesn't have HMAC signing — use API key verification
  // by calling GET /api/checkouts/{id} to confirm payment status

  if (body.event_type === 'payment_intent.succeeded') {
    const checkoutId = body.checkout?.id;
    const metadata = body.checkout?.metadata || {};
    const eventId = metadata.event_id;
    const tier = metadata.tier;

    if (!eventId || !tier) {
      return { statusCode: 400, body: 'Missing metadata' };
    }

    // IMPORTANT: Verify payment by calling Recurrente API directly
    const verification = await fetch(
      `https://app.recurrente.com/api/checkouts/${checkoutId}`,
      { headers: { 'X-PUBLIC-KEY': ..., 'X-SECRET-KEY': ... } }
    );
    const checkoutData = await verification.json();

    if (checkoutData.status !== 'paid') {
      return { statusCode: 400, body: 'Payment not confirmed' };
    }

    // Upgrade event
    const tierConfig = TIER_CONFIGS[tier];
    await dynamodb.update({
      TableName: 'EventAlbum',
      Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
      UpdateExpression: `
        SET tier = :tier,
            uploadLimit = :ul,
            mediaTypes = :mt,
            paymentStatus = :ps,
            expiresAt = :exp
      `,
      ExpressionAttributeValues: {
        ':tier': tier,
        ':ul': tierConfig.uploadLimit,
        ':mt': tierConfig.mediaTypes,
        ':ps': 'paid',
        ':exp': tierConfig.expiresAt
      },
      ConditionExpression: 'paymentStatus <> :ps' // Idempotency
    });

    // Store payment record
    await dynamodb.put({
      TableName: 'EventAlbum',
      Item: {
        PK: `EVENT#${eventId}`,
        SK: `PAYMENT#${body.id}`,
        paymentIntentId: body.id,
        checkoutId: checkoutId,
        status: 'succeeded',
        amountInCents: body.amount_in_cents,
        currency: body.currency,
        customerEmail: body.customer?.email,
        recurrenteFee: body.fee,
        createdAt: body.created_at
      }
    });
  }

  return { statusCode: 200, body: 'OK' };
};
```

---

## Embedded Checkout (Frontend)

For a smoother UX, embed the checkout in the SPA:

```html
<div id="recurrente-checkout-container"></div>
```

```javascript
import RecurrenteCheckout from 'recurrente-checkout';

function openCheckout(checkoutUrl) {
  RecurrenteCheckout.load({
    url: checkoutUrl,
    onSuccess: (paymentData) => {
      // Poll event status or wait for websocket notification
      showSuccessMessage();
      refreshEventData();
    },
    onFailure: (error) => {
      showErrorMessage('Payment failed. Please try again.');
    },
    onPaymentInProgress: () => {
      showPendingMessage('Bank transfer initiated. We will notify you.');
    }
  });
}
```

Install: `npm install recurrente-checkout` or CDN script tag.

---

## Webhook Security

Recurrente does NOT provide HMAC webhook signatures. To verify webhooks:

1. **Always verify via API call:** After receiving webhook, call `GET /api/checkouts/{id}` to confirm `status: "paid"`
2. **Restrict webhook Lambda:** Only accepts POST, validates expected body shape
3. **IP whitelist** (if Recurrente publishes IPs) — via WAF rule
4. **Idempotency:** Use DynamoDB condition expression to prevent duplicate processing

---

## Refunds

If needed (e.g., customer complaint):

```javascript
POST https://app.recurrente.com/api/refunds/
{
  "payment_intent_id": "pa_abc123"
}
```

Same-day refunds = 100% refund. Handle via admin tool (future).

---

## Testing Checklist

- [ ] Create checkout with TEST keys → verify sandbox card `4242 4242 4242 4242`
- [ ] Verify `live_mode: false` on test checkouts
- [ ] Test webhook handler with simulated payload (sandbox doesn't fire webhooks)
- [ ] Test with LIVE keys + immediate refund for full flow
- [ ] Verify idempotent webhook processing
- [ ] Test checkout expiration
- [ ] Test embedded checkout component
- [ ] Verify metadata round-trip (event_id, tier)
