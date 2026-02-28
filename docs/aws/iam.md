# IAM Configuration

## Principle

**Least privilege.** Every Lambda function gets ONLY the permissions it needs. No wildcard `*` resources in production policies. All policies scoped to specific table ARNs, bucket names, and parameter paths.

---

## Lambda Execution Roles

### Base Role (All Functions)

Every Lambda function inherits this base policy for CloudWatch Logs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:<account-id>:log-group:/aws/lambda/EventAlbum-*"
    }
  ]
}
```

SAM handles this automatically when using `AWS::Serverless::Function`.

---

## Per-Function Policies

### createEvent

Creates a new event record in DynamoDB. Reads tier config from SSM.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/config/*
```

| Action | Resource |
|---|---|
| `dynamodb:PutItem` | EventAlbum table |
| `ssm:GetParameter` | `/eventalbum/config/tiers/*`, `/eventalbum/config/pricing` |

---

### authEvent

Authenticates guests via event ID + password. Issues JWT.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/secrets/jwt-secret
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:UpdateItem` | EventAlbum table |
| `ssm:GetParameter` (with decryption) | `/eventalbum/secrets/jwt-secret` |

---

### getEvent

Retrieves event details. Generates CloudFront signed URLs for media.

```yaml
Policies:
  - DynamoDBReadPolicy:
      TableName: !Ref EventAlbumTable
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/secrets/cf-*
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:Query` | EventAlbum table |
| `ssm:GetParameter` (with decryption) | `/eventalbum/secrets/cf-key-pair-id`, `/eventalbum/secrets/cf-private-key` |

Note: CloudFront signed URL generation uses a private key from SSM. No IAM action for CloudFront is needed — signing happens in Lambda code.

---

### getUploadUrl

Generates S3 presigned upload URLs. Enforces tier upload limits.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - S3CrudPolicy:
      BucketName: !Ref MediaBucket
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/config/tiers/*
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:UpdateItem` | EventAlbum table |
| `s3:PutObject` | `eventalbum-{env}-media/events/*` |
| `ssm:GetParameter` | `/eventalbum/config/tiers/*` |

---

### processUpload

S3 trigger. Processes uploaded media: generates thumbnails, runs moderation (Premium), updates DynamoDB.

```yaml
Policies:
  - S3CrudPolicy:
      BucketName: !Ref MediaBucket
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - Version: '2012-10-17'
    Statement:
      - Effect: Allow
        Action: rekognition:DetectModerationLabels
        Resource: '*'
  - SESCrudPolicy:
      IdentityName: eventalbum.app
```

| Action | Resource |
|---|---|
| `s3:GetObject`, `s3:PutObject` | `eventalbum-{env}-media/events/*` |
| `dynamodb:UpdateItem`, `dynamodb:PutItem`, `dynamodb:GetItem` | EventAlbum table |
| `rekognition:DetectModerationLabels` | `*` (no resource scoping available) |
| `ses:SendEmail`, `ses:SendTemplatedEmail` | `eventalbum.app` identity |

---

### sendOtp

Sends OTP via SMS (SNS) or email (SES) for guest verification.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SNSPublishMessagePolicy:
      TopicArn: '*'  # SMS uses direct publish, not topics
  - SESCrudPolicy:
      IdentityName: eventalbum.app
```

| Action | Resource |
|---|---|
| `dynamodb:PutItem`, `dynamodb:GetItem` | EventAlbum table |
| `sns:Publish` | `*` (SMS direct publish requires `*`) |
| `ses:SendEmail`, `ses:SendTemplatedEmail` | `eventalbum.app` identity |

Note: SNS SMS `Publish` with `PhoneNumber` parameter requires `Resource: "*"`. This is an AWS limitation for direct SMS sending.

---

### verifyOtp

Verifies OTP code, grants guest access.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem` | EventAlbum table |

---

### hostLogin

Host requests a magic link via email.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SESCrudPolicy:
      IdentityName: eventalbum.app
```

| Action | Resource |
|---|---|
| `dynamodb:Query` (GSI1), `dynamodb:PutItem`, `dynamodb:GetItem` | EventAlbum table + GSI1 |
| `ses:SendEmail`, `ses:SendTemplatedEmail` | `eventalbum.app` identity |

---

### hostVerify

Verifies host magic link token, issues host JWT.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/secrets/jwt-secret
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:DeleteItem` | EventAlbum table |
| `ssm:GetParameter` (with decryption) | `/eventalbum/secrets/jwt-secret` |

