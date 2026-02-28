# DynamoDB Configuration

## Table: `EventAlbum-{env}`

### Capacity Mode

- **On-demand (PAY_PER_REQUEST)** — no capacity planning, auto-scales to zero, $0 at idle
- No read/write capacity units to manage
- Switch to provisioned only if consistent traffic pattern emerges and cost optimization is needed

**When to switch to Provisioned:**
- Consistent > 100 RCU/WCU sustained
- Predictable traffic patterns (e.g., events always on weekends)
- Even then, use auto-scaling with provisioned, not fixed capacity

### Region

- **us-east-1** (same as all other services)

---

## Key Schema

### Primary Key

| Attribute | Type | Description |
|---|---|---|
| `PK` | String (S) | Partition key |
| `SK` | String (S) | Sort key |

### Access Patterns and Key Design

| Entity | PK | SK | Purpose |
|---|---|---|---|
| Event | `EVENT#{eventId}` | `METADATA` | Event details (title, date, tier, settings) |
| Media | `EVENT#{eventId}` | `MEDIA#{mediaId}` | Individual media item |
| Reaction | `EVENT#{eventId}` | `REACTION#{mediaId}#{guestId}` | Reaction on media |
| Comment | `EVENT#{eventId}` | `COMMENT#{mediaId}#{timestamp}` | Comment on media |
| Guest | `EVENT#{eventId}` | `GUEST#{guestId}` | Guest record |
| OTP | `OTP#{eventId}#{destination}` | `CODE` | OTP verification code |
| Session | `SESSION#{sessionId}` | `DATA` | Auth session data |
| Stats | `EVENT#{eventId}` | `STATS` | Event statistics counters |
| Report | `EVENT#{eventId}` | `REPORT#{mediaId}#{reporterId}` | Content report |
| Host | `HOST#{email}` | `PROFILE` | Host account |
| Promo | `PROMO#{code}` | `DATA` | Promo/discount code |
| Payment | `EVENT#{eventId}` | `PAYMENT#{paymentId}` | Payment record |

---

## Global Secondary Indexes

### GSI1 — Query Events by Host Email

| Attribute | Value |
|---|---|
| GSI1PK | `HOST#{email}` |
| GSI1SK | `EVENT#{createdAt}` |
| Projection | ALL |

**Access patterns:**
- List all events created by a host, sorted by creation date
- `GSI1PK = HOST#host@example.com` → returns all their events

### GSI2 — Query Media by Event, Sorted by Upload Time

| Attribute | Value |
|---|---|
| GSI2PK | `EVENT#{eventId}` |
| GSI2SK | `UPLOAD#{timestamp}#{mediaId}` |
| Projection | ALL |

**Access patterns:**
- List media in an event, newest first (ScanIndexForward: false)
- Paginate media feed with `ExclusiveStartKey`
- `GSI2PK = EVENT#evt_abc AND GSI2SK begins_with UPLOAD#` → all media sorted by time

### Why ALL Projection?

ALL projection increases storage cost but eliminates the need for table fetches (GetItem after Query). For our access patterns, every query needs the full item — so KEYS_ONLY or INCLUDE would cause N+1 fetch patterns, increasing both latency and RCU cost.

---

## Time to Live (TTL)

- **Attribute:** `expiresAtTTL`
- **Type:** Number (Unix epoch seconds)
- **Enabled:** true

### TTL Usage

| Entity | TTL Value | Purpose |
|---|---|---|
| Event (free tier) | `createdAt + 15 days` | Auto-delete expired free events |
| Event (paid tier) | `createdAt + 180 days` | Auto-delete expired paid events |
| Event (premium tier) | `createdAt + 730 days` | Auto-delete expired premium events |
| OTP record | `createdAt + 5 minutes` | Auto-delete used/expired OTP codes |
| Session | `issuedAt + 24 hours` | Auto-cleanup old sessions |

**Note:** DynamoDB TTL deletion is eventually consistent — items may persist up to 48 hours after expiry. Do NOT rely on TTL for access control. Always check `expiresAtTTL` in application logic before returning data.

```bash
aws dynamodb update-time-to-live \
  --table-name EventAlbum-dev \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAtTTL" \
  --profile codersatelier
```

---

## Encryption

