<!--
Booster Personal Card
Micro-sprint 0.1 implementation prompt for VS Code Copilot

Scope: Data model + migrations + minimal tests/verification scaffolding
-->

# Micro-sprint 0.1 — Card data model + migration (Copilot prompt)

## Role
You are a senior full-stack engineer working in a pnpm workspace monorepo.

## Context
We are implementing **Booster Personal Card**.

Canonical spec lives in:
- `docs/card/card.context.md` (non-negotiables)
- `docs/card/card.spec.md` (v1 product spec)

Existing patterns we must reuse:
- Prisma schema + migrations: `apps/api/prisma/schema.prisma`
- NestJS modules: `apps/api/src/*`
- Public token pattern: sharing module stores **token hashes** in DB (`ShareAccessToken`) and sends raw token once.
- Rate limiting: `@nestjs/throttler` already configured in `apps/api/src/app.module.ts`.

## Micro-sprint goal
Add the **minimal backend data model** required for Personal Card v1 *without building UI yet*.

We must support:
- Immutable internal user ID (already `User.id`)
- A permanent **public card id** that is *not* the userId and is safe to share
- Up to N **modes** per user (plan gating happens later)
- A **contact access** workflow per mode: request → approve (later) → grant token with expiry/revoke
- Attachments referencing Vault entities (album/media/life-doc) with future policy hooks

## Deliverables
1) Prisma schema updates + migration(s)
2) Minimal API-side unit tests for key invariants (no controller work in this sprint)
3) A short “how to verify locally” section appended to this doc as you implement

## Non-negotiable constraints
1) **No username as primary key** (username can exist later, but never be used as FK / identity PK)
2) **Mode isolation**: contact grants/requests are per-mode
3) **Expiry + revocation are first-class** for any grant/token
4) **No new file storage**: attachments must reference existing Vault objects (Album/Media/LifeDoc) by id; no uploads here
5) Keep privacy in mind: do not store more PII than needed.

## Implementation steps

### Step A — Add Prisma models (schema only)
Edit: `apps/api/prisma/schema.prisma`

Add these enums (names can differ but keep meaning):

```prisma
enum CardContactGate {
  OPEN
  REQUEST_REQUIRED
  HIDDEN
}

enum CardContactRequestStatus {
  PENDING
  APPROVED
  DENIED
  EXPIRED
  REVOKED
}

enum CardAttachmentKind {
  ALBUM
  MEDIA
  LIFE_DOC
}
```

Add these models (minimum fields listed; you may add helpful metadata like `updatedAt` where consistent with repo patterns):

#### `PersonalCard`
- 1:1 with `User`
- Contains **publicId** (random, stable, unique)

```prisma
model PersonalCard {
  id        String   @id @default(uuid())
  userId    String   @unique
  publicId  String   @unique @map("public_id")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)
  modes CardMode[]

  @@index([publicId])
  @@map("personal_cards")
}
```

Notes:
- `publicId` must be generated application-side later; for now schema allows it.
- Consider adding a `disabledAt` if helpful.

#### `CardMode`
Each mode is an isolated public surface.

```prisma
model CardMode {
  id          String   @id @default(uuid())
  cardId      String   @map("card_id")

  // display
  name        String
  slug        String
  headline    String?
  bio         String?

  // mode policy
  contactGate CardContactGate @default(REQUEST_REQUIRED) @map("contact_gate")
  indexingEnabled Boolean @default(false) @map("indexing_enabled")

  // theme (optional stub for later)
  themeKey    String?  @map("theme_key")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  card        PersonalCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  contactRequests CardContactRequest[]
  contactGrants  CardContactGrant[]
  attachments    CardAttachment[]

  @@unique([cardId, slug])
  @@index([cardId])
  @@map("card_modes")
}
```

Notes:
- `slug` is per-card unique.
- We are not implementing “mode token entropy link” yet; public routing can use `(publicId, slug)`.

#### `CardContactRequest`
Stores visitor-submitted request.

