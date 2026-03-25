# Booster Vault Monorepo

Zero-knowledge **photo/media vault** + **Life Docs** (Non-AI MVP) — secure, private storage with **client-side encryption**.

## Project Structure

This is a pnpm workspace monorepo with the following packages:

- **`apps/api`** – NestJS REST API (PostgreSQL + Prisma)
- **`apps/web`** – React/Vite web client (vault UI + Life Docs + sharing viewer)
- **`packages/shared`** – Shared TypeScript types and utilities
- **`packages/config`** – Shared ESLint, Prettier, and TypeScript configs

## Major Product Areas

### Vault (core)
- Encrypted uploads/downloads via signed URLs (S3-compatible)
- Albums, timeline, search (non-AI)
- Trash + purge lifecycle
- Exports (encrypted ZIP + manifest)
- Read-only public sharing (passphrase unlock client-side)
- Encrypted thumbnails + thumbnail-first browsing

### Life Docs
- Structured “life records” module (secure document entries with metadata)
- Search + timeline-style views, versioning, and reminders

### Continuity (related to Life Docs)
- Owner “packs/policies/releases” and heir access flows (some TODOs remain; see Memory Bank)

## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+
- PostgreSQL 14+ (local or Docker)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

Copy the example environment file and adjust as needed:

```bash
cp .env.example .env
```

Edit `.env` and set at least `DATABASE_URL` to point to your PostgreSQL instance.

### 3. Set up PostgreSQL

You can run PostgreSQL locally via Docker:

```bash
docker run -d \
  --name booster-vault-db \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=booster_vault \
  -p 5432:5432 \
  postgres:14-alpine
```

Or install PostgreSQL locally and create a database:

```sql
CREATE DATABASE booster_vault;
```

### 3.1 Run Redis (required for background jobs)

Background processing (exports, trash purge, thumbnail verification) uses BullMQ + Redis.

Run Redis locally via Docker:

```bash
docker run -d \
  --name booster-vault-redis \
  -p 6379:6379 \
  redis:7-alpine
```

Set `REDIS_URL=redis://localhost:6379` in your `.env`.

### 4. Generate Prisma client and run migrations

```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate:dev --name init
```

### 5. Start the development servers

From the root directory:

```bash
pnpm dev
```

This starts:
- API on `http://localhost:4000`
- Web UI on `http://localhost:3000`

### 5.1 Start the background workers (separate process)

In another terminal from the repo root:

```bash
pnpm worker
```

Or from `apps/api`:

```bash
cd apps/api
pnpm dev:worker
```

### 6. Verify the API is running

```bash
curl http://localhost:4000/v1/health
```

Should return `{"ok": true}`.

