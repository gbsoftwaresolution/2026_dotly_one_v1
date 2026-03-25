<!--
Booster Personal Card
Micro-sprint 2.2 implementation prompt for VS Code Copilot

Scope: Owner approval/denial + grant issuance (token hash) + revoke
-->

# Micro-sprint 2.2 — Approve/Deny contact requests + grant tokens (Copilot prompt)

## Role
You are a senior backend engineer working in `apps/api` (NestJS + Prisma).

## Goal
Implement the owner-side workflow for contact requests:

1) Owner lists pending requests (already implemented or partially implemented)
2) Owner approves a request with an expiry → system issues a **grant token**
3) Owner denies a request
4) Owner can revoke an existing grant (instant)

This sprint **creates the authorization primitive** (`CardContactGrant`) that Micro-sprint 2.3 will use to guard vCard + contact visibility.

## Context
- API prefix `/v1`
- Card module exists: `apps/api/src/card/*`
- Public contact request endpoint exists: `POST /v1/card/public/:publicId/modes/:modeSlug/contact-requests`
- Shared DTOs exist in `packages/shared/src/card/card.dtos.ts`:
  - `ApproveCardContactRequestDto`
  - `ApproveCardContactRequestResponse`
  - `ListCardContactRequestsResponse`

Prisma models:
- `CardContactRequest` (status)
- `CardContactGrant` (tokenHash, expiresAt, revokedAt)

Security principle:
- Store only **tokenHash** server-side (sha256 hex)
- Return raw token only once at approval time
- Expiry and revocation must be enforced immediately

## Endpoints to implement

### 1) Owner: approve a request
`POST /v1/card/contact-requests/:requestId/approve`

Auth: JWT required (`@UseGuards(JwtAuthGuard)`)

Body: `ApproveCardContactRequestDto`
Response: `{ grant: ApproveCardContactRequestResponse }`

Approval rules:
- Request must exist and belong to owner (through `request.mode.card.userId === userId`).
- Only allow approve when status is `PENDING`.
- Approval must:
  - create a `CardContactGrant`
  - link it to request (set `requestId` on grant or `grantId` on request depending on schema)
  - update request status to `APPROVED`
  - return `grantId`, raw `token`, `expiresAt`

Expiry rules:
- If `dto.expiresAt` present: use it **only if** it’s in the future (premium later; for now allow but validate).
- Else if `dto.expiresInDays` present: clamp to allowed values (7, 30, maybe 0 for “permanent”) OR accept any 1..365 for now.
- Default: 30 days.

### 2) Owner: deny a request
`POST /v1/card/contact-requests/:requestId/deny`

Auth: JWT required
Body: empty
Response: `{ success: true }`

Rules:
- Must be owner.
- Only `PENDING` can be denied.
- Update status to `DENIED`.

### 3) Owner: revoke a grant
`POST /v1/card/contact-grants/:grantId/revoke`

Auth: JWT required
Response: `{ success: true }`

Rules:
- Must be owner (through `grant.mode.card.userId === userId`).
- Set `revokedAt = now`.
- Also update the associated request status to `REVOKED` if it exists.

### 4) Owner: list grants (optional)
`GET /v1/card/modes/:modeId/contact-grants`

Return minimal fields (no tokenHash).

## Implementation notes

### Token generation
Copy the share token pattern conceptually from `SharingService`:
- `rawToken`: `randomBytes(32).toString("base64url")`
- `tokenHash`: `sha256(rawToken)` hex

Implement helper functions under:
- `apps/api/src/card/card.tokens.ts` (or `card.util.ts`)

```ts
export function makeCardGrantToken(): { rawToken: string; tokenHash: string };
```

### Prisma transaction
Approval should be done in a single `$transaction`:
- re-check request state
- create grant
- update request status

This avoids races (double-approve).

### Data exposure
- Never return `tokenHash`.
- Do not return requester's PII in approve response.

## Files to add/update
- `apps/api/src/card/card.owner.controller.ts` (new)
- `apps/api/src/card/card.service.ts` (new service methods)
- `apps/api/src/card/card.tokens.ts` (new helper)
- `apps/api/src/card/card.module.ts` (wire owner controller)
- `apps/api/src/card/card.service.spec.ts` (tests)

## Tests (Jest)
Add/extend `apps/api/src/card/card.service.spec.ts` with mocked Prisma.

Test cases:
1) approve success: creates grant + updates status + returns raw token
2) approve conflict when request not PENDING
3) deny success
4) revoke sets revokedAt
5) ownership enforced for approve/deny/revoke

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

## Acceptance criteria
- Owner can approve and receives a raw token once
- Server stores only token hash
- Deny and revoke work and are owner-only
- Expiry values are validated
- Tests pass
