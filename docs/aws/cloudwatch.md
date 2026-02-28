# CloudWatch Configuration

## Purpose

Centralized logging, metrics, alarms, and scheduled automation for the EventAlbum platform. CloudWatch is the observability backbone — all Lambda functions, API Gateway, and scheduled tasks feed into it.

---

## Log Groups

| Log Group | Source | Retention (Dev) | Retention (Prod) |
|---|---|---|---|
| `/aws/lambda/EventAlbum-dev-createEvent` | createEvent Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-authEvent` | authEvent Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-getEvent` | getEvent Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-getUploadUrl` | getUploadUrl Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-processUpload` | processUpload Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-sendOtp` | sendOtp Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-verifyOtp` | verifyOtp Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-hostLogin` | hostLogin Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-hostVerify` | hostVerify Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-createCheckout` | createCheckout Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-handleWebhook` | handleWebhook Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-getStats` | getStats Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-downloadZip` | downloadZip Lambda | 30 days | 90 days |
| `/aws/lambda/EventAlbum-dev-cleanup` | cleanup Lambda | 30 days | 90 days |
| `/aws/apigateway/EventAlbum-dev` | API Gateway access logs | 30 days | 30 days |

### Set Log Retention CLI

```bash
# Dev — 30 days for all Lambda log groups
for fn in createEvent authEvent getEvent getUploadUrl processUpload sendOtp verifyOtp hostLogin hostVerify createCheckout handleWebhook getStats downloadZip cleanup; do
  aws logs put-retention-policy \
    --log-group-name "/aws/lambda/EventAlbum-dev-${fn}" \
    --retention-in-days 30 \
    --profile codersatelier
done

# Prod — 90 days for all Lambda log groups
for fn in createEvent authEvent getEvent getUploadUrl processUpload sendOtp verifyOtp hostLogin hostVerify createCheckout handleWebhook getStats downloadZip cleanup; do
  aws logs put-retention-policy \
    --log-group-name "/aws/lambda/EventAlbum-prod-${fn}" \
    --retention-in-days 90 \
    --profile codersatelier
done

# API Gateway access logs — 30 days
aws logs put-retention-policy \
  --log-group-name "/aws/apigateway/EventAlbum-prod" \
  --retention-in-days 30 \
  --profile codersatelier
```

**IMPORTANT:** Without a retention policy, CloudWatch logs are stored **indefinitely** and costs grow without bound. Always set retention.

---

## Structured Logging Format (Lambda)

All Lambda functions MUST log structured JSON. Use a shared logging utility.

### Logger Utility

```javascript
// src/shared/logger.mjs
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

function log(level, message, data = {}) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId: data.requestId || undefined,
    eventId: data.eventId || undefined,
    ...data
  }));
}

export const logger = {
  debug: (msg, data) => log('DEBUG', msg, data),
  info:  (msg, data) => log('INFO', msg, data),
  warn:  (msg, data) => log('WARN', msg, data),
  error: (msg, data) => log('ERROR', msg, data),
};
```

### Example Log Output

```json
{
  "level": "INFO",
  "message": "Event created",
  "timestamp": "2026-03-15T16:00:00.123Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventId": "evt_abc123",
  "tier": "paid",
  "hostEmail": "host@example.com"
}
```

```json
{
  "level": "ERROR",
  "message": "Rekognition call failed",
  "timestamp": "2026-03-15T16:00:01.456Z",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventId": "evt_abc123",
  "mediaKey": "events/evt_abc123/img_001.jpg",
  "error": "ProvisionedThroughputExceededException",
  "retryAttempt": 3
}
```

### API Gateway Access Log Format

```json
{
  "requestId": "$context.requestId",
  "ip": "$context.identity.sourceIp",
  "method": "$context.httpMethod",
  "path": "$context.path",
  "status": "$context.status",
  "latency": "$context.responseLatency",
  "userAgent": "$context.identity.userAgent",
  "requestTime": "$context.requestTime"
}
```

Set via SAM template:

```yaml
HttpApi:
  Type: AWS::Serverless::HttpApi
  Properties:
    AccessLogSettings:
      DestinationArn: !GetAtt ApiLogGroup.Arn
      Format: '{"requestId":"$context.requestId","ip":"$context.identity.sourceIp","method":"$context.httpMethod","path":"$context.path","status":"$context.status","latency":"$context.responseLatency","requestTime":"$context.requestTime"}'
```

---

## Metrics & Alarms

