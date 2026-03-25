<!--
Booster Personal Card
Micro-sprint 2.1 implementation prompt for VS Code Copilot

Scope: Public contact request submission endpoint + basic owner inbox (optional)
-->

# Micro-sprint 2.1 — Public contact request endpoint (Copilot prompt)

## Role
You are a senior backend engineer working in `apps/api` (NestJS + Prisma).

## Goal
Implement the **public** “Request contact access” flow backend for Booster Personal Card.

This sprint focuses on:
1) Public endpoint to create a `CardContactRequest` (throttled)
2) Validations + mode policy enforcement (`contactGate`)
3) Minimal owner endpoints to list pending requests (optional but recommended)

We do **not** implement vCard generation or approval/grants yet (that’s Micro-sprint 2.2/2.3).

## Context
- API prefix is `/v1`.
- Existing Card read endpoint exists: `GET /v1/card/public/:publicId/modes/:modeSlug`.
- Card module exists: `apps/api/src/card/*`.
- Rate limiting buckets exist; use `card-public` or create a new `card-contact-public` bucket.
- Shared DTOs should be used from `@booster-vault/shared` (Micro-sprint 0.2).

## Endpoints to implement

### 1) Public: create contact request
`POST /v1/card/public/:publicId/modes/:modeSlug/contact-requests`

Body: `CreateCardContactRequestDto`

Response: `{ request: CreateCardContactRequestResponse }`

#### Policy rules
- If mode not found → 404
- If `mode.contactGate === "HIDDEN"`:
  - Return `404` (preferred to avoid confirming existence) OR `403`. Pick one and use consistently.
- If `mode.contactGate === "OPEN"`:
  - For v1, still allow creating a request (for analytics) but clearly document; OR reject because it’s open. Choose **one**.
  - My recommendation: **still allow request** and keep UI optional; but if you reject, do so with 400 and a stable message.
- If `mode.contactGate === "REQUEST_REQUIRED"`: allow.

#### Validation rules
- `requesterName`: 2..80 chars (trim)
- `requesterEmail`: must look like email, lower-case/trim stored
- `requesterPhone`: optional, max 30 chars
- `message`: optional, max 1000 chars

Do not store IP/user-agent in DB in this sprint.

#### Abuse resistance
- Add throttling:
  - `@Throttle({ "card-public": {} })` is acceptable,
  - or introduce `card-contact-public` with tighter limit.
- Add a cheap dedupe to reduce spam:
  - If same `modeId + requesterEmail` has a PENDING request in last X hours (e.g. 24h), return `409 Conflict`.

### 2) Owner (JWT): list contact requests for a mode (recommended)
`GET /v1/card/modes/:modeId/contact-requests?status=PENDING&limit=50&cursor=...`

This is authenticated and owner-only.

Return a simple list response (define in shared if needed):

```ts
export interface ListCardContactRequestsResponse {
  items: Array<{
    id: string;
    status: CardContactRequestStatus;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    message?: string;
    createdAt: IsoDateString;
  }>;
  nextCursor?: string;
}
```

If you don’t want to add pagination now, keep it simple: `items` only.

## Implementation steps

### Step 1 — Shared DTO gaps
If `ListCardContactRequestsResponse` isn’t in shared yet, add it under `packages/shared/src/card/card.dtos.ts` and export.

### Step 2 — Add service methods
In `apps/api/src/card/card.service.ts`, add:

```ts
async createContactRequest(args: {
  publicId: string;
  modeSlug: string;
  dto: CreateCardContactRequestDto;
}): Promise<CreateCardContactRequestResponse>
```

Implementation notes:
- Resolve card by `publicId`, mode by `(cardId, slug)`.
- Enforce `contactGate` policy.
- Normalize email to lower-case.
- Implement dedupe check (recent pending request).
- Create request row.
- Return response with `createdAt.toISOString()`.

Owner list (optional):

```ts
async listModeContactRequests(args: { userId: string; modeId: string; status?: CardContactRequestStatus }): Promise<ListCardContactRequestsResponse>
```

Owner check:
- `mode.card.userId` must equal `userId`.

### Step 3 — Add controller routes
In `apps/api/src/card/card.public.controller.ts`:
- add `POST :publicId/modes/:modeSlug/contact-requests`

Create a new owner controller `apps/api/src/card/card.owner.controller.ts`:

```ts
@Controller("card")
@UseGuards(JwtAuthGuard)
export class CardOwnerController {
  @Get("modes/:modeId/contact-requests")
  ...
}
```

### Step 4 — Tests
Add/extend `apps/api/src/card/card.service.spec.ts` tests:
- creating request success
- hidden mode policy enforced
- dedupe returns Conflict
- owner list enforces ownership

Mock Prisma similarly to sharing tests.

### Step 5 — Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

## Acceptance criteria
- Public POST endpoint exists and is throttled.
- Contact requests are stored per mode.
- Mode isolation preserved.
- Hidden modes do not leak existence.
- Basic anti-spam dedupe works.
- Jest tests pass.
