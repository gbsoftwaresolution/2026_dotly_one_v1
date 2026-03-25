# V1 Spec Prompt — Stripe Webhook Signature Verification (NestJS)

## Role
You are a senior backend engineer implementing a security-critical fix in a NestJS API.

## Goal (V1 ship blocker)
Harden `POST /v1/billing/stripe/webhook` by verifying Stripe’s webhook signature using the official Stripe SDK.

**Current issue:** the controller accepts JSON bodies without signature verification, which allows forged events to activate subscriptions.

## Success Criteria
1. The server verifies webhook signatures using:
   - `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`
2. The endpoint uses the **raw request body bytes** (not JSON-parsed body) for verification.
3. If verification fails:
   - Return **401 Unauthorized** (or 400 if you prefer; pick one and be consistent).
   - Do **not** call `BillingService.processStripeWebhook`.
4. If verification succeeds:
   - Call `BillingService.processStripeWebhook(event.id, event.type, event)`.
   - Return **204 No Content** (preferred for webhooks) OR keep `{ success: true }` but update OpenAPI/README accordingly.
5. Add automated tests for:
   - Valid signature (happy path)
   - Missing signature header
   - Invalid signature

## Constraints / Notes
- Repo structure:
  - API: `apps/api`
  - Controller: `apps/api/src/billing/billing.controller.ts`
  - Service: `apps/api/src/billing/billing.service.ts`
  - Bootstrap: `apps/api/src/main.ts`
  - Config: `apps/api/src/config/config.service.ts`
- Global prefix is already set to `v1`.
- Stripe is already used in `BillingService`.
- **Signature verification requires raw body**; default Nest/Express JSON parsing will break it.

## Implementation Plan (do this in order)

### Step 1 — Add raw-body support ONLY for Stripe webhook route
In `apps/api/src/main.ts`, configure Express body parsing so that:
- For `POST /v1/billing/stripe/webhook` only, you capture the raw body buffer.

Recommended approach (Express):
- Use `express.raw({ type: 'application/json' })` on that route, **before** the global JSON parser.
- Ensure other routes still use JSON parsing.

Expected outcome:
- In the controller, you can access the raw payload bytes as `req.body` (Buffer) or via `req.rawBody` (if you choose a verify function approach).

### Step 2 — Verify signature in controller
In `apps/api/src/billing/billing.controller.ts`:
- Change the handler signature to accept `@Req() req` (Express Request) so you can read the raw body.
- Read header `stripe-signature`.
- Verify:
  - Instantiate `Stripe` (you may reuse existing instance or create a lightweight one here; prefer reuse via BillingService if it’s already safe/available).
  - `const event = stripe.webhooks.constructEvent(rawBody, signature, configService.stripeWebhookSecret)`
- If verification fails, throw `UnauthorizedException`.

### Step 3 — Preserve idempotency and existing business logic
- Keep `BillingService.processStripeWebhook(event.id, event.type, event)` as the only code path after verification.
- Do not modify subscription logic in this change.

### Step 4 — Tests
Add tests under `apps/api/src/billing/` (Jest + Supertest) that:
- Generate a signed webhook payload using Stripe’s test helper or manually compute using Stripe SDK.
- Assert:
  - 204/200 on valid signature
  - 401 on missing/invalid signature
  - Service method not called when invalid

### Step 5 — Documentation alignment
- Update `api/openapi.yaml` for the webhook response code and auth semantics if needed.
- Update README Billing section if response changes.

## Deliverables
- Code changes:
  - `apps/api/src/main.ts`
  - `apps/api/src/billing/billing.controller.ts`
  - `apps/api/src/billing/*.spec.ts` (new or updated)
- Docs changes:
  - `api/openapi.yaml` (if needed)
  - `README.md` (if needed)

## Acceptance Tests (manual)
1. Run API: `pnpm --filter @booster-vault/api dev`
2. Use Stripe CLI to send a signed event to `http://localhost:4000/v1/billing/stripe/webhook`.
3. Confirm:
   - Valid signature => processed
   - Invalid signature => rejected
