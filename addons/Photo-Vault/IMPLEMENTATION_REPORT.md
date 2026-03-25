# Booster Vault (BoosterAi Photo Vault) — Implementation Report

Last updated: 2026-02-21

This report summarizes what is *actually implemented* in this repository (backend + web app + shared package), based on the current source tree, Memory Bank notes, and key docs.

> Repo type: **pnpm workspace monorepo**
>
> - `apps/api` — NestJS REST API (Postgres + Prisma, BullMQ workers)
> - `apps/web` — React/Vite web client (client-side crypto)
> - `packages/shared` — Shared DTOs/types used by both

---

## 1) High-level: What the product already does

### Core Vault
- Zero-knowledge **client-side encryption/decryption** (server stores ciphertext + plaintext metadata only).
- AES-GCM encryption metadata is **versioned** (`encMeta.v`): `v1` legacy (no AAD) and `v2` (AAD-bound to `{ userId, mediaId, variant }`).
- Authenticated web vault UI:
  - Library view (list media)
  - Upload flow (encrypt → request signed URL → upload ciphertext → finalize)
  - Timeline view
  - Search view (non-AI, full-text)
  - Albums (create, add/remove items)
  - Trash (soft-delete) support via API; UI exists.

### Key Management / Account Security
- **VaultKeyBundle** system so password changes don’t break vault decryption.
- **Recovery phrase** system (optional) + explicit **risk acceptance** if user proceeds without recovery.
- Multi-device security:
  - Device/session listing
  - Revoke other devices
  - Rename device

### Sharing
- **Read-only album sharing via secure public links** with a passphrase.
  - Viewer can access without login.
  - Server never receives passphrase; bundle is encrypted client-side.
  - Share access token (short-lived) is used for share-scoped operations.
  - Analytics: view count + last viewed.

### Exports
- Background-job based export system:
  - Create export jobs (vault/album/date-range)
  - Worker produces an encrypted ZIP + manifest
  - Signed download URL generation
  - UI includes export list + “Decrypt Tool” route.
- `manifest.json` now includes `ownerUserId` so offline decryption can recompute v2 AAD.

### Thumbnails (Encrypted) — Implemented end-to-end
- Client generates thumbnails (image/video) and encrypts them with the per-media key.
- Dual upload flow (main ciphertext + thumbnail ciphertext).
- **Thumbnail-first UI**: grid loads thumb variant first, viewer loads full-res on demand.

### Billing
- Billing module is present and includes:
  - Public plans listing
  - Crypto invoice creation/status + webhook
  - Stripe checkout session endpoint + Stripe webhook handler (signature verified)

### Additional Feature Area
- “Life Docs” module exists with CRUD + timeline/search/family overview/renewal features.
- “Continuity” module exists (scheduler + models; heir flow in-progress).

---

## 2) Backend (NestJS API) — Implemented modules & endpoints

API global prefix is `/v1` (see `apps/api/src/main.ts`).

### 2.1 Cross-cutting infrastructure

**Security / hardening**
- Helmet + strict CSP + strict CORS allowlist via `WEB_ORIGIN` (`apps/api/src/main.ts`).
- Rate limiting using Nest Throttler with multiple buckets:
  - `default`, `auth`, `upload`, `share-public`, `billing-webhook` (`apps/api/src/app.module.ts`).

**Validation / DTOs**
- Global `ValidationPipe({ whitelist, transform, forbidNonWhitelisted })` enabled.

**Database / ORM**
- Prisma module + migrations in `apps/api/prisma/migrations/*`.

**Idempotency**
- Idempotency interceptor + table migration exists (see migration `20260210063641_add_idempotency_keys_table`).
- Used on key endpoints (uploads, exports, thumbnail completion, multipart completion, etc.).

**Workers / Queues**
- BullMQ + Redis for background processing.
- Queue health endpoint includes Redis ping, queue counts/repeatables, and worker heartbeats.

---

