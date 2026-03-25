<!--
Booster Personal Card
Micro-sprint 2.3 implementation prompt for VS Code Copilot

Scope: vCard generation endpoint guarded by X-Card-Token (grant token)
-->

# Micro-sprint 2.3 — vCard download (grant-token protected) (Copilot prompt)

## Role
You are a senior backend engineer working in `apps/api` (NestJS + Prisma).

## Goal
Implement vCard generation and download for Booster Personal Card.

The vCard must be:
- **dynamically generated**
- only available when a valid **contact grant token** is presented
- instantly disabled on **expiry** or **revocation**

This sprint assumes Micro-sprint 2.2 exists (grant issuance + revoke) so we can validate tokens.

## Context / constraints
- No contact fields may leak without an active grant.
- Analytics/social counters are out-of-scope here.
- The vCard is returned as text content, not a file stored in object storage.

Important: current `User` model has only `displayName` and `email`. We likely do **not** have phone/address fields yet.
So implement a minimal vCard based on the fields available today, and structure code so more fields can be added later.

Shared contract exists: `CardVCardResponse` (or you can return raw `text/vcard`).

## Endpoint

### Route
`GET /v1/card/vcard`

Auth:
- Public, but requires header `X-Card-Token: <rawToken>`

Query params:
- `publicId`: string
- `modeSlug`: string

Rationale:
- We keep URLs stable and avoid leaking grantId in path.
- The token is the gate.

### Response
Option A (recommended for browsers): return raw vCard text.

- `200` with headers:
  - `Content-Type: text/vcard; charset=utf-8`
  - `Content-Disposition: attachment; filename="contact.vcf"`

Body is the `.vcf` content.

Option B: return JSON `{ vcf, filename, contentType }` matching `CardVCardResponse`.

Pick Option A unless you have a strong reason to do JSON.

## Token validation rules
Given raw token in `X-Card-Token`:
1) compute `tokenHash = sha256(rawToken)`
2) find `CardContactGrant` by `tokenHash`
3) verify:
   - `revokedAt` is null
   - `expiresAt > now`
4) load the associated mode and card to ensure:
   - mode exists
   - mode matches `publicId + modeSlug` provided

If token is missing/invalid/expired/revoked: respond `401 Unauthorized` (or `404` if you prefer not to confirm; choose one and be consistent).

## vCard content rules (v1 minimal)
Generate vCard 3.0 content with:
- `FN:` (full name) → prefer user `displayName` else fallback to something safe.
- `EMAIL;TYPE=INTERNET:` user email (if you decide email is part of “contact”)

If you decide email should not be shown even after grant (because visitor already knows it): you can omit it.

Example:

```
BEGIN:VCARD
VERSION:3.0
FN:John Doe
EMAIL;TYPE=INTERNET:john@example.com
END:VCARD
```

Make sure to escape newlines/commas/semicolons per vCard rules.

## Implementation steps

### Step 1 — Add a small token validation helper
Create `apps/api/src/card/card.grants.ts` (or reuse `card.tokens.ts`) with:

```ts
export function hashCardToken(rawToken: string): string;
```

Then in `CardService`, add:

```ts
async getActiveGrantByRawToken(rawToken: string): Promise<{ grantId: string; modeId: string; }>
```

### Step 2 — Add controller
Add `apps/api/src/card/card.vcard.controller.ts`:

```ts
@Controller("card")
export class CardVCardController {
  @Get("vcard")
  @Throttle({ "card-public": {} })
  async vcard(@Headers("X-Card-Token") token: string, @Query("publicId") publicId: string, @Query("modeSlug") modeSlug: string, @Res() res: Response) { ... }
}
```

Note: using `@Res()` makes it easier to set content-disposition; follow existing repo patterns if any.

### Step 3 — Service method
In `CardService`, add:

```ts
async generateVCard(args: { rawToken: string; publicId: string; modeSlug: string }): Promise<{ filename: string; vcf: string }>
```

Implementation:
- validate token -> active grant
- resolve grant -> mode -> card -> user
- ensure mode matches query publicId + slug
- build vCard

### Step 4 — Tests
Add tests in `apps/api/src/card/card.service.spec.ts` for:
- invalid token
- expired token
- revoked token
- token valid but mode mismatch
- valid token returns vCard

Mock Prisma.

### Step 5 — Wire controller
Update `apps/api/src/card/card.module.ts` to include `CardVCardController`.

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

## Acceptance criteria
- `GET /v1/card/vcard` returns downloadable `.vcf` when token is valid
- invalid/expired/revoked tokens fail consistently
- no contact leakage without token
- tests pass
