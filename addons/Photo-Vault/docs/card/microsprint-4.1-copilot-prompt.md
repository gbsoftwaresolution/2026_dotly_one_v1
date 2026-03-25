<!--
Booster Personal Card
Micro-sprint 4.1 implementation prompt for VS Code Copilot

Scope: Analytics MVP (private aggregates only; no viewer identity)
-->

# Micro-sprint 4.1 — Card analytics MVP (Copilot prompt)

## Role
You are a senior backend engineer working in `apps/api` + `packages/shared` (optional web UI later).

## Goal
Implement **private, aggregate-only analytics** for Personal Card.

Requirements from `docs/card/card.context.md`:
- Analytics are **private** (owner can see, public cannot)
- Do **not** expose viewer identity, IP logs in UI, or behavioral tracking
- Keep it minimal: counts + timestamps

## MVP metrics
Per Mode (recommended):
1) `viewsTotal` (anonymous)
2) `lastViewedAt`
3) `contactRequestsTotal`
4) `approvalsTotal`
5) `denialsTotal`
6) `activeGrantsTotal` (computed) + `expiredGrantsTotal` (optional)

Optional (premium later): attachment click tracking.

## Deliverables
1) DB schema for analytics (migration)
2) API endpoints for owner to retrieve analytics
3) Server-side event recording hooks on existing endpoints:
   - public mode view → view count increment
   - create contact request → requests count increment
   - approve/deny → approvals/denials count increment
4) Jest tests

## Data model options

### Option A (recommended MVP): dedicated aggregate table
Add Prisma model `CardModeAnalytics` keyed by `modeId`.

Pros: simple, cheap reads.
Cons: additional writes.

Model example:

```prisma
model CardModeAnalytics {
  modeId            String   @id @map("mode_id")
  viewsTotal        BigInt   @default(0) @map("views_total")
  lastViewedAt      DateTime? @map("last_viewed_at")
  contactRequestsTotal BigInt @default(0) @map("contact_requests_total")
  approvalsTotal    BigInt   @default(0) @map("approvals_total")
  denialsTotal      BigInt   @default(0) @map("denials_total")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  mode CardMode @relation(fields: [modeId], references: [id], onDelete: Cascade)

  @@map("card_mode_analytics")
}
```

Also add to `CardMode`:

```prisma
analytics CardModeAnalytics?
```

### Option B: compute on the fly
Compute counts via queries on `CardContactRequest` and `CardContactGrant`.

This is fine for small scale but can be more expensive and harder to keep fast.

Pick **Option A**.

## API endpoints

### 1) Owner: get mode analytics
`GET /v1/card/modes/:modeId/analytics`

Auth: JWT required
Owner-only: mode.card.userId must match userId.

Response (add to shared):

```ts
export interface CardModeAnalyticsResponse {
  modeId: string;
  viewsTotal: number;
  lastViewedAt?: IsoDateString;
  contactRequestsTotal: number;
  approvalsTotal: number;
  denialsTotal: number;
  activeGrantsTotal: number; // computed from grants where revokedAt null and expiresAt > now
}
```

### 2) Owner: list analytics for all modes (optional)
`GET /v1/card/analytics`

Return analytics for all modes under the user’s card.

Status: implemented.

## Event recording hooks

### A) Public mode view → view increment
In `CardService.getPublicModeView()`:
- after successful mode lookup, increment analytics:
  - `viewsTotal += 1`
  - `lastViewedAt = now`

Implement with upsert:

```ts
await prisma.cardModeAnalytics.upsert({
  where: { modeId: mode.id },
  create: { modeId: mode.id, viewsTotal: 1, lastViewedAt: now },
  update: { viewsTotal: { increment: 1 }, lastViewedAt: now },
});
```

Avoid doing this write if request fails early.

### B) Create contact request → request increment
In `createContactRequest()` after creation succeeds:
- increment `contactRequestsTotal` for mode.

### C) Approve/Deny → approvals/denials increment
In approve/deny flows (2.2):
- increment the appropriate counter.

Important: do not store viewer identity.

## Shared package updates
Add `CardModeAnalyticsResponse` to `packages/shared/src/card/card.dtos.ts` (or a new file) and export it.

## Tests
Add tests for:
- view increments analytics (mock upsert called)
- contact request increments counter
- owner analytics endpoint enforces ownership
- analytics response maps BigInt safely to number (guard overflow; ok for MVP)

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
pnpm --filter @booster-vault/api prisma:migrate:dev
```

## Acceptance criteria
- Analytics are private and owner-only
- Counts increment on key events
- No viewer identity stored
- Tests pass
