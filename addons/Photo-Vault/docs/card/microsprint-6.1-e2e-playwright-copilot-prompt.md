<!--
Booster Personal Card
Micro-sprint 6.1 implementation prompt for VS Code Copilot

Scope: E2E tests (Playwright) for critical Card flows
-->

# Micro-sprint 6.1 — E2E: Card flows (Playwright) (Copilot prompt)

## Role
You are a senior QA / test automation engineer.

## Goal
Add Playwright E2E coverage for the highest-risk Personal Card flows so regressions are caught early.

We want to validate:
1) Public card mode page loads
2) Visitor submits contact request
3) Owner approves request, receives token
4) Visitor uses token to reveal contact and download vCard
5) Revocation/expiry instantly blocks access

## Context
- Playwright config exists: `playwright.config.ts`
- E2E tests live under `e2e/*`.
- Existing E2E patterns: `e2e/thumbnail-ux.spec.ts`.
- Dev servers are started via scripts (see `scripts/e2e-serve.mjs`).

## Test data strategy
Prefer API-driven setup + UI-driven assertions:
- Create a user via API register endpoint
- Login via API to get tokens
- Create a PersonalCard + a default mode if the product now requires it

If the backend doesn’t yet provide “create mode” endpoints, seed DB directly (last resort).

## Files to add
- `e2e/card-flow.spec.ts`

## Helper utilities
Add helper functions under `e2e/helpers/` if needed:
- `registerAndLogin()` returning `{ accessToken, refreshToken, userId }`
- `apiCreateCardMode()` etc.

## E2E Scenarios

### Scenario 1 — Public view + request
Steps:
1) Owner registers + verifies email if required (or bypass in dev)
2) Owner creates card + mode (slug `personal`)
3) Visitor opens `/u/:publicId/personal`
4) Assert page shows owner name/headline
5) Visitor submits contact request form
6) Assert success UI state

### Scenario 2 — Owner approves + visitor reveals contact
Steps:
1) Owner logs in and opens `/apps/card` dashboard
2) Approves pending request for 7 days
3) UI shows token; copy it
4) Visitor page uses token to reveal contact
5) Assert email is shown
6) Click “Download vCard” and assert a download with `.vcf` extension occurs

### Scenario 3 — Revoke blocks immediately
Steps:
1) Owner revokes grant
2) Visitor tries reveal again
3) Assert 401/blocked message

Optional Scenario 4 — Attachments link
If mode has album attachment with resolved share link:
- assert clicking attachment opens `/shared/:shareId`

## Playwright assertions
- Prefer role-based selectors (`getByRole`) and test ids if needed.
- Add `data-testid` attributes in UI components if selectors are unstable.

## Smoke checks
Run locally:

```bash
pnpm -w e2e
```

Or if using the existing serve script:

```bash
pnpm -w e2e:serve
pnpm -w e2e
```

## Acceptance criteria
- Tests are deterministic (no timing flakiness)
- Uses isolated test user(s)
- Validates the core security boundary: reveal/vCard requires token and revocation blocks