- **Encryption at rest:** AWS owned key (DEFAULT) — free
- **Do NOT use:** Customer-managed KMS key unless compliance requires it
  - KMS adds: $1/month per key + $0.03/10K API requests
  - For our use case, AWS owned key is sufficient

---

## Point-in-Time Recovery (PITR)

| Environment | PITR | Reason |
|---|---|---|
| dev | Disabled | Cost savings, data is ephemeral |
| staging | Disabled | Cost savings, test data |
| prod | **Enabled** | Recovery to any second in last 35 days |

```bash
# Enable PITR for production
aws dynamodb update-continuous-backups \
  --table-name EventAlbum-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --profile codersatelier
```

**PITR cost:** ~20% of table storage cost. For 1 GB of data: ~$0.05/month extra.

---

## DynamoDB Streams

- **Initially:** Disabled (no use case yet)
- **Enable if needed for:**
  - Cross-region replication (Global Tables)
  - Real-time analytics pipeline (Kinesis Data Firehose)
  - Event-driven triggers (e.g., auto-moderate on media insert)

```bash
# Enable streams if needed later
aws dynamodb update-table \
  --table-name EventAlbum-prod \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --profile codersatelier
```

---

## Backup Strategy

### On-Demand Backups

Create before major schema changes or data migrations:

```bash
aws dynamodb create-backup \
  --table-name EventAlbum-prod \
  --backup-name "EventAlbum-prod-pre-migration-$(date +%Y%m%d)" \
  --profile codersatelier

# List backups
aws dynamodb list-backups \
  --table-name EventAlbum-prod \
  --profile codersatelier

# Restore from backup (creates new table)
aws dynamodb restore-table-from-backup \
  --target-table-name EventAlbum-prod-restored \
  --backup-arn <BACKUP_ARN> \
  --profile codersatelier
```

**On-demand backup cost:** $0.10/GB per backup.

### Continuous Backups (PITR)

- Enabled in prod (see above)
- Allows recovery to any point in time within the last 35 days
- No manual backup scheduling needed

```bash
# Restore to a point in time
aws dynamodb restore-table-to-point-in-time \
  --source-table-name EventAlbum-prod \
  --target-table-name EventAlbum-prod-restored \
  --restore-date-time "2026-02-27T12:00:00Z" \
  --profile codersatelier
```

---

## Item Size and Limits

| Limit | Value | Our Usage |
|---|---|---|
| Max item size | 400 KB | Events ~2 KB, Media ~1 KB, well within limit |
| Max PK/SK size | 2,048 bytes | Our keys are ~50-100 bytes |
| Max GSI per table | 20 | We use 2 |
| Max attributes | No limit | We use ~15-20 per item |

---

## Query Patterns

### Common Queries

```typescript
// Get event by ID
const event = await ddb.send(new GetCommand({
  TableName: TABLE_NAME,
  Key: { PK: `EVENT#${eventId}`, SK: 'METADATA' },
}));

// List media for event (paginated, newest first)
const media = await ddb.send(new QueryCommand({
  TableName: TABLE_NAME,
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': `EVENT#${eventId}`,
    ':sk': 'UPLOAD#',
  },
  ScanIndexForward: false,  // newest first
  Limit: 20,
  ExclusiveStartKey: lastEvaluatedKey,  // pagination cursor
}));

// List events by host
const events = await ddb.send(new QueryCommand({
  TableName: TABLE_NAME,
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `HOST#${email}`,
  },
  ScanIndexForward: false,  // newest first
}));

// Get event stats
const stats = await ddb.send(new GetCommand({
  TableName: TABLE_NAME,
  Key: { PK: `EVENT#${eventId}`, SK: 'STATS' },
}));

// Atomic counter increment (upload count)
await ddb.send(new UpdateCommand({
  TableName: TABLE_NAME,
  Key: { PK: `EVENT#${eventId}`, SK: 'STATS' },
  UpdateExpression: 'SET uploadCount = if_not_exists(uploadCount, :zero) + :one',
  ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
}));
```

### Pagination Pattern

```typescript
// Client sends: ?cursor=<base64 encoded lastEvaluatedKey>
// Lambda decodes: ExclusiveStartKey = JSON.parse(atob(cursor))
// Lambda returns: nextCursor = btoa(JSON.stringify(lastEvaluatedKey))

interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;  // null if no more pages
}
```

---

## Conditional Writes

### Prevent Duplicate Events

```typescript
await ddb.send(new PutCommand({
  TableName: TABLE_NAME,
  Item: eventItem,
  ConditionExpression: 'attribute_not_exists(PK)',  // fail if event already exists
}));
```

### Enforce Upload Limits

```typescript
await ddb.send(new UpdateCommand({
  TableName: TABLE_NAME,
  Key: { PK: `EVENT#${eventId}`, SK: 'STATS' },
  UpdateExpression: 'SET uploadCount = uploadCount + :one',
  ConditionExpression: 'uploadCount < :limit',
  ExpressionAttributeValues: {
    ':one': 1,
    ':limit': tierLimits[tier].maxUploads,  // 50, 500, or 1000
  },
}));
```

---

## CLI Setup

### Create Table

```bash
aws dynamodb create-table \
  --table-name EventAlbum-dev \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
    AttributeName=GSI2PK,AttributeType=S \
    AttributeName=GSI2SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI2",
      "KeySchema": [
        {"AttributeName": "GSI2PK", "KeyType": "HASH"},
        {"AttributeName": "GSI2SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --region us-east-1 \
  --profile codersatelier
```

### Enable TTL

```bash
aws dynamodb update-time-to-live \
  --table-name EventAlbum-dev \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAtTTL" \
  --profile codersatelier
```

### Describe Table

```bash
aws dynamodb describe-table \
  --table-name EventAlbum-dev \
  --profile codersatelier
```

### Delete Table (Dev Only)

```bash
aws dynamodb delete-table \
  --table-name EventAlbum-dev \
  --profile codersatelier
```

---

## DynamoDB Local (Development)

```bash
# Run DynamoDB Local via Docker
docker run -p 8000:8000 amazon/dynamodb-local

# Create table against local instance
aws dynamodb create-table \
  --table-name EventAlbum-local \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
    AttributeName=GSI2PK,AttributeType=S \
    AttributeName=GSI2SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI2",
      "KeySchema": [
        {"AttributeName": "GSI2PK", "KeyType": "HASH"},
        {"AttributeName": "GSI2SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --endpoint-url http://localhost:8000
```

---

## Monitoring

### CloudWatch Metrics (Free with DynamoDB)

| Metric | Alarm Threshold | Action |
|---|---|---|
| `ConsumedReadCapacityUnits` | > 500/min sustained | Investigate hot partition |
| `ConsumedWriteCapacityUnits` | > 500/min sustained | Investigate burst traffic |
| `ThrottledRequests` | > 0 | Should never happen on on-demand |
| `SystemErrors` | > 0 | AWS-side issue, monitor |
| `UserErrors` | > 10/min | Client-side bugs (bad queries) |

### CloudWatch Contributor Insights (Optional)

```bash
# Enable to identify hot partition keys ($0.10/100K events analyzed)
aws dynamodb update-contributor-insights \
  --table-name EventAlbum-prod \
  --contributor-insights-action ENABLE \
  --profile codersatelier
```

---

## Cost Summary

| Component | Cost | Notes |
|---|---|---|
| On-demand reads (RRU) | $0.25/million | Eventually consistent reads |
| On-demand reads (RRU) | $0.50/million | Strongly consistent reads |
| On-demand writes (WRU) | $1.25/million | Standard writes |
| Storage | $0.25/GB/month | First 25 GB free (first 12 months) |
| GSI storage | $0.25/GB/month per GSI | Same rate as table |
| PITR | ~20% of storage cost | Prod only |
| On-demand backup | $0.10/GB | Manual backups |
| **No data, no traffic** | **$0.00/month** | Near-zero idle cost |

## Security Checklist

- [x] On-demand capacity (no over-provisioning risk)
- [x] Encryption at rest with AWS owned key (free)
- [x] PITR enabled in production
- [x] TTL configured for automatic data cleanup
- [x] Conditional writes prevent duplicates and enforce limits
- [x] IAM policies scoped to specific table ARN
- [x] No Scan operations in production code (Query only)
- [x] Pagination implemented for all list operations
- [x] DynamoDB Local for development (no cloud costs)