---

### createCheckout

Creates a Recurrente checkout session for event purchase.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/secrets/recurrente-*
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/config/pricing
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/config/discounts
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:UpdateItem` | EventAlbum table |
| `ssm:GetParameter` (with decryption) | `/eventalbum/secrets/recurrente-*`, `/eventalbum/config/pricing`, `/eventalbum/config/discounts` |

Note: The HTTPS call to Recurrente API requires no IAM permissions.

---

### handleWebhook

Receives Recurrente payment webhook, activates event.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - SESCrudPolicy:
      IdentityName: eventalbum.app
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/secrets/recurrente-*
```

| Action | Resource |
|---|---|
| `dynamodb:GetItem`, `dynamodb:UpdateItem` | EventAlbum table |
| `ses:SendEmail`, `ses:SendTemplatedEmail` | `eventalbum.app` identity |
| `ssm:GetParameter` (with decryption) | `/eventalbum/secrets/recurrente-*` |

---

### getStats / getActivity

Returns event analytics (host dashboard).

```yaml
Policies:
  - DynamoDBReadPolicy:
      TableName: !Ref EventAlbumTable
```

| Action | Resource |
|---|---|
| `dynamodb:Query`, `dynamodb:GetItem` | EventAlbum table + GSI2 |

---

### downloadZip

Generates a ZIP archive of all event media for host download.

```yaml
Policies:
  - S3CrudPolicy:
      BucketName: !Ref MediaBucket
  - DynamoDBReadPolicy:
      TableName: !Ref EventAlbumTable
```

| Action | Resource |
|---|---|
| `s3:GetObject` | `eventalbum-{env}-media/events/*` |
| `s3:PutObject` | `eventalbum-{env}-media/exports/*` |
| `dynamodb:Query` | EventAlbum table |

---

### getConfig

Returns tier configuration for the frontend.

```yaml
Policies:
  - SSMParameterReadPolicy:
      ParameterName: eventalbum/config/*
```

| Action | Resource |
|---|---|
| `ssm:GetParameter` | `/eventalbum/config/tiers/*`, `/eventalbum/config/pricing` |

---

### deleteEvent / clearAllMedia

Host deletes event or clears all media from an event.

```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref EventAlbumTable
  - S3CrudPolicy:
      BucketName: !Ref MediaBucket
```

| Action | Resource |
|---|---|
| `dynamodb:DeleteItem`, `dynamodb:Query`, `dynamodb:BatchWriteItem` | EventAlbum table |
| `s3:DeleteObject`, `s3:ListObjectsV2` | `eventalbum-{env}-media/events/*` |

---

## SAM Policy Templates Reference

SAM provides shorthand policy templates that expand into properly scoped IAM policies. Always prefer these over inline JSON.

| SAM Template | Expands To | Scope Parameter |
|---|---|---|
| `DynamoDBCrudPolicy` | GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan, BatchWrite, BatchGet | `TableName` |
| `DynamoDBReadPolicy` | GetItem, Query, Scan, BatchGet | `TableName` |
| `S3CrudPolicy` | GetObject, PutObject, DeleteObject, ListBucket | `BucketName` |
| `S3ReadPolicy` | GetObject, ListBucket | `BucketName` |
| `SNSPublishMessagePolicy` | Publish | `TopicArn` |
| `SESCrudPolicy` | SendEmail, SendTemplatedEmail, SendRawEmail | `IdentityName` |
| `SSMParameterReadPolicy` | GetParameter, GetParameters | `ParameterName` (path prefix) |

### Example SAM Function Definition

```yaml
CreateEventFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "EventAlbum-${Environment}-createEvent"
    Handler: src/handlers/createEvent.handler
    Runtime: nodejs22.x
    Architectures:
      - arm64
    MemorySize: 256
    Timeout: 10
    Environment:
      Variables:
        TABLE_NAME: !Ref EventAlbumTable
        ENVIRONMENT: !Ref Environment
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref EventAlbumTable
      - SSMParameterReadPolicy:
          ParameterName: eventalbum/config/*
    Events:
      CreateEvent:
        Type: HttpApi
        Properties:
          ApiId: !Ref HttpApi
          Path: /events
          Method: POST
```

---

