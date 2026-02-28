# Deployment & Infrastructure

## Infrastructure as Code: AWS SAM

**Why SAM over CDK?**
- Simpler for Lambda-centric apps
- YAML templates (less code to maintain)
- Built-in local testing (`sam local invoke`)
- Smaller learning curve
- Converts to CloudFormation under the hood

---

## Project Structure

```
EventAlbum/
├── docs/                          # Plan documents
│   ├── 00-PROJECT-OVERVIEW.md
│   ├── 01-ARCHITECTURE.md
│   ├── 02-DATABASE-SCHEMA.md
│   ├── 03-API-DESIGN.md
│   ├── 04-SECURITY.md
│   ├── 05-PAYMENTS-INTEGRATION.md
│   ├── 06-FRONTEND.md
│   ├── 07-FREEMIUM-MODEL.md
│   ├── 08-COST-ANALYSIS.md
│   ├── 09-DEPLOYMENT.md
│   ├── 10-ROADMAP.md
│   ├── 11-GUEST-OTP-VERIFICATION.md
│   ├── 12-CONTENT-MODERATION.md
│   ├── aws/                       # AWS service configs
│   │   ├── s3.md
│   │   ├── cloudfront.md
│   │   ├── api-gateway.md
│   │   ├── lambda.md
│   │   ├── dynamodb.md
│   │   ├── sns.md
│   │   ├── ses.md
│   │   ├── rekognition.md
│   │   ├── cloudwatch.md
│   │   ├── iam.md
│   │   ├── acm-route53.md
│   │   ├── ssm.md
│   │   └── waf.md
│   └── research/                  # Research & analysis
│       ├── ui-analysis.md
│       ├── workflows-and-sequences.md
│       └── edge-cases.md
├── frontend/                      # React SPA
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # Design system (buttons, inputs, tabs)
│   │   │   ├── layout/            # Sidebar, header, footer
│   │   │   └── shared/            # Reusable (FAB, TabBar, StatusBar)
│   │   ├── pages/
│   │   │   ├── landing/           # Mobile + Desktop landing
│   │   │   ├── guest/             # Guest entry, gallery, upload, media view
│   │   │   ├── admin/             # Dashboard, edit, gallery, QR, customize, moderation, settings
│   │   │   ├── auth/              # Admin login, OTP verify
│   │   │   └── purchase/          # 3-step purchase wizard
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── services/              # API client, upload queue, compression
│   │   ├── stores/                # Zustand stores (auth, event, media)
│   │   ├── styles/                # Design tokens, theme config
│   │   └── utils/                 # Helpers (date, format, validation)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                       # Lambda functions
│   ├── functions/
│   │   ├── createEvent/
│   │   │   └── index.mjs
│   │   ├── authEvent/
│   │   │   └── index.mjs
│   │   ├── getEvent/
│   │   │   └── index.mjs
│   │   ├── updateEvent/
│   │   │   └── index.mjs
│   │   ├── deleteEvent/
│   │   │   └── index.mjs
│   │   ├── updateSettings/
│   │   │   └── index.mjs
│   │   ├── getUploadUrl/
│   │   │   └── index.mjs
│   │   ├── processUpload/         # S3 trigger (thumbnails + moderation)
│   │   │   └── index.mjs
│   │   ├── listMedia/
│   │   │   └── index.mjs
│   │   ├── deleteMedia/
│   │   │   └── index.mjs
│   │   ├── bulkDeleteMedia/
│   │   │   └── index.mjs
│   │   ├── clearAllMedia/
│   │   │   └── index.mjs
│   │   ├── searchMedia/
│   │   │   └── index.mjs
│   │   ├── reportMedia/
│   │   │   └── index.mjs
│   │   ├── moderateMedia/
│   │   │   └── index.mjs
│   │   ├── addReaction/
│   │   │   └── index.mjs
│   │   ├── addComment/
│   │   │   └── index.mjs
│   │   ├── listComments/
│   │   │   └── index.mjs
│   │   ├── sendOtp/
│   │   │   └── index.mjs
│   │   ├── verifyOtp/
│   │   │   └── index.mjs
│   │   ├── hostLogin/
│   │   │   └── index.mjs
│   │   ├── hostVerify/
│   │   │   └── index.mjs
│   │   ├── getStats/
│   │   │   └── index.mjs
│   │   ├── getActivity/
│   │   │   └── index.mjs
│   │   ├── getQrStats/
│   │   │   └── index.mjs
│   │   ├── getStorage/
│   │   │   └── index.mjs
│   │   ├── downloadZip/
│   │   │   └── index.mjs
│   │   ├── createCheckout/
│   │   │   └── index.mjs
│   │   ├── handleWebhook/
│   │   │   └── index.mjs
│   │   ├── validatePromo/
│   │   │   └── index.mjs
│   │   ├── getConfig/
│   │   │   └── index.mjs
│   │   ├── notifyUploads/         # EventBridge: batch upload notifications
│   │   │   └── index.mjs
│   │   ├── eventSummary/          # EventBridge: post-event summary email
│   │   │   └── index.mjs
│   │   └── cleanupExpired/        # EventBridge: S3 cleanup for expired events
│   │       └── index.mjs
│   ├── shared/                    # Shared utilities
│   │   ├── dynamodb.mjs           # DynamoDB client + helpers
│   │   ├── auth.mjs               # JWT sign/verify, password hashing
│   │   ├── response.mjs           # HTTP response builder
│   │   ├── config.mjs             # SSM config loader (cached)
│   │   ├── email.mjs              # SES email sender
│   │   ├── validation.mjs         # Input validation schemas
│   │   └── logger.mjs             # Structured JSON logger
│   ├── layers/
│   │   ├── sharp/                 # Image processing layer (ARM64)
│   │   └── bcrypt/                # Password hashing layer (ARM64)
│   └── package.json
├── template.yaml                  # SAM template
├── samconfig.toml                 # SAM deployment config
└── events/                        # SAM local test events
    ├── create-event.json
    ├── auth-event.json
    ├── upload-url.json
    └── webhook.json
```