### 2.2 System / Health

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/health` | Yes | Simple `{ ok: true }` (`apps/api/src/health/health.controller.ts`) |
| `GET /v1/queue/health` | Yes | Requires JWT. Reports Redis + queues + worker heartbeat (`apps/api/src/queue/queue-health.controller.ts`) |

---

### 2.3 Auth (email/password + JWT sessions)

Implemented in `apps/api/src/auth/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `POST /v1/auth/register` | Yes | Returns `{ user, session }` |
| `POST /v1/auth/login` | Yes | Returns `{ user, session }` |
| `POST /v1/auth/refresh` | Yes | Refresh token → new session |
| `POST /v1/auth/logout` | Yes | Revokes refresh token |
| `POST /v1/auth/change-password` | Yes | Works with VaultKeyBundle system |
| `POST /v1/auth/verify-password` | Yes | Used for sensitive client flows |
| `POST /v1/auth/request-email-verification` | Yes | Sends verification email (dev: console mailer) |
| `POST /v1/auth/verify-email` | Yes | Verifies token |
| `POST /v1/auth/forgot-password` | Yes | Sends reset email |
| `POST /v1/auth/reset-password` | Yes | Resets password via token |

---

### 2.4 Devices / Sessions (multi-device security)

Implemented in `apps/api/src/auth/devices.controller.ts` + `sessions.service.ts`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/devices` | Yes | Lists active sessions (masks IP) |
| `PATCH /v1/devices/:sessionId` | Yes | Rename session/device |
| `POST /v1/devices/:sessionId/revoke` | Yes | Revoke a device (cannot revoke current session) |
| `POST /v1/devices/revoke-others` | Yes | Revoke all except current |

Audit events are written for rename/revoke operations.

---

### 2.5 VaultKeyBundle (password-change-safe vault key wrapping)

Implemented in `apps/api/src/auth/vault-key.controller.ts` + `vault-key.service.ts`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/vault-key/status` | Yes | Indicates enabled/created/updated |
| `POST /v1/vault-key/upsert` | Yes | Store encrypted master key bundle |
| `GET /v1/vault-key/bundle` | Yes | Returns `{ encryptedMasterKey, iv, kdfParams }` |
| `POST /v1/vault-key/reset` | Yes | Destructive reset, requires password |

---

### 2.6 Recovery phrase

Implemented in `apps/api/src/auth/recovery.controller.ts`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `POST /v1/recovery/enable` | Yes | Stores encrypted master key for recovery |
| `GET /v1/recovery/status` | Yes | Shows whether recovery enabled |
| `DELETE /v1/recovery/disable` | Yes | Requires password verification |
| `POST /v1/recovery/bundle` | Yes | Rate-limited; returns encrypted bundle by `userId` |
| `POST /v1/recovery/accept-risk` | Yes | Idempotent timestamp stored on user |

---

### 2.7 Users / “Me”