### 6.1 Verify background queue connectivity

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:4000/v1/queue/health
```

Returns Redis ping status plus queue counts/repeatables.

It also reports **worker heartbeat** (stored in Postgres) so you can verify a worker process is actively checking in.

Worker heartbeats are automatically cleaned up (retention controlled by `WORKER_HEARTBEAT_RETENTION_HOURS`).

## Development

## Document previews & thumbnails

Supported document formats (by tier, including preview + thumbnail behavior):
- [docs/vault/document-tiers.md](docs/vault/document-tiers.md)

### Large uploads (resumable / multipart)

The web app can upload large media using S3 Multipart Upload when the API reports it as supported.

- Multipart is only available when the API is using an S3-compatible driver (DigitalOcean Spaces / AWS S3 / MinIO).
- If you run the API with `STORAGE_DRIVER=local`, uploads use the existing single `PUT` signed URL flow (no multipart).
- For multipart to work in browsers, your bucket CORS must expose the `ETag` header on `PUT` responses (the client needs it to complete the multipart upload).

Related implementation:
- Web upload switch: [apps/web/src/components/UploadDialog.tsx](apps/web/src/components/UploadDialog.tsx)
- Multipart API endpoints: [apps/api/src/media/media.controller.ts](apps/api/src/media/media.controller.ts)

### Available scripts (from root)

- `pnpm build` – Build all packages
- `pnpm dev` – Start all packages in dev mode
- `pnpm worker` – Start API background workers (processors + schedulers)
- `pnpm lint` – Lint all packages
- `pnpm test` – Run tests (placeholder)
- `pnpm clean` – Clean all builds

### API development

```bash
cd apps/api
pnpm dev              # Start NestJS with hot reload
pnpm dev:worker       # Start BullMQ processors/schedulers (hot reload)
pnpm prisma:studio    # Open Prisma Studio GUI
pnpm test             # Run API tests
```

### Web UI development

```bash
cd apps/web
pnpm dev              # Start Vite dev server
```

## Environment Variables

See `.env.example` for all required variables.

### DigitalOcean Spaces (S3) setup

Booster Vault uploads media directly from the browser to your S3-compatible bucket using signed URLs. For DigitalOcean Spaces, configure a Space and an access key, then set these env vars:

- `S3_ENDPOINT` = `https://<region>.digitaloceanspaces.com` (example: `https://nyc3.digitaloceanspaces.com`)
- `S3_REGION` = `us-east-1` (AWS SDK requires a region string; Spaces uses the custom endpoint)
- `S3_BUCKET` = your Space name
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` = your Spaces access key pair
- `S3_FORCE_PATH_STYLE` = `false`

If you want to force S3 and fail fast when misconfigured, set `STORAGE_DRIVER=s3`.

**CORS (required for browser uploads):** in the Space settings, allow your web origin to `PUT` and `GET` objects and expose `ETag`.

AWS-compatible XML example:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

### Core Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:password@localhost:5432/booster_vault` |
| `PORT` | API server port | `4000` |
| `WEB_ORIGIN` | Web UI origin (for CORS) | `http://localhost:3000` |
| `WEB_APP_URL` | Web app base URL for email links | `http://localhost:3000` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

### Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for signing JWTs (min 32 chars) | `change-this-in-production-must-be-32-characters-minimum` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `30d` |
| `PASSWORD_HASHING_ALGORITHM` | Password hashing algorithm (`argon2id` or `bcrypt`) | `argon2id` |

### Email (Development)

| Variable | Description | Default |
|----------|-------------|---------|
| `MAILER_PROVIDER` | Mailer provider (`console` for dev) | `console` |
| `MAILER_FROM_EMAIL` | Sender email address | `noreply@boostervault.com` |
| `VERIFICATION_SUCCESS_PATH` | Path for verification success page | `/verify-success` |
| `PASSWORD_RESET_PATH` | Path for password reset page | `/reset-password` |

## Development Email Setup

During development, email sending is handled by a console mailer that prints emails to the terminal. This means:

1. **No external email service required** for development
2. **Verification and password reset links** are printed to the console when you trigger those flows
3. **To see "emails" in console**: Look for log output when running the API server that includes "Sending email" or "Email sent" messages

Example console output when requesting email verification:
```
[Sending email] Verification email sent to user@example.com
Verification URL: http://localhost:3000/verify-success?token=abc123...
```

To test email flows:
1. Start the API server with `pnpm dev` from the root or `cd apps/api && pnpm dev`
2. Trigger email verification or password reset via the API
3. Check the terminal where the API is running for the email content and links

## Architecture

### Zero-Knowledge Design

- All media encryption/decryption happens client‑side
- Server stores only encrypted blobs and metadata
- No AI/ML, facial recognition, or content analysis
- Full‑text search limited to user‑provided text (titles, notes, locations)

### Technology Stack

- **Backend**: NestJS (TypeScript), PostgreSQL, Prisma ORM
- **Frontend**: React, Vite, TypeScript
- **Storage**: S3‑compatible object storage (via signed URLs)
- **Auth**: JWT, bcrypt/argon2id
- **Payments**: crypto invoices + Stripe checkout/webhooks

## API Specification

The complete API is defined in OpenAPI 3.0 format at `api/openapi.yaml`.

### Exports API Examples