---

## SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: EventAlbum - Serverless Event Media Platform

Globals:
  Function:
    Runtime: nodejs22.x
    Architectures: [arm64]
    MemorySize: 128
    Timeout: 10
    Environment:
      Variables:
        TABLE_NAME: !Ref EventAlbumTable
        MEDIA_BUCKET: !Ref MediaBucket
        CLOUDFRONT_DOMAIN: !GetAtt MediaDistribution.DomainName
        SES_FROM_EMAIL: !Sub noreply@eventalbum.app
        STAGE: !Ref Environment
    Layers:
      - !Ref SharedUtilsLayer

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]

Resources:

  # === LAYERS ===
  SharedUtilsLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: !Sub EventAlbum-shared-${Environment}
      ContentUri: backend/shared/
      CompatibleRuntimes: [nodejs22.x]
      CompatibleArchitectures: [arm64]

  SharpLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: !Sub EventAlbum-sharp-${Environment}
      ContentUri: backend/layers/sharp/
      CompatibleRuntimes: [nodejs22.x]
      CompatibleArchitectures: [arm64]

  # === API ===
  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Environment
      CorsConfiguration:
        AllowOrigins:
          - https://eventalbum.app
          - https://staging.eventalbum.app
        AllowMethods:
          - GET
          - POST
          - PATCH
          - DELETE
          - OPTIONS
        AllowHeaders:
          - Authorization
          - Content-Type
          - X-Confirm-Delete
          - X-Request-Id
      ThrottlingBurstLimit: 100
      ThrottlingRateLimit: 50
      AccessLogSettings:
        DestinationArn: !GetAtt ApiAccessLogGroup.Arn

  # === PUBLIC ENDPOINTS (No Auth) ===

  CreateEventFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-createEvent
      CodeUri: backend/functions/createEvent/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/*
        - Statement:
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  AuthEventFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-authEvent
      CodeUri: backend/functions/authEvent/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/auth
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/jwt-secret

  HostLoginFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-hostLogin
      CodeUri: backend/functions/hostLogin/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /auth/host/login
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - Statement:
            - Effect: Allow
              Action: dynamodb:Query
              Resource: !Sub ${EventAlbumTable.Arn}/index/GSI1
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  HostVerifyFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-hostVerify
      CodeUri: backend/functions/hostVerify/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /auth/host/verify
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - Statement:
            - Effect: Allow
              Action: dynamodb:Query
              Resource: !Sub ${EventAlbumTable.Arn}/index/GSI1
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/jwt-secret

  GetConfigFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getConfig
      CodeUri: backend/functions/getConfig/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /config
            Method: GET
      Policies:
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/*

  ValidatePromoFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-validatePromo
      CodeUri: backend/functions/validatePromo/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/promo
            Method: POST
      Policies:
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/discounts

  WebhookFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-handleWebhook
      CodeUri: backend/functions/handleWebhook/
      Handler: index.handler
      Timeout: 15
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /webhooks/recurrente
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/recurrente-*
        - Statement:
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  # === AUTHENTICATED ENDPOINTS ===

  GetEventFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getEvent
      CodeUri: backend/functions/getEvent/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/cf-*

  UpdateEventFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-updateEvent
      CodeUri: backend/functions/updateEvent/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}
            Method: PATCH
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable

  DeleteEventFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-deleteEvent
      CodeUri: backend/functions/deleteEvent/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}
            Method: DELETE
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket

  UpdateSettingsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-updateSettings
      CodeUri: backend/functions/updateSettings/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/settings
            Method: PATCH
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/tiers/*

  # === MEDIA ENDPOINTS ===

  GetUploadUrlFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getUploadUrl
      CodeUri: backend/functions/getUploadUrl/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/upload-url
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/tiers/*

  ProcessUploadFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-processUpload
      CodeUri: backend/functions/processUpload/
      Handler: index.handler
      MemorySize: 512
      Timeout: 60
      Layers:
        - !Ref SharpLayer
      Events:
        S3Event:
          Type: S3
          Properties:
            Bucket: !Ref MediaBucket
            Events: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Name: prefix
                    Value: events/
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/tiers/*
        - Statement:
            - Effect: Allow
              Action: rekognition:DetectModerationLabels
              Resource: "*"
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  ListMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-listMedia
      CodeUri: backend/functions/listMedia/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/cf-*

  DeleteMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-deleteMedia
      CodeUri: backend/functions/deleteMedia/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/{mediaId}
            Method: DELETE
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket

  BulkDeleteMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-bulkDeleteMedia
      CodeUri: backend/functions/bulkDeleteMedia/
      Handler: index.handler
      Timeout: 30
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/bulk-delete
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket

  ClearAllMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-clearAllMedia
      CodeUri: backend/functions/clearAllMedia/
      Handler: index.handler
      Timeout: 60
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media
            Method: DELETE
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket

  SearchMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-searchMedia
      CodeUri: backend/functions/searchMedia/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/search
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable

  ReportMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-reportMedia
      CodeUri: backend/functions/reportMedia/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/{mediaId}/report
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - Statement:
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  ModerateMediaFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-moderateMedia
      CodeUri: backend/functions/moderateMedia/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/{mediaId}/moderate
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket

  # === REACTIONS & COMMENTS ===

  AddReactionFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-addReaction
      CodeUri: backend/functions/addReaction/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/{mediaId}/reactions
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable

  AddCommentFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-addComment
      CodeUri: backend/functions/addComment/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/{mediaId}/comments
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable

  ListCommentsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-listComments
      CodeUri: backend/functions/listComments/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/media/{mediaId}/comments
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable

  # === OTP ===

  SendOtpFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-sendOtp
      CodeUri: backend/functions/sendOtp/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/otp/send
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - Statement:
            - Effect: Allow
              Action: sns:Publish
              Resource: "*"
              Condition:
                StringEquals:
                  sns:Protocol: sms
            - Effect: Allow
              Action: [ses:SendEmail, ses:SendTemplatedEmail]
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  VerifyOtpFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-verifyOtp
      CodeUri: backend/functions/verifyOtp/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/otp/verify
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/jwt-secret

  # === HOST DASHBOARD ===

  GetStatsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getStats
      CodeUri: backend/functions/getStats/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/stats
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable

  GetActivityFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getActivity
      CodeUri: backend/functions/getActivity/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/activity
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable

  GetQrStatsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getQrStats
      CodeUri: backend/functions/getQrStats/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/qr-stats
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable

  GetStorageFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-getStorage
      CodeUri: backend/functions/getStorage/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/storage
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable

  # === PAYMENTS ===

  CreateCheckoutFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-createCheckout
      CodeUri: backend/functions/createCheckout/
      Handler: index.handler
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/checkout
            Method: POST
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/recurrente-*
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/pricing
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/config/discounts

  # === ZIP DOWNLOAD ===

  DownloadZipFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-downloadZip
      CodeUri: backend/functions/downloadZip/
      Handler: index.handler
      MemorySize: 512
      Timeout: 120
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /events/{eventId}/download-zip
            Method: POST
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket
        - SSMParameterReadPolicy:
            ParameterName: eventalbum/secrets/cf-*

  # === SCHEDULED FUNCTIONS (EventBridge) ===

  NotifyUploadsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-notifyUploads
      CodeUri: backend/functions/notifyUploads/
      Handler: index.handler
      Timeout: 60
      Events:
        Schedule:
          Type: ScheduleV2
          Properties:
            ScheduleExpression: rate(30 minutes)
            State: ENABLED
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - Statement:
            - Effect: Allow
              Action: dynamodb:Scan
              Resource: !GetAtt EventAlbumTable.Arn
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  EventSummaryFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-eventSummary
      CodeUri: backend/functions/eventSummary/
      Handler: index.handler
      Timeout: 60
      Events:
        Schedule:
          Type: ScheduleV2
          Properties:
            ScheduleExpression: rate(1 day)
            State: ENABLED
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - Statement:
            - Effect: Allow
              Action: dynamodb:Scan
              Resource: !GetAtt EventAlbumTable.Arn
            - Effect: Allow
              Action: ses:SendTemplatedEmail
              Resource: !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/eventalbum.app

  CleanupExpiredFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub EventAlbum-${Environment}-cleanupExpired
      CodeUri: backend/functions/cleanupExpired/
      Handler: index.handler
      Timeout: 120
      Events:
        Schedule:
          Type: ScheduleV2
          Properties:
            ScheduleExpression: rate(1 day)
            State: ENABLED
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref EventAlbumTable
        - S3CrudPolicy:
            BucketName: !Ref MediaBucket

  # === DATABASE ===
  EventAlbumTable:
    Type: AWS::DynamoDB::Table
    DeletionPolicy: Retain
    Properties:
      TableName: !Sub EventAlbum-${Environment}
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: GSI1PK
          AttributeType: S
        - AttributeName: GSI1SK
          AttributeType: S
        - AttributeName: GSI2PK
          AttributeType: S
        - AttributeName: GSI2SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - AttributeName: GSI1PK
              KeyType: HASH
            - AttributeName: GSI1SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: GSI2
          KeySchema:
            - AttributeName: GSI2PK
              KeyType: HASH
            - AttributeName: GSI2SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        AttributeName: expiresAtTTL
        Enabled: true
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: !If [IsProd, true, false]

  # === STORAGE ===
  MediaBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain
    Properties:
      BucketName: !Sub eventalbum-media-${Environment}
      OwnershipControls:
        Rules:
          - ObjectOwnership: BucketOwnerEnforced
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      CorsConfiguration:
        CorsRules:
          - AllowedOrigins:
              - https://eventalbum.app
              - https://staging.eventalbum.app
            AllowedMethods: [PUT]
            AllowedHeaders: [Content-Type]
            ExposeHeaders: [ETag]
            MaxAge: 3600
      LifecycleConfiguration:
        Rules:
          - Id: CleanupIncompleteUploads
            Status: Enabled
            AbortIncompleteMultipartUpload:
              DaysAfterInitiation: 1
          - Id: CleanupExports
            Status: Enabled
            Prefix: exports/
            ExpirationInDays: 7

  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub eventalbum-frontend-${Environment}
      OwnershipControls:
        Rules:
          - ObjectOwnership: BucketOwnerEnforced
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  # === CDN ===
  MediaDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Comment: !Sub EventAlbum Media CDN - ${Environment}
        DefaultCacheBehavior:
          TargetOriginId: MediaS3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
          Compress: true
        Origins:
          - Id: MediaS3Origin
            DomainName: !GetAtt MediaBucket.RegionalDomainName
            OriginAccessControlId: !Ref MediaOAC
            S3OriginConfig:
              OriginAccessIdentity: ""
        HttpVersion: http2and3
        PriceClass: PriceClass_100

  MediaOAC:
    Type: AWS::CloudFront::OriginAccessControl
    Properties:
      OriginAccessControlConfig:
        Name: !Sub EventAlbum-MediaOAC-${Environment}
        OriginAccessControlOriginType: s3
        SigningBehavior: always
        SigningProtocol: sigv4

  MediaBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref MediaBucket
      PolicyDocument:
        Statement:
          - Sid: AllowCloudFrontServicePrincipal
            Effect: Allow
            Principal:
              Service: cloudfront.amazonaws.com
            Action: s3:GetObject
            Resource: !Sub ${MediaBucket.Arn}/*
            Condition:
              StringEquals:
                AWS:SourceArn: !Sub arn:aws:cloudfront::${AWS::AccountId}:distribution/${MediaDistribution}

  # === LOGGING ===
  ApiAccessLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub /aws/apigateway/EventAlbum-${Environment}
      RetentionInDays: 30

Conditions:
  IsProd: !Equals [!Ref Environment, prod]

Outputs:
  ApiUrl:
    Value: !Sub https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}
  MediaBucketName:
    Value: !Ref MediaBucket
  FrontendBucketName:
    Value: !Ref FrontendBucket
  MediaDistributionDomain:
    Value: !GetAtt MediaDistribution.DomainName
  TableName:
    Value: !Ref EventAlbumTable
```

---

## Lambda Function Summary

| # | Function | Route | Trigger | Memory | Timeout |
|---|---|---|---|---|---|
| 1 | createEvent | POST /events | HTTP | 128 | 10s |
| 2 | authEvent | POST /events/{id}/auth | HTTP | 128 | 10s |
| 3 | getEvent | GET /events/{id} | HTTP | 128 | 10s |
| 4 | updateEvent | PATCH /events/{id} | HTTP | 128 | 10s |
| 5 | deleteEvent | DELETE /events/{id} | HTTP | 128 | 10s |
| 6 | updateSettings | PATCH /events/{id}/settings | HTTP | 128 | 10s |
| 7 | getUploadUrl | POST /events/{id}/upload-url | HTTP | 128 | 10s |
| 8 | processUpload | - | S3 trigger | 512 | 60s |
| 9 | listMedia | GET /events/{id}/media | HTTP | 128 | 10s |
| 10 | deleteMedia | DELETE /events/{id}/media/{mid} | HTTP | 128 | 10s |
| 11 | bulkDeleteMedia | POST /events/{id}/media/bulk-delete | HTTP | 128 | 30s |
| 12 | clearAllMedia | DELETE /events/{id}/media | HTTP | 128 | 60s |
| 13 | searchMedia | GET /events/{id}/media/search | HTTP | 128 | 10s |
| 14 | reportMedia | POST /events/{id}/media/{mid}/report | HTTP | 128 | 10s |
| 15 | moderateMedia | POST /events/{id}/media/{mid}/moderate | HTTP | 128 | 10s |
| 16 | addReaction | POST /events/{id}/media/{mid}/reactions | HTTP | 128 | 10s |
| 17 | addComment | POST /events/{id}/media/{mid}/comments | HTTP | 128 | 10s |
| 18 | listComments | GET /events/{id}/media/{mid}/comments | HTTP | 128 | 10s |
| 19 | sendOtp | POST /events/{id}/otp/send | HTTP | 128 | 10s |
| 20 | verifyOtp | POST /events/{id}/otp/verify | HTTP | 128 | 10s |
| 21 | hostLogin | POST /auth/host/login | HTTP | 128 | 10s |
| 22 | hostVerify | POST /auth/host/verify | HTTP | 128 | 10s |
| 23 | getStats | GET /events/{id}/stats | HTTP | 128 | 10s |
| 24 | getActivity | GET /events/{id}/activity | HTTP | 128 | 10s |
| 25 | getQrStats | GET /events/{id}/qr-stats | HTTP | 128 | 10s |
| 26 | getStorage | GET /events/{id}/storage | HTTP | 128 | 10s |
| 27 | createCheckout | POST /events/{id}/checkout | HTTP | 128 | 10s |
| 28 | handleWebhook | POST /webhooks/recurrente | HTTP | 128 | 15s |
| 29 | validatePromo | POST /events/{id}/promo | HTTP | 128 | 10s |
| 30 | downloadZip | POST /events/{id}/download-zip | HTTP | 512 | 120s |
| 31 | getConfig | GET /config | HTTP | 128 | 10s |
| 32 | notifyUploads | - | EventBridge (30 min) | 128 | 60s |
| 33 | eventSummary | - | EventBridge (daily) | 128 | 60s |
| 34 | cleanupExpired | - | EventBridge (daily) | 128 | 120s |

**Total: 34 Lambda functions** (31 HTTP-triggered + 1 S3-triggered + 3 scheduled)

---

## Deployment Commands

### Prerequisites

```bash
# Install SAM CLI
brew install aws-sam-cli

# Verify AWS profile
aws sts get-caller-identity --profile codersatelier
```

### First Deploy

```bash
# Build
sam build

# Deploy (guided first time)
sam deploy --guided \
  --profile codersatelier \
  --stack-name eventalbum-dev \
  --parameter-overrides Environment=dev
```

### Subsequent Deploys

```bash
sam build && sam deploy --profile codersatelier
```

### Frontend Deploy

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://eventalbum-frontend-dev/ --delete --profile codersatelier
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*" --profile codersatelier
```

### Local Development

```bash
# Start local API (all functions)
sam local start-api --env-vars env.json --profile codersatelier

# Invoke single function with test event
sam local invoke CreateEventFunction --event events/create-event.json --profile codersatelier
```

---

## Environments

| Environment | Domain | API | Keys | PITR |
|---|---|---|---|---|
| dev | localhost:5173 | SAM local | Recurrente TEST | Off |
| staging | staging.eventalbum.app | API Gateway | Recurrente TEST | Off |
| prod | eventalbum.app | API Gateway | Recurrente LIVE | On |

---

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/setup-sam@v2
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      # Backend
      - run: sam build
      - run: sam deploy --no-confirm-changeset --no-fail-on-empty-changeset

      # Frontend
      - run: cd frontend && npm ci && npm run build
      - run: aws s3 sync frontend/dist/ s3://eventalbum-frontend-prod/ --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DIST_ID }} --paths "/*"
```