Implemented in `apps/api/src/users/users.controller.ts`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/me` | Yes | Profile |
| `PATCH /v1/me` | Yes | Update displayName/locale/timezone |
| `GET /v1/me/subscription` | Yes | Subscription status |
| `GET /v1/me/usage` | Yes | Usage counters |
| `GET /v1/me/sessions` | Yes | Session list (optional endpoint) |

---

### 2.8 Media (encrypted upload/download, metadata, trash, multipart, thumbnails)

Implemented in `apps/api/src/media/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `POST /v1/media/upload-intents` | Yes | Creates media record + returns signed upload URL (+ thumbnail URL optionally) |
| `POST /v1/media/:mediaId/complete-upload` | Yes | Finalize upload + counters; accepts optional `sha256CiphertextB64` and `encMeta` overwrite (used to persist v2 `encMeta.aad`) |
| `POST /v1/media/:mediaId/thumbnail-upload-intent` | Yes | Signed URL for encrypted thumbnail upload |
| `POST /v1/media/:mediaId/complete-thumbnail-upload` | Yes | Best-effort fast completion |
| `GET /v1/media` | Yes | Pagination + includeTrashed + date range + optional `albumId` (album-order pagination) |
| `GET /v1/media/:mediaId` | Yes | Get one |
| `PATCH /v1/media/:mediaId` | Yes | Update title/note/takenAt/locationText |
| `DELETE /v1/media/:mediaId` | Yes | Trash (soft delete) |
| `POST /v1/media/:mediaId/restore` | Yes | Restore |
| `POST /v1/media/:mediaId/purge` | Yes | Permanent delete |
| `POST /v1/media/:mediaId/download-url` | Yes | Signed download URL, supports `variant` (thumb/original) |
| `GET /v1/media/multipart/support` | Yes | Returns server storage multipart capability |
| `POST /v1/media/:mediaId/multipart/init` | Yes | Init multipart |
| `POST /v1/media/:mediaId/multipart/part-url` | Yes | Presigned URL for a part |
| `GET /v1/media/:mediaId/multipart/status` | Yes | Resume support |
| `POST /v1/media/:mediaId/multipart/complete` | Yes | Complete multipart |
| `POST /v1/media/:mediaId/multipart/abort` | Yes | Abort |

Background processing:
- Purge scanning + purge processor (`purge.scheduler.service.ts`, `purge.processor.ts`).
- Thumbnail verification scanning + processor (`thumbnails.scheduler.service.ts`, `thumbnails.processor.ts`).

Local storage driver support:
- `PUT /v1/storage/local-upload` and `GET /v1/storage/local-download` exist for local dev (`apps/api/src/storage/storage.controller.ts`).

---

### 2.9 Albums

Implemented in `apps/api/src/albums/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/albums` | Yes | Pagination + includeDeleted |
| `POST /v1/albums` | Yes | Create |
| `GET /v1/albums/:albumId` | Yes | Get |
| `PATCH /v1/albums/:albumId` | Yes | Update |
| `DELETE /v1/albums/:albumId` | Yes | Soft delete (controller returns album response) |
| `GET /v1/albums/:albumId/items` | Yes | Ordered items |
| `POST /v1/albums/:albumId/items` | Yes | Add items |
| `DELETE /v1/albums/:albumId/items?mediaId=...` | Yes | Remove |
| `POST /v1/albums/:albumId/items/reorder` | Yes | Reorder by `position` |

---

### 2.10 Browse (Timeline + Search)

Implemented in `apps/api/src/browse/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/timeline` | Yes | Filters: year, albumId, cursor pagination |
| `GET /v1/search` | Yes | Full-text search + date range + albumId |

---

### 2.11 Exports

Implemented in `apps/api/src/exports/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/exports` | Yes | Paginated list |
| `POST /v1/exports` | Yes | Create export job (idempotent) |
| `GET /v1/exports/:exportId` | Yes | Get job |
| `POST /v1/exports/:exportId/download-url` | Yes | Signed URL for ZIP |
| `DELETE /v1/exports/:exportId` | Yes | Delete/cancel export |

Background processors/schedulers exist:
- `exports.processor.ts`
- `exports.scheduler.service.ts`
- `exports.worker.service.ts`

---

### 2.12 Sharing (read-only album shares)