```prisma
model CardContactRequest {
  id          String   @id @default(uuid())
  modeId      String   @map("mode_id")
  status      CardContactRequestStatus @default(PENDING)

  requesterName  String   @map("requester_name")
  requesterEmail String   @map("requester_email")
  requesterPhone String?  @map("requester_phone")
  message        String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  mode        CardMode @relation(fields: [modeId], references: [id], onDelete: Cascade)
  grant       CardContactGrant?

  @@index([modeId, createdAt])
  @@index([status])
  @@map("card_contact_requests")
}
```

Notes:
- Keep PII minimal; don’t add IP/userAgent yet.

#### `CardContactGrant`
Represents granted access for a visitor.
- Must support expiry and revocation.
- Use token-hash pattern (store sha256 hash, raw token returned once later).

```prisma
model CardContactGrant {
  id         String   @id @default(uuid())
  modeId     String   @map("mode_id")
  requestId  String?  @unique @map("request_id")

  tokenHash  String   @unique @map("token_hash")
  expiresAt  DateTime @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  mode       CardMode @relation(fields: [modeId], references: [id], onDelete: Cascade)
  request    CardContactRequest? @relation(fields: [requestId], references: [id], onDelete: SetNull)

  @@index([modeId, expiresAt])
  @@index([revokedAt])
  @@map("card_contact_grants")
}
```

#### `CardAttachment`
References Vault entities (no storage duplication).

```prisma
model CardAttachment {
  id        String   @id @default(uuid())
  modeId    String   @map("mode_id")
  kind      CardAttachmentKind
  refId     String   @map("ref_id") // albumId | mediaId | lifeDocId
  label     String?
  sortOrder Int      @default(0) @map("sort_order")

  // optional expiry hooks (v1 spec mentions expiry/revoke for attachments)
  expiresAt DateTime? @map("expires_at")
  revokedAt DateTime? @map("revoked_at")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mode      CardMode @relation(fields: [modeId], references: [id], onDelete: Cascade)

  @@index([modeId, sortOrder])
  @@index([kind, refId])
  @@map("card_attachments")
}
```

Also update `User` model to include:

```prisma
personalCard PersonalCard?
```

### Step B — Generate migration
Run from repo root:

```bash
pnpm --filter @booster-vault/api prisma:generate
pnpm --filter @booster-vault/api prisma:migrate:dev
```

Ensure migration name is clear, e.g. `add_personal_card_models`.

### Step C — Add minimal unit tests
Add: `apps/api/src/card/card.util.ts` and `apps/api/src/card/card.util.spec.ts`

We do NOT need to boot Nest for this sprint. Add small pure functions and unit-test them:

1) `makeCardPublicId()`
   - returns a base64url string (or hex) with **at least 128 bits** of entropy
   - length should be URL-safe and not too long (e.g. 22 chars if 16 bytes base64url)
2) `hashCardToken(rawToken: string)`
   - sha256 hex
3) `isGrantActive({ expiresAt, revokedAt }, now = new Date())`

Test cases:
- publicId is url-safe (no `+` `/` `=`)
- token hashes deterministic
- expiry/revocation behavior

### Step D — Verification checklist (append to this doc)
At the bottom of this file, append a section:

```md
## Local verification
- [ ] pnpm -w type-check
- [ ] pnpm --filter @booster-vault/api test
- [ ] pnpm --filter @booster-vault/api prisma:migrate:dev
```

## Acceptance criteria
- Prisma migration applies cleanly.
- `pnpm --filter @booster-vault/api test` passes.
- No existing sharing/life-docs/billing tests are broken.
- Schema respects non-negotiables: userId is internal; modes isolated; token hashes stored; expiry/revocation fields exist.

## Notes / guidance
- Keep naming consistent with existing schema (`snake_case` via `@map()` + `@@map()` as used elsewhere).
- Prefer `String @default(uuid())` ids (consistent with repo).
- Don’t implement controllers/services in this sprint; focus on schema + testable utilities.

## Local verification
- [ ] pnpm -w type-check
- [ ] pnpm --filter @booster-vault/api test
- [ ] pnpm --filter @booster-vault/api prisma:migrate:dev
