<!--
Booster Personal Card
Micro-sprint 2.4 implementation prompt for VS Code Copilot

Scope: Public “contact reveal” endpoint + dynamic visibility gate
-->

# Micro-sprint 2.4 — Contact reveal + gated profile fields (Copilot prompt)

## Role
You are a senior backend engineer working in `apps/api` (NestJS + Prisma).

## Goal
Implement the **dynamic contact visibility** layer:

- Without a grant token, the public mode endpoint must **not** leak contact fields.
- With a valid grant token, the visitor can retrieve “contact payload” for the mode.
- Expiry/revocation must be enforced immediately.

This complements Micro-sprints:
- 1.1 (public mode read)
- 2.1 (public contact request)
- 2.2 (approve/deny + grant tokens)
- 2.3 (vCard)

## Context / constraints
- Canonical requirement: “Contact is access-controlled; vCard dynamically generated per access state.”
- We still have limited stored contact fields today (likely just `User.email`, maybe `displayName`).
- Do not create a new storage system.
- Avoid expanding PII storage in this sprint.

## Endpoint

### Route
`GET /v1/card/public/:publicId/modes/:modeSlug/contact`

Auth:
- Public but requires header `X-Card-Token: <rawToken>`

Throttle:
- Use `@Throttle({ "card-public": {} })` or define `card-contact-reveal` bucket.

### Response shape
Add to shared if missing (`packages/shared/src/card/card.dtos.ts`):

```ts
export interface CardContactRevealResponse {
  // what the visitor learns AFTER approval
  displayName?: string;
  email?: string;
  // optional future fields: phone, links, address
}
```

API response:

```json
{ "contact": { "displayName": "...", "email": "..." } }
```

## Token validation
Reuse the exact same token validation logic as vCard (Micro-sprint 2.3):
- sha256(rawToken) → CardContactGrant.tokenHash
- revokedAt null
- expiresAt > now
- grant.mode.card.publicId matches path publicId
- grant.mode.slug matches path modeSlug

If token invalid/expired/revoked → `401 Unauthorized` (recommended) OR `404` (more private). Pick one.

## Implementation steps

### Step 1 — Shared DTO
Update:
- `packages/shared/src/card/card.dtos.ts`
  - add `CardContactRevealResponse`
  - export it from shared barrel

### Step 2 — Service method
In `apps/api/src/card/card.service.ts`, add:

```ts
async revealContact(args: {
  rawToken: string;
  publicId: string;
  modeSlug: string;
}): Promise<CardContactRevealResponse>
```

Implementation:
- validate grant token
- load owner user record (via mode.card.userId)
- return minimal contact payload

Important:
- Do NOT return anything without a valid token.
- Do not leak `userId`.

### Step 3 — Controller
Update `apps/api/src/card/card.public.controller.ts`:
- add `GET :publicId/modes/:modeSlug/contact`
- read `X-Card-Token` header
- return `{ contact }`

### Step 4 — Tests
Extend `apps/api/src/card/card.service.spec.ts`:
- unauthorized when token missing
- unauthorized when token invalid
- unauthorized when revoked/expired
- returns contact when valid

Mock Prisma similarly to existing card tests.

### Step 5 — Smoke
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

## Acceptance criteria
- New endpoint exists: `GET /v1/card/public/:publicId/modes/:modeSlug/contact`
- Requires `X-Card-Token`
- No contact data is exposed without a valid, active grant
- Tests pass

## Implementation status (completed)
- Shared contract: `CardContactRevealResponse` added to shared DTOs.
- API: `CardService.revealContact(...)` implemented and reuses the same grant-token validation as vCard via a shared helper.
- Public route: `GET /v1/card/public/:publicId/modes/:modeSlug/contact` implemented (requires `X-Card-Token`).
- OpenAPI: added `/v1/card/public/{publicId}/modes/{modeSlug}/contact` + `CardContactRevealResponse` schema.

## Local verification (completed)
```bash
pnpm --filter @booster-vault/api type-check
pnpm --filter @booster-vault/api test
```