Implemented in `apps/api/src/sharing/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `POST /v1/share/albums/:albumId` | Yes | Create share with bundle |
| `POST /v1/share/albums/:albumId/stub` | Yes | Two-step creation for large albums |
| `POST /v1/share/:shareId/bundle` | Yes | Upload encrypted bundle |
| `GET /v1/share/:shareId` | Yes | Public metadata |
| `POST /v1/share/:shareId/unlock` | Yes | Public; returns encrypted bundle + share access token |
| `GET /v1/share/:shareId/media` | Yes | Public; requires `X-Share-Token` |
| `POST /v1/share/:shareId/media/:mediaId/download-url` | Yes | Public; requires `X-Share-Token` + variant=thumb/original |
| `POST /v1/share/:shareId/view` | Yes | Public; view tracking |
| `POST /v1/share/:shareId/revoke` | Yes | Owner-only |
| `GET /v1/share/:shareId/analytics` | Yes | Owner-only |
| `GET /v1/share/albums/active` | Yes | Owner-only list |

See also: `SHARING_IMPLEMENTATION_SUMMARY.md`.

---

### 2.13 Billing

Implemented in `apps/api/src/billing/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/billing/plans` | Yes | Exposed plans |
| `POST /v1/billing/crypto/invoices` | Yes | Auth required |
| `GET /v1/billing/crypto/invoices/:invoiceId` | Yes | Auth required |
| `POST /v1/billing/crypto/webhook` | Yes | Secret header validated |
| `POST /v1/billing/stripe/checkout-session` | Yes | Auth required |
| `POST /v1/billing/stripe/webhook` | Yes | Stripe signature verified; 204 on success |

---

### 2.14 Life Docs

Implemented in `apps/api/src/life-docs/*`.

Endpoints include:
- Timeline, search, family overview, renewal summary
- CRUD + versions + restore
- Reminders (update + test)
- Privacy masking updates

---

### 2.15 Continuity (prototype/in-progress)

Implemented models + scheduler exist:
- Hourly inactivity checks in `apps/api/src/continuity/continuity.scheduler.ts`
- Heir portal endpoints are protected by an heir JWT (Authorization bearer) guard

---

### 2.16 Personal Card (public mode + contact request + grants)

Implemented in `apps/api/src/card/*`.

| Endpoint | Implemented | Notes |
|---|---:|---|
| `GET /v1/card/public/:publicId/modes/:modeSlug` | Yes | Public mode view + attachments (ALBUM attaches resolve to `/shared/:shareId` only if an active share exists) |
| `POST /v1/card/public/:publicId/modes/:modeSlug/contact-requests` | Yes | Create contact request (dedupe window) |
| `GET /v1/card/public/:publicId/modes/:modeSlug/contact` | Yes | Grant-token protected; requires `X-Card-Token` |
| `GET /v1/card/modes` | Yes | Owner-only; list your modes |
| `POST /v1/card/modes` | Yes | Owner-only; creates a mode with server-enforced plan limits (Free=1, Premium=3) |
| `GET /v1/card/modes/:modeId/analytics` | Yes | Owner-only; aggregate-only analytics (no viewer identity) |
| `GET /v1/card/analytics` | Yes | Owner-only; list analytics for all modes |
| `PUT /v1/card/username` | Yes | Owner-only; premium-only vanity username reservation (reserved words + 12mo cooldown) |
| `GET /v1/card/resolve-username/:username` | Yes | Public; resolves only when at least one mode has `indexingEnabled=true` (no discovery by default) |
| `POST /v1/card/modes/:modeId/attachments` | Yes | Owner-only; create mode attachment (ALBUM-only in 3.1, validates album ownership) |
| `GET /v1/card/modes/:modeId/attachments` | Yes | Owner-only; list mode attachments |
| `POST /v1/card/modes/:modeId/attachments/reorder` | Yes | Owner-only; reorder attachments by `sortOrder` (204) |
| `PUT /v1/card/modes/:modeId/attachments/reorder` | Yes | Owner-only; reorder attachments by ordered ID list (returns updated list) |
| `PUT /v1/card/attachments/:attachmentId` | Yes | Owner-only; update attachment label/sortOrder/expiresAt (future-only; null clears) |
| `POST /v1/card/attachments/:attachmentId/revoke` | Yes | Owner-only; revoke attachment (idempotent) |
| `DELETE /v1/card/attachments/:attachmentId` | Yes | Owner-only; hard-delete attachment |
| `GET /v1/card/modes/:modeId/contact-requests` | Yes | Owner-only inbox list |
| `POST /v1/card/contact-requests/:requestId/approve` | Yes | Owner-only; returns raw grant token once |
| `POST /v1/card/contact-requests/:requestId/deny` | Yes | Owner-only |
| `POST /v1/card/contact-grants/:grantId/revoke` | Yes | Owner-only |
| `GET /v1/card/vcard` | Yes | Grant-token protected; requires `X-Card-Token`; returns `text/vcard` attachment |

Hardening (4.3):
- Public contact requests can require Turnstile CAPTCHA when enabled via env (`TURNSTILE_ENABLED`, `TURNSTILE_SECRET_KEY`).
- Public Card endpoints use dedicated throttling buckets (`card-contact-public`, `card-token-public`) to reduce abuse.

Premium gates (4.2):
- Mode creation enforces plan limits server-side (Free=1 mode; Premium=3 modes).
- Vanity username is premium-only and rate-limited (once per 12 months); reserved words are blocked.
- Contact grant custom `expiresAt` is premium-only (free users may select `expiresInDays` 7 or 30).

---

## 3) Background workers (BullMQ)

Workers run as a separate process:
- `pnpm worker` (root) or `pnpm dev:worker` under `apps/api`

Implemented job categories (from code + README):
- Exports processing
- Purge scanning + deletes
- Thumbnail verification
- Worker heartbeat table + liveness checks

---

## 4) Web client (React/Vite) — Implemented screens & flows

### 4.1 Routing

Defined in `apps/web/src/app/router.tsx`.

Public routes:
- Marketing pages (`/`, `/pricing`, `/faq`, `/how-encryption-works`, etc.)
- Auth pages (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`)
- Public share viewer: `/shared/:shareId`

Protected “Vault” routes under `/app/vault/*`:
- Library, timeline, search, albums, album detail, trash, exports (+ decrypt tool), shares, billing, settings

“Apps” routes under `/apps/*`:
- Life Docs + continuity dashboards

---

### 4.2 Client-side cryptography

Implemented in `apps/web/src/crypto/*`.

Key parts:
- Vault key bundle flows (`vaultKey.ts`) with tests.
- Recovery phrase flows (`recovery.ts`) with tests.
- Vault media AAD binding utilities (`aad.ts`) used by AES-GCM v2:
  - deterministic, canonical pipe-delimited AAD string → UTF-8 bytes
  - decryption fails authentication if any bound context differs
- Media encryption utilities (`encrypt.ts`) supporting:
  - single-shot encryption
  - chunked encryption aligned to multipart constraints
- WebCrypto wrappers (`webcrypto.ts`) pass AAD via `additionalData` for AES-GCM v2.
- Decryption utilities (`decrypt.ts`) incl. shared-media decryption (`fetchAndDecryptShared`).
- Local key persistence (IndexedDB) via `db.ts` / `keyStore.ts`.
- Unit tests validate AAD determinism + mismatch failure + v1/no-AAD compatibility (`aad.test.ts`).

---

### 4.3 Upload flow (encrypted + thumbnails + multipart)

Component: `apps/web/src/components/UploadDialog.tsx`

Implemented capabilities:
- Encrypts media client-side.
- Requests upload intent from API.
- For AES-GCM v2, encryption is performed after the intent returns `mediaId` so the ciphertext can be AAD-bound to `{ userId, mediaId, variant }`.
- Uploads ciphertext via signed URL.
- Multipart upload support when storage supports it (S3-compatible).
- Generates **encrypted thumbnails** client-side and uploads them (dual upload).
- Finalizes upload + best-effort thumbnail completion.
- Persists finalized encryption metadata on completion (v2 `encMeta` may include human-readable `encMeta.aad` fields; API stores this JSON).
- Stores per-media wrapped key locally for later decryption.

---

### 4.4 Media browsing UX

Key components:
- `MediaGrid.tsx` — grid rendering + hover/lazy behavior
- `MediaViewer.tsx` — full viewer; can disable download/trash (used by shared viewer)
- `useMediaCache.ts` — caches decrypted thumbnails/media and prefers `variant=thumb` when available

Pages:
- `Library.tsx` — list, select mode, add to album, trash actions
- `Timeline.tsx` — grouped day sections, infinite scroll
- `Search.tsx` — debounced search, date filters, infinite scroll

---

### 4.5 Albums

- `Albums.tsx` — list/create/delete
- `AlbumDetail.tsx` — list items, add via picker, remove from album
- Share integration: “Share” button opens `ShareAlbumModal.tsx`

---

### 4.6 Sharing (public read-only)

- Owner flow: `ShareAlbumModal.tsx`
- Viewer flow: `PublicSharedAlbumPage.tsx`
  - unlock with passphrase
  - decrypt keys client-side
  - fetch signed URLs with `X-Share-Token`
  - thumbnail-first previews in shared grid
  - viewer is explicitly read-only (download/trash disabled)

---

### 4.7 Exports UI

- `Exports.tsx` — list/poll active jobs, create new exports (vault/album/date-range), download when READY
- `DecryptExport.tsx` — decrypt helper UI route exists (implementation not detailed in this report)

---

## 5) Shared package (`packages/shared`)

`packages/shared/src/*` contains DTOs and response models used by both API and web.

Implemented type areas:
- Auth DTOs (login/register/refresh, vault key, recovery, devices)
- Media DTOs (upload intent, update, complete)
- Crypto types include a versioned `VaultEncMeta` union used by media responses and upload DTOs (`packages/shared/src/crypto/enc-meta.types.ts`).
- Albums DTOs
- Browse types
- Export types
- Sharing types/DTOs
- Billing types/DTOs
- Life-docs DTOs/types

---

## 6) Database & migrations (Prisma)

Prisma schema: `apps/api/prisma/schema.prisma`

Notable migration groups present in `apps/api/prisma/migrations/*`:
- Initial schema
- Search tsvector/timeline indexes
- Billing models
- Shared album model + share access token + analytics
- Device management
- Vault key bundle
- Media thumbnails
- Recovery risk acceptance
- Worker heartbeats
- Idempotency keys table
- Document media type
- Life Docs (phase 1 + phase 2 + reminders)
- Continuity models

---

## 7) How to run (local)

From repo root:

```bash
pnpm install
cp .env.example .env
```

Start dependencies (Docker examples from README):

```bash
docker run -d --name booster-vault-db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=booster_vault -p 5432:5432 postgres:14-alpine
docker run -d --name booster-vault-redis -p 6379:6379 redis:7-alpine
```

Run Prisma generation + migrations:

```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate:dev
```

Start dev servers:

```bash
pnpm dev
```

Start workers in another terminal:

```bash
pnpm worker
```

Health checks:

```bash
curl http://localhost:4000/v1/health
```

---

## 8) Known gaps / TODOs (from code + docs)

1. **UI TODO / placeholder**
   - Timeline page still includes a “Not implemented” toast in one path, although trash is implemented elsewhere.

2. Some project status notes in Memory Bank may be outdated
   - `memory-bank/progress.md` mentions “media upload/download in progress”, but the code now includes full upload/download + thumbnails + multipart + UI.

3. **OpenAPI drift guard**
  - Route-level drift is checked via `node scripts/openapi-drift-audit.mjs`.
  - It is wired into `apps/api` tests; run manually with `pnpm openapi:drift` (repo root).

---

## 9) Key implementation references

- API bootstrap & security: `apps/api/src/main.ts`
- API module wiring: `apps/api/src/app.module.ts`
- Upload + multipart + thumbnails (web): `apps/web/src/components/UploadDialog.tsx`
- Thumbnail-first caching: `apps/web/src/hooks/useMediaCache.ts`
- Public share viewer: `apps/web/src/pages/PublicSharedAlbumPage.tsx`
- Sharing summary doc: `SHARING_IMPLEMENTATION_SUMMARY.md`
- OpenAPI spec (intended interface): `api/openapi.yaml`