The exports API allows users to create and download backups of their media. All endpoints require JWT authentication.

#### Authentication
First, obtain a JWT token by logging in:
```bash
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'
```

Use the returned `accessToken` in subsequent requests:
```bash
export TOKEN="your-jwt-token-here"
```

#### 1. List Exports
```bash
curl -X GET "http://localhost:4000/v1/exports?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2. Create Export
Create a vault export (all non-trashed media):
```bash
curl -X POST http://localhost:4000/v1/exports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scopeType": "VAULT"
  }'
```

Create an album export:
```bash
curl -X POST http://localhost:4000/v1/exports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scopeType": "ALBUM",
    "scopeAlbumId": "album-uuid-here"
  }'
```

Create a date range export:
```bash
curl -X POST http://localhost:4000/v1/exports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scopeType": "DATE_RANGE",
    "scopeFrom": "2024-01-01T00:00:00.000Z",
    "scopeTo": "2024-12-31T23:59:59.999Z"
  }'
```

**Export Types:**
- `VAULT`: All non-trashed media for the user
- `ALBUM`: All non-trashed media in a specific album
- `DATE_RANGE`: All non-trashed media where `COALESCE(takenAt, createdAt)` falls within the specified range

**Rate Limiting:**
- Maximum 2 active (QUEUED+RUNNING) export jobs per user

#### 3. Get Export Status
```bash
curl -X GET http://localhost:4000/v1/exports/{exportId} \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Generate Download URL
Once the export status is `READY`, generate a signed download URL:
```bash
curl -X POST http://localhost:4000/v1/exports/{exportId}/download-url \
  -H "Authorization: Bearer $TOKEN"
```

**Notes:**
- Exports expire after 7 days (configurable via `EXPORT_TTL_DAYS`)
- Download URLs expire after 15 minutes (configurable via `EXPORT_DOWNLOAD_URL_TTL_SECONDS`)
- The ZIP file contains ciphertext media files + a manifest.json with metadata
- Export processing runs in background; check status via GET endpoint

#### Export Manifest Example
```json
{
  "exportId": "export-uuid",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "items": [
    {
      "mediaId": "media-uuid",
      "objectKey": "u/user-uuid/media/media-uuid.bin",
      "originalFilename": "photo.jpg",
      "contentType": "image/jpeg",
      "byteSize": 1048576,
      "takenAt": "2024-01-15T10:00:00.000Z",
      "locationText": "Beach, California",
      "title": "Sunset at the beach",
      "note": "Beautiful sunset with friends"
    }
  ],
  "albums": [
    {
      "albumId": "album-uuid",
      "name": "Vacation 2024",
      "description": "Summer vacation photos"
    }
  ]
}
```

#### Environment Variables for Exports
| Variable | Description | Default |
|----------|-------------|---------|
| `EXPORT_TTL_DAYS` | Days before exports are auto-expired | `7` |
| `EXPORT_DOWNLOAD_URL_TTL_SECONDS` | Seconds download URLs are valid | `900` (15 min) |
| `EXPORT_WORKER_INTERVAL_SECONDS` | Background worker polling interval | `10` |
| `EXPORT_CLEANUP_INTERVAL_HOURS` | Expired exports cleanup interval | `24` |
| `EXPORT_MAX_ACTIVE_JOBS_PER_USER` | Max QUEUED+RUNNING jobs per user | `2` |

### Albums API Examples

The albums API allows users to organize media into albums with manual ordering. All endpoints require JWT authentication.

#### Authentication
First, obtain a JWT token by logging in:
```bash
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'
```

Use the returned `accessToken` in subsequent requests:
```bash
export TOKEN="your-jwt-token-here"
```

#### 1. List Albums
```bash
curl -X GET "http://localhost:4000/v1/albums?includeDeleted=false&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2. Create Album
```bash
curl -X POST http://localhost:4000/v1/albums \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vacation 2024",
    "description": "Photos from summer vacation",
    "coverMediaId": "optional-media-uuid"
  }'
