<!--
Booster Personal Card
Micro-sprint 4.2 implementation prompt for VS Code Copilot

Scope: Premium gates (modes limit, vanity username, custom expiry)
-->

# Micro-sprint 4.2 — Premium gates (Copilot prompt)

## Role
You are a senior backend engineer implementing plan enforcement / premium gating.

## Goal
Implement the **Premium vs Free** rules for Booster Personal Card in a server-enforced way.

From spec (`docs/card/card.spec.md`):
- Free: 1 mode
- Premium: up to 3 modes
- Premium: vanity username (optional)
- Premium: custom expiry control

This sprint should deliver:
1) Mode count enforcement
2) Vanity username reservation + routing support (backend representation)
3) Custom expiry support for approvals (guarded)

## Constraints
- Identity is internal (userId is primary identity); username is display/routing only.
- Username must never be used as foreign key.
- Reserved words protection.
- Rate limit username changes (e.g. once per 12 months).

## Step 0 — Determine “Premium” in this codebase
Inspect existing billing/subscription data:
- Prisma: `Subscription.status` and `Subscription.plan`
- There is already plan logic in `apps/api/src/media/media.service.ts`.

Create helper:

```ts
export function isPremium(subscription: { status: SubscriptionStatus; plan: PlanCode }): boolean;
```

For MVP:
- treat any `SubscriptionStatus.ACTIVE` as premium
- (optional) treat certain plans as premium

## Part A — Mode count enforcement

### Data model
No schema changes required if `CardMode` already exists.

### API endpoints needed (owner)
If you don’t already have mode creation endpoints, add them:

- `POST /v1/card/modes` create mode
- `GET /v1/card/modes` list modes

Enforce:
- free users can create max **1** mode
- premium users can create max **3**

Implementation details:
- Determine user’s subscription
- Count modes under their `PersonalCard`
- Block with `ForbiddenException` and a stable error code e.g. `CARD_MODE_LIMIT_REACHED`

Tests:
- free user cannot create 2nd mode
- premium user can create 3, cannot create 4th

## Part B — Vanity username

### Data model changes
Add to `User` (or `PersonalCard`) a nullable unique `username`:

Option 1 (recommended): on `PersonalCard`:
- `username String? @unique`

Option 2: on `User`:
- `username String? @unique`

Either is fine as long as:
- userId remains identity
- username is optional

Also add:
- `usernameUpdatedAt DateTime?` for rate limiting changes

Add migration.

### API endpoints

#### Reserve/update username
`PUT /v1/card/username`

Body:

```ts
export class UpdateCardUsernameDto {
  username!: string;
}
```

Rules:
- Premium only
- Normalize:
  - lowercase
  - trim
  - allow `[a-z0-9_]{3,24}` (choose policy)
- Deny reserved words (list in code)
- Deny if already taken (unique constraint)
- Rate limit changes: if `usernameUpdatedAt` < now - 365 days → allow; else reject.

Response:
- `{ username: string }`

#### Public lookup (for routing)
`GET /v1/card/resolve-username/:username`

Returns:
- `{ publicId: string }` (so web can redirect to `/u/:publicId/...` or load via publicId)

Privacy:
- This is a public directory endpoint. Canonical says “no public discovery by default”.
- Therefore, only resolve if the user has at least one mode with `indexingEnabled=true` OR add a `usernamePublic=true` flag.

Pick a minimal approach:
- Resolve only if there exists a mode `indexingEnabled=true`.

## Part C — Custom expiry control

Micro-sprint 2.2 introduced approval DTO:
- `ApproveCardContactRequestDto { expiresInDays?: number; expiresAt?: IsoDateString }`

Enforce:
- Free: only allow `expiresInDays` in {7, 30} and/or `null` for permanent (if supported)
- Premium: allow custom `expiresAt` (still must be future and max horizon, e.g. 1 year)

Implementation:
- When approving a request, fetch subscription
- Validate expiry fields accordingly

Tests:
- free user cannot set custom expiresAt
- premium user can

## Shared package updates
Add DTOs:
- `UpdateCardUsernameDto`
- `ResolveUsernameResponse`

Export them.

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
pnpm --filter @booster-vault/api prisma:migrate:dev
```

## Acceptance criteria
- Mode count limits enforced server-side
- Username can be claimed only by premium users, with reserved words + change cooldown
- Public username resolution obeys “no discovery by default” (requires indexingEnabled)
- Custom expiry for approvals is premium-gated
- Tests pass