### Critical Alarms (Production Only)

| Alarm Name | Namespace | Metric | Threshold | Period | Eval Periods | Action |
|---|---|---|---|---|---|---|
| `EventAlbum-prod-HighAPIErrors` | AWS/ApiGateway | 5XXError | > 10 | 5 min | 1 | SNS email |
| `EventAlbum-prod-LambdaErrors` | AWS/Lambda | Errors (all functions) | > 5 | 5 min | 1 | SNS email |
| `EventAlbum-prod-DDBThrottle` | AWS/DynamoDB | ThrottledRequests | > 0 | 1 min | 1 | SNS email |
| `EventAlbum-prod-SNSSpend` | AWS/SNS | SMSMonthToDateSpentUSD | > 40 | 1 hour | 1 | SNS email |
| `EventAlbum-prod-SESBounceRate` | AWS/SES | Reputation.BounceRate | > 5% | 1 hour | 1 | SNS email |
| `EventAlbum-prod-SlowUpload` | AWS/Lambda | Duration (processUpload) | > 30000 ms (p99) | 5 min | 1 | SNS email |
| `EventAlbum-prod-S3ClientErrors` | AWS/S3 | 4xxErrors | > 50 | 5 min | 1 | SNS email |

### Create SNS Alarm Topic

```bash
aws sns create-topic \
  --name EventAlbum-Alarms \
  --profile codersatelier

aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --protocol email \
  --notification-endpoint brandon@codersatelier.com \
  --profile codersatelier
```

### Create Alarm CLI Examples

```bash
# High API 5XX errors
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-HighAPIErrors" \
  --namespace "AWS/ApiGateway" \
  --metric-name "5XXError" \
  --dimensions Name=ApiId,Value=<api-id> \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier

# Lambda errors (all functions)
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-LambdaErrors" \
  --namespace "AWS/Lambda" \
  --metric-name "Errors" \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier

# DynamoDB throttling
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-DDBThrottle" \
  --namespace "AWS/DynamoDB" \
  --metric-name "ThrottledRequests" \
  --dimensions Name=TableName,Value=EventAlbum-prod \
  --statistic Sum \
  --period 60 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier

# SNS SMS monthly spend
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-SNSSpend" \
  --namespace "AWS/SNS" \
  --metric-name "SMSMonthToDateSpentUSD" \
  --statistic Maximum \
  --period 3600 \
  --threshold 40 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier

# SES bounce rate
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-SESBounceRate" \
  --namespace "AWS/SES" \
  --metric-name "Reputation.BounceRate" \
  --statistic Average \
  --period 3600 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier

# Slow processUpload (p99 > 30 seconds)
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-SlowUpload" \
  --namespace "AWS/Lambda" \
  --metric-name "Duration" \
  --dimensions Name=FunctionName,Value=EventAlbum-prod-processUpload \
  --extended-statistic p99 \
  --period 300 \
  --threshold 30000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier

# S3 client errors
aws cloudwatch put-metric-alarm \
  --alarm-name "EventAlbum-prod-S3ClientErrors" \
  --namespace "AWS/S3" \
  --metric-name "4xxErrors" \
  --dimensions Name=BucketName,Value=eventalbum-prod-media Name=FilterId,Value=AllRequests \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:<account-id>:EventAlbum-Alarms \
  --profile codersatelier
```

---

## Dashboard

### Name: `EventAlbum-{env}`

Only create for production. Skip for dev/staging to save $3/month.

### Widgets

| Widget | Metric | Visualization |
|---|---|---|
| API Requests | HttpApi RequestCount | Line graph |
| API Error Rate | HttpApi 5XXError / RequestCount * 100 | Line graph (%) |
| Lambda Duration | p50 and p99 Duration (all functions) | Line graph |
| Lambda Errors | Errors by function | Stacked bar |
| Lambda Invocations | Invocations by function | Stacked bar |
| DynamoDB Consumed RCU | ConsumedReadCapacityUnits | Line graph |
| DynamoDB Consumed WCU | ConsumedWriteCapacityUnits | Line graph |
| S3 Requests | GetRequests + PutRequests | Stacked bar |
| S3 Bucket Size | BucketSizeBytes | Number |
| SNS SMS Count | NumberOfMessagesPublished | Number |
| SES Send Count | Send | Number |
| SES Bounce Rate | Reputation.BounceRate | Number (alert if > 5%) |