```

#### 3. Get Album
```bash
curl -X GET http://localhost:4000/v1/albums/{albumId} \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Update Album
```bash
curl -X PATCH http://localhost:4000/v1/albums/{albumId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Album Name",
    "description": "Updated description"
  }'
```

#### 5. Delete Album (Soft Delete)
```bash
curl -X DELETE http://localhost:4000/v1/albums/{albumId} \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. List Album Items
```bash
curl -X GET "http://localhost:4000/v1/albums/{albumId}/items?includeTrashed=false&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Add Items to Album
```bash
curl -X POST http://localhost:4000/v1/albums/{albumId}/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaIds": ["media-uuid-1", "media-uuid-2"]
  }'
```

#### 8. Remove Item from Album
```bash
curl -X DELETE "http://localhost:4000/v1/albums/{albumId}/items?mediaId={mediaId}" \
  -H "Authorization: Bearer $TOKEN"
```

#### 9. Reorder Album Items
```bash
curl -X POST http://localhost:4000/v1/albums/{albumId}/items/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"mediaId": "media-uuid-1", "position": 1000},
      {"mediaId": "media-uuid-2", "position": 2000}
    ]
  }'
```

**Note:** All endpoints enforce strict ownership - users can only access their own albums and media.

### Browse/Timeline/Search API Examples

The browse API provides timeline and search functionality for media. All endpoints require JWT authentication.

#### 1. Timeline - Get Media Timeline
Get media ordered by takenAt/createdAt DESC with optional filters.
```bash
# Get timeline (default limit 50, max 200)
curl -X GET "http://localhost:4000/v1/timeline?limit=30" \
  -H "Authorization: Bearer $TOKEN"

# Filter by year (2024)
curl -X GET "http://localhost:4000/v1/timeline?year=2024&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Filter by album (only media in specific album)
curl -X GET "http://localhost:4000/v1/timeline?albumId={albumId}&limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Pagination with cursor
curl -X GET "http://localhost:4000/v1/timeline?limit=50&cursor={cursor}" \
  -H "Authorization: Bearer $TOKEN"
```

**Features:**
- Returns media ordered by takenAt DESC, then createdAt DESC, then id DESC
- Excludes trashed media by default
- If year provided: filters takenAt between [year-01-01, year+1-01-01)
- If takenAt is null, uses createdAt for ordering and filtering
- If albumId provided: validates album belongs to user and is not deleted
- Supports cursor-based pagination

#### 2. Search - Full-text Search
Search media by title, note, location, filename, or album name.
```bash
# Basic search
curl -X GET "http://localhost:4000/v1/search?q=beach%20sunset&limit=30" \
  -H "Authorization: Bearer $TOKEN"

# Search with date range
curl -X GET "http://localhost:4000/v1/search?q=vacation&from=2024-01-01&to=2024-12-31&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Search within specific album
curl -X GET "http://localhost:4000/v1/search?q=family&albumId={albumId}&limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Pagination with cursor
curl -X GET "http://localhost:4000/v1/search?q=search%20term&limit=50&cursor={cursor}" \
  -H "Authorization: Bearer $TOKEN"
```

**Features:**
- Searches: title, note, locationText, originalFilename, album.name (if albumId not provided)
- Excludes trashed media by default
- Uses PostgreSQL full-text search with ranking
- Orders by relevance (ts_rank) then takenAt/createdAt DESC
- Supports date range filtering
- Supports cursor-based pagination
- Validates album ownership if albumId provided

## Billing API Examples

The billing API supports crypto payments (primary) and Stripe fallback with +4% card processing fee. All endpoints require JWT authentication except webhooks.

### Authentication
First, obtain a JWT token by logging in:
```bash
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'
```

Use the returned `accessToken` in subsequent requests:
```bash
export TOKEN="your-jwt-token-here"
```

### 1. Get Available Plans
Returns only exposed plans (P6M_25, Y1_100, Y1_199). Y5_500 and Y1_1000 are internal only.
```bash
curl -X GET http://localhost:4000/v1/billing/plans \
  -H "Authorization: Bearer $TOKEN"
```

