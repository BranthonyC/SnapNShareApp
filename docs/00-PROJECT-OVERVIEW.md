# EventAlbum - Project Overview

## Product Name (Working Title): EventAlbum

**Tagline:** La plataforma digital de recuerdos para eventos fisicos.

## What Is It?

A serverless, QR-powered private event media platform. Guests scan a QR code and instantly upload photos, videos, and audio to a shared event gallery — no app download required.

## How It Works

1. **Host creates an event** → receives a unique Event ID + admin password
2. **A QR code is generated** → encodes the event URL with guest access
3. **Guests scan the QR** → enter the guest password → upload media instantly
4. **Everyone interacts** → react, comment, send stickers, gifts
5. **Host manages everything** → custom welcome card, moderation, downloads

## Core Value Proposition

| For Guests | For Hosts |
|---|---|
| Scan QR → upload instantly | Full event control via admin password |
| React, comment, send gifts | Customizable welcome page |
| No account or app required | Event start/end dates |
| Real-time shared gallery | Moderation tools |
| | Download full archive |

## The Problem

- Media is fragmented across WhatsApp, Instagram, and personal phones
- Hosts rarely collect all the memories from their events
- Guests hesitate to download new apps
- Shared drives (Google Drive, etc.) feel technical and impersonal
- No simple, beautiful, real-time, event-specific memory hub exists

## Target Market

- Weddings
- Private parties (birthdays, quinceañeras, baby showers)
- Corporate events
- Conferences
- Festivals
- Brand activations

**Primary geography:** Guatemala / LATAM, expandable to US.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React (static SPA) on S3 + CloudFront |
| API | API Gateway (HTTP API) + Lambda |
| Database | DynamoDB (on-demand) |
| Storage | S3 (private, presigned URLs) |
| CDN | CloudFront (signed URLs for reads) |
| Payments | Recurrente API (GTQ + USD) |
| IaC | AWS SAM or CDK |

## Key Design Principles

1. **Near-zero idle cost** — fully serverless, pay only for usage
2. **Security first** — private S3, presigned URLs, password hashing, WAF
3. **Client-side heavy** — compress images before upload, IndexedDB for offline
4. **Cost-controlled tiers** — video = paid only, hard upload caps, auto-deletion
5. **No exposed credentials** — Lambda IAM roles only, no keys in frontend
