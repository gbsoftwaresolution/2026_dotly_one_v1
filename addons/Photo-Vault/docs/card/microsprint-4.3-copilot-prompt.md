<!--
Booster Personal Card
Micro-sprint 4.3 implementation prompt for VS Code Copilot

Scope: Abuse resistance hardening for public contact-request + token endpoints
-->

# Micro-sprint 4.3 — Abuse resistance hardening (Copilot prompt)

## Role
You are a senior backend engineer implementing security hardening for public endpoints.

## Goal
Harden Booster Personal Card public surfaces to resist spam/abuse while preserving privacy.

This sprint focuses on:
1) CAPTCHA verification for **public contact requests**
2) Stricter throttling buckets for public Card endpoints
3) Progressive trust hooks (minimal)
4) Tests

## Constraints from canonical spec
- Abuse resistance is required: rate limits, CAPTCHA, request throttling.
- Do not turn Card into a surveillance tool (avoid storing IP addresses unless strictly necessary).

## What to harden (endpoints)
Public endpoints currently include (or will include):
- `GET /v1/card/public/:publicId/modes/:modeSlug`
- `POST /v1/card/public/:publicId/modes/:modeSlug/contact-requests`
- `GET /v1/card/vcard` (grant-token protected)
- `GET /v1/card/public/:publicId/modes/:modeSlug/contact` (grant-token protected)

Primary abuse vector: `contact-requests`.

## CAPTCHA choice
Use **Cloudflare Turnstile** (recommended) OR hCaptcha.

Implementation approach (Turnstile):
- Frontend obtains a token from Turnstile widget.
- Backend verifies token with Turnstile siteverify endpoint.

## Shared DTO update
Update `CreateCardContactRequestDto` in `packages/shared/src/card/card.dtos.ts`:

```ts
export class CreateCardContactRequestDto {
  // ... existing

  // NEW
  @IsString()
  @MaxLength(5000)
  captchaToken!: string;
}
```

If you want CAPTCHA to be optional in dev:
- make it `@IsOptional()` in DTO, but enforce at runtime based on config.

## Backend config
Add env vars (and wire into ConfigService):

```env
TURNSTILE_SECRET_KEY=
TURNSTILE_ENABLED=true
TURNSTILE_VERIFY_URL=https://challenges.cloudflare.com/turnstile/v0/siteverify
```

Add to `.env.example`.

## Backend implementation

### Step 1 — Add a reusable CAPTCHA verification service
Create `apps/api/src/abuse/turnstile.service.ts` (or `captcha.service.ts`):

```ts
@Injectable()
export class TurnstileService {
  async verifyToken(args: { token: string; ip?: string }): Promise<void>;
}
```

Notes:
- Use `fetch` (Node 18+) to call siteverify.
- Do NOT log the token.
- If verification fails, throw `ForbiddenException("CAPTCHA failed")`.
- IP is optional; you may pass `req.ip` only if we decide it’s needed. Default: omit.

### Step 2 — Wire into Card public contact request endpoint
In `CardPublicController.createContactRequest()`:
- if turnstile enabled: call `turnstile.verifyToken({ token: dto.captchaToken })` before creating request.

### Step 3 — Add stricter throttling buckets
In `apps/api/src/app.module.ts` add named throttlers:
- `card-contact-public` (tight)
- `card-token-public` (for vCard/contact reveal)

Then in controllers:
- `contact-requests` uses `@Throttle({ "card-contact-public": {} })`
- token endpoints use `@Throttle({ "card-token-public": {} })`

If config keys don’t exist yet, add in `ConfigService`:
- `rateLimitCardContactPublicTtl`, `rateLimitCardContactPublicMax`
- `rateLimitCardTokenPublicTtl`, `rateLimitCardTokenPublicMax`

### Step 4 — Progressive trust hook (minimal)
Add a cheap server-side rule to reduce repeat spam without storing IP:
- If an email has > N denied requests in last 7 days for the same mode → block for 24h.

Implement as a query on `CardContactRequest` with status `DENIED`.

### Step 5 — Tests
Add unit tests (mock TurnstileService) to verify:
- when enabled and captcha missing → request rejected
- when enabled and captcha invalid → request rejected
- when disabled → request does not require captcha

Also ensure new throttler names exist.

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

## Acceptance criteria
- Public contact requests require valid CAPTCHA when enabled
- Stricter throttles are applied to high-risk endpoints
- No PII tokens logged
- Tests pass

## Status
- Implemented Turnstile verification service in `apps/api/src/abuse/turnstile.service.ts`
- Added `captchaToken` to shared `CreateCardContactRequestDto` (enforced when `TURNSTILE_ENABLED=true`)
- Added throttler buckets: `card-contact-public` and `card-token-public`
- Added progressive trust block based on repeated DENIED requests (no IP storage)
- Added controller unit tests and updated OpenAPI