**Response Example:**
```json
[
  {
    "code": "P6M_25",
    "name": "6 Months",
    "priceCents": 2500,
    "interval": "month",
    "features": [
      "Unlimited photo storage",
      "Unlimited video storage",
      "Client-side encryption",
      "Album organization",
      "Timeline view",
      "Basic search",
      "Export capabilities"
    ]
  }
]
```

### 2. Create Crypto Invoice (Primary Payment Method)
Create a crypto invoice valid for 60 minutes.
```bash
curl -X POST http://localhost:4000/v1/billing/crypto/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode": "P6M_25"}'
```

**Response Example:**
```json
{
  "invoiceId": "invoice-uuid",
  "amountCents": 2500,
  "currency": "USD",
  "paymentAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "expiresAt": "2024-01-15T10:30:00.000Z"
}
```

### 3. Check Crypto Invoice Status
```bash
curl -X GET http://localhost:4000/v1/billing/crypto/invoices/{invoiceId} \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Crypto Payment Webhook (External Integration)
When crypto payment is detected, send webhook to mark invoice as paid:
```bash
curl -X POST http://localhost:4000/v1/billing/crypto/webhook \
  -H "x-crypto-webhook-secret: your-crypto-webhook-secret-here" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId": "invoice-uuid", "txHash": "0xabc123..."}'
```

**Notes:**
- Requires `CRYPTO_WEBHOOK_SECRET` header for authentication
- Idempotent: duplicate payments are ignored
- Automatically activates/extends subscription

### 5. Create Stripe Checkout Session (Fallback)
Create Stripe checkout session with +4% processing fee added.
```bash
curl -X POST http://localhost:4000/v1/billing/stripe/checkout-session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planCode": "P6M_25",
    "successUrl": "https://yourapp.com/success",
    "cancelUrl": "https://yourapp.com/cancel"
  }'
```

**Response Example:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
  "sessionId": "cs_test_..."
}
```

### 6. Stripe Webhook Configuration
Configure Stripe webhook to point to:
```
POST https://yourapi.com/v1/billing/stripe/webhook
```

Stripe will send events like `checkout.session.completed`. The API:
- Verifies `STRIPE_WEBHOOK_SECRET` signature
- Idempotent via `StripeEvent` table
- Activates subscription on successful payment
- Handles chargebacks (sets subscription to PAST_DUE)

Webhook responses:
- Valid signature: `204 No Content`
- Missing/invalid signature: `401 Unauthorized`

### 7. Check Subscription Status
Existing endpoint (already implemented):
```bash
curl -X GET http://localhost:4000/v1/me/subscription \
  -H "Authorization: Bearer $TOKEN"
```

### Subscription Rules
- One subscription row per user
- On successful payment: status → ACTIVE, planCode updated
- Duration: P6M_25 → +6 months, Y1_100/Y1_199 → +12 months
- If user buys while ACTIVE → extend period end date
- Stripe chargeback → status = PAST_DUE
- Trial ends automatically on first payment

### Environment Variables for Billing
| Variable | Description | Default |
|----------|-------------|---------|
| `CRYPTO_PAYMENT_ADDRESS` | Crypto wallet address for payments | (required) |
| `CRYPTO_WEBHOOK_SECRET` | Secret for crypto webhook authentication | (required) |
| `STRIPE_SECRET_KEY` | Stripe API secret key | (required) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | (required) |
| `CARD_PROCESSING_FEE_PERCENT` | +% fee for card payments | `4` |
| `BILLING_CURRENCY` | Currency for payments | `USD` |

## Database Schema

The full PostgreSQL schema is defined in `db/schema.sql`. Prisma schema at `apps/api/prisma/schema.prisma` is a minimal starting point.

## Contributing

1. Ensure `pnpm lint` passes
2. Write tests for new functionality
3. Update documentation as needed

## License

UNLICENSED – Proprietary software.