### Create Dashboard CLI

```bash
aws cloudwatch put-dashboard \
  --dashboard-name "EventAlbum-prod" \
  --dashboard-body file://cloudwatch-dashboard.json \
  --profile codersatelier
```

---

## EventBridge Rules (Scheduled Tasks)

| Rule Name | Schedule | Target Lambda | Purpose |
|---|---|---|---|
| `EventAlbum-prod-GuestUploadNotification` | rate(30 minutes) | notifyUploads | Batch upload notifications to hosts |
| `EventAlbum-prod-EventSummary` | rate(1 day) | eventSummary | Check ended events, send summary email |
| `EventAlbum-prod-CleanupExpired` | rate(1 day) | cleanup | S3 cleanup for expired event media |
| `EventAlbum-prod-FlaggedAutoDelete` | rate(1 day) | flaggedCleanup | Auto-delete hidden media after 7 days |

### SAM Template

```yaml
GuestUploadNotificationRule:
  Type: AWS::Events::Rule
  Properties:
    Name: !Sub "EventAlbum-${Environment}-GuestUploadNotification"
    ScheduleExpression: "rate(30 minutes)"
    State: ENABLED
    Targets:
      - Arn: !GetAtt NotifyUploadsFunction.Arn
        Id: NotifyUploadsTarget

CleanupExpiredRule:
  Type: AWS::Events::Rule
  Properties:
    Name: !Sub "EventAlbum-${Environment}-CleanupExpired"
    ScheduleExpression: "rate(1 day)"
    State: ENABLED
    Targets:
      - Arn: !GetAtt CleanupFunction.Arn
        Id: CleanupTarget
```

### CLI: Create Rule Example

```bash
aws events put-rule \
  --name "EventAlbum-prod-CleanupExpired" \
  --schedule-expression "rate(1 day)" \
  --state ENABLED \
  --profile codersatelier

aws events put-targets \
  --rule "EventAlbum-prod-CleanupExpired" \
  --targets "Id"="CleanupTarget","Arn"="arn:aws:lambda:us-east-1:<account-id>:function:EventAlbum-prod-cleanup" \
  --profile codersatelier

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
  --function-name EventAlbum-prod-cleanup \
  --statement-id EventBridge-CleanupExpired \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:<account-id>:rule/EventAlbum-prod-CleanupExpired \
  --profile codersatelier
```

---

## CloudWatch Logs Insights (Useful Queries)

### Find errors in the last hour

```sql
fields @timestamp, @message
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

### Slow Lambda invocations (> 5 seconds)

```sql
filter @type = "REPORT"
| filter @duration > 5000
| fields @requestId, @duration, @billedDuration, @memorySize, @maxMemoryUsed
| sort @duration desc
| limit 20
```

### API Gateway 5XX errors

```sql
fields @timestamp, path, status, latency, ip
| filter status >= 500
| sort @timestamp desc
| limit 50
```

### Upload volume per event

```sql
fields @timestamp, eventId, @message
| filter message = "Upload processed"
| stats count(*) as uploadCount by eventId
| sort uploadCount desc
| limit 20
```

### Cold start detection

```sql
filter @type = "REPORT"
| filter @initDuration > 0
| fields @requestId, @initDuration, @duration
| sort @initDuration desc
| limit 20
```

---

## Cost at Idle

| Component | Monthly Cost |
|---|---|
| Log storage (no data ingested) | $0.00 |
| Standard alarms (10 alarms) | $1.00 ($0.10/alarm) |
| Dashboard (1 production) | $3.00 (first 3 dashboards free) |
| EventBridge rules (4 rules) | $0.00 (free up to 14M invocations/month) |
| Logs Insights queries | $0.00 (pay per query, $0.005/GB scanned) |
| **Total (prod with dashboard)** | **$1.00 - $4.00** |
| **Total (dev, no dashboard/alarms)** | **$0.00** |

---

## Recommendations

1. **Dev/Staging:** No alarms, no dashboards. Just logs with 30-day retention.
2. **Production launch:** Create 7 critical alarms ($0.70/month). Skip dashboard initially.
3. **After 10 paying events:** Create dashboard ($3/month). Worth the visibility.
4. **Set log retention immediately.** Unbounded log storage is the most common CloudWatch cost surprise.
5. **Use LOG_LEVEL env var.** Set `DEBUG` in dev, `INFO` in prod. Reduces log ingestion cost.