## Deploy Role (CI/CD — GitHub Actions)

### IAM User: `eventalbum-deployer`

Used by GitHub Actions to deploy via SAM. Scoped to EventAlbum resources.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResource",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:ListStackResources"
      ],
      "Resource": "arn:aws:cloudformation:us-east-1:<account-id>:stack/EventAlbum-*"
    },
    {
      "Sid": "S3DeployBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::eventalbum-deploy-*",
        "arn:aws:s3:::eventalbum-deploy-*/*"
      ]
    },
    {
      "Sid": "LambdaManagement",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:ListFunctions",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:PublishVersion",
        "lambda:CreateAlias",
        "lambda:UpdateAlias",
        "lambda:TagResource"
      ],
      "Resource": "arn:aws:lambda:us-east-1:<account-id>:function:EventAlbum-*"
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:PassRole",
        "iam:TagRole",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies"
      ],
      "Resource": "arn:aws:iam::<account-id>:role/EventAlbum-*"
    },
    {
      "Sid": "APIGateway",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE",
        "apigateway:PATCH"
      ],
      "Resource": "arn:aws:apigateway:us-east-1::*"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "dynamodb:UpdateTimeToLive",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:TagResource"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:<account-id>:table/EventAlbum-*"
    },
    {
      "Sid": "S3MediaBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketCORS",
        "s3:PutLifecycleConfiguration",
        "s3:PutEncryptionConfiguration",
        "s3:PutBucketVersioning",
        "s3:PutBucketNotification",
        "s3:GetBucketPolicy",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::eventalbum-*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:PutRetentionPolicy",
        "logs:DescribeLogGroups",
        "logs:TagResource"
      ],
      "Resource": "arn:aws:logs:us-east-1:<account-id>:log-group:/aws/lambda/EventAlbum-*"
    },
    {
      "Sid": "CloudFront",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:CreateInvalidation",
        "cloudfront:TagResource"
      ],
      "Resource": "arn:aws:cloudfront::<account-id>:distribution/*"
    },
    {
      "Sid": "EventBridge",
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:DeleteRule",
        "events:PutTargets",
        "events:RemoveTargets",
        "events:DescribeRule"
      ],
      "Resource": "arn:aws:events:us-east-1:<account-id>:rule/EventAlbum-*"
    },
    {
      "Sid": "SSMParameters",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:DeleteParameter"
      ],
      "Resource": "arn:aws:ssm:us-east-1:<account-id>:parameter/eventalbum/*"
    }
  ]
}
```

### Create Deployer User CLI

```bash
aws iam create-user \
  --user-name eventalbum-deployer \
  --profile codersatelier

aws iam put-user-policy \
  --user-name eventalbum-deployer \
  --policy-name EventAlbumDeployPolicy \
  --policy-document file://deploy-policy.json \
  --profile codersatelier

aws iam create-access-key \
  --user-name eventalbum-deployer \
  --profile codersatelier
```

Store the access key ID and secret in GitHub repository secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Security Best Practices

| Practice | Implementation |
|---|---|
| No wildcard resources | All policies scoped to specific ARNs (except Rekognition, SNS SMS) |
| SAM policy templates | Use built-in templates instead of inline JSON |
| Secrets in SSM SecureString | JWT secret, Recurrente keys, CloudFront private key |
| KMS encryption | AWS managed key (free) for SecureString parameters |
| JWT secret rotation | Rotate every 90 days via SSM parameter update |
| No inline policies | All policies defined in SAM template, managed by CloudFormation |
| Deploy role scoped | CI/CD IAM user limited to EventAlbum-* resources |
| No long-lived credentials in code | All secrets loaded from SSM at runtime |
| MFA on AWS root account | Required — not optional |
| Separate AWS accounts | Consider dev/prod account separation for Phase 4+ |

### Verify Permissions CLI

```bash
# Simulate a policy to check if a role can perform an action
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::<account-id>:role/EventAlbum-prod-createEvent-role \
  --action-names dynamodb:PutItem \
  --resource-arns arn:aws:dynamodb:us-east-1:<account-id>:table/EventAlbum-prod \
  --profile codersatelier

# List all roles for EventAlbum
aws iam list-roles \
  --path-prefix /EventAlbum/ \
  --profile codersatelier
```

---

## Cost at Idle

**$0.00/month** — IAM is completely free. No charges for users, roles, policies, or API calls.
