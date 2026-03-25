<!--
Booster Personal Card
Micro-sprint 1.1 implementation prompt for VS Code Copilot

Scope: Backend API module + first public read endpoint (sanitized mode view)
-->

# Micro-sprint 1.1 — API module + public mode read endpoint (Copilot prompt)

## Role
You are a senior backend engineer working in `apps/api` (NestJS + Prisma).

## Goal
Implement the **first public endpoint** for Booster Personal Card:
- fetch a **public card mode view** (sanitized)
- return mode + attachments
- enforce Mode isolation
- do **not** leak contact info or internal IDs

This micro-sprint intentionally does **not** implement contact request/approval yet.

## Context / repo conventions
- API global prefix is `v1` (`apps/api/src/main.ts` uses `app.setGlobalPrefix("v1")`).
- Controllers use `@Controller("...")` and typically return `{ ... }` objects or DTO responses.
- Rate limiting via `@nestjs/throttler` is available; named throttlers are configured in `apps/api/src/app.module.ts`.
- Use Prisma via `PrismaService`.
- Shared types come from `@booster-vault/shared`.

Prereqs assumed complete:
- Micro-sprint 0.1 schema exists in Prisma (`PersonalCard`, `CardMode`, `CardAttachment`, etc.)
- Micro-sprint 0.2 shared DTOs exist under `packages/shared/src/card/*` and are exported.

Specs:
- `docs/card/card.context.md` (non-negotiables)
- `docs/card/card.spec.md`

## Deliverables
1) New Nest module: `apps/api/src/card/card.module.ts`
2) Public controller + service:
   - `apps/api/src/card/card.public.controller.ts`
   - `apps/api/src/card/card.service.ts`
3) Unit tests (service-level): `apps/api/src/card/card.service.spec.ts`
4) Wire module into `apps/api/src/app.module.ts`

## Endpoint design

### Route
`GET /v1/card/public/:publicId/modes/:modeSlug`

Notes:
- `publicId` is the stable public card identifier (not userId)
- `modeSlug` identifies mode under that card
- This endpoint must be public (no JWT)

### Response shape
Return the shared contract:
- `GetPublicCardModeResponse`

Example:

```json
{
  "mode": {
    "modeId": "...",
    "cardPublicId": "...",
    "slug": "personal",
    "name": "Personal",
    "headline": "...",
    "bio": "...",
    "contactGate": "REQUEST_REQUIRED",
    "indexingEnabled": false,
    "themeKey": "carbon",
    "createdAt": "2026-02-21T...Z",
    "updatedAt": "2026-02-21T...Z"
  },
  "attachments": [
    {
      "id": "...",
      "kind": "ALBUM",
      "refId": "...",
      "label": "Family album",
      "sortOrder": 0
    }
  ]
}
```

## Security / privacy requirements
1) **Do not return** `userId`, `cardId`, `mode.cardId`, or any internal FK.
2) Attachments must not leak storage URLs or any object keys.
3) Default stance is privacy: if something is ambiguous, omit it.

## Rate limiting
Add a dedicated throttler name `card-public` in `AppModule` throttlers (similar to `share-public`).

Then annotate the endpoint:

```ts
@Throttle({ "card-public": {} })
```

## Implementation steps

### Step 1 — Create module skeleton
Create folder: `apps/api/src/card/`

Add:
- `card.module.ts`
- `card.public.controller.ts`
- `card.service.ts`

Follow patterns from `apps/api/src/sharing/sharing.module.ts` and `apps/api/src/life-docs/life-docs.module.ts`.

### Step 2 — Implement `CardService.getPublicModeView()`
Implement method:

```ts
async getPublicModeView(args: { publicId: string; modeSlug: string }): Promise<GetPublicCardModeResponse>
```

Prisma queries:
- Find `PersonalCard` by `publicId` and include modes filtered by slug OR query `CardMode` joined to `PersonalCard`.
- Ensure `CardMode.slug` match is case-sensitive or normalized consistently.
- Fetch attachments for that mode ordered by `sortOrder asc, createdAt asc`.

Edge cases:
- If card not found → `NotFoundException`
- If mode not found → `NotFoundException`
- If attachment `revokedAt` is set, omit it from public list.
- If attachment `expiresAt` is in the past, omit it.

Mapping:
- Convert Date → ISO string.
- Map Prisma enums → shared string enums.

### Step 3 — Controller
Implement:

```ts
@Controller("card/public")
export class CardPublicController {
  @Get(":publicId/modes/:modeSlug")
  @Throttle({ "card-public": {} })
  async getMode(...): Promise<GetPublicCardModeResponse>
}
```

### Step 4 — Wire throttler config
Update `apps/api/src/app.module.ts`:
- add a new throttler entry `{ name: "card-public", ttl: ..., limit: ... }`
- add config fields if missing, or reuse default/share-public values as a placeholder.

If config additions are needed:
- update `apps/api/src/config/config.service.ts` and `.env.example` accordingly.

### Step 5 — Tests
Add `apps/api/src/card/card.service.spec.ts` with mocked Prisma.

Test cases:
1) returns mode + attachments for valid publicId + slug
2) filters revoked attachments
3) filters expired attachments
4) throws NotFound when card missing
5) throws NotFound when mode missing

Use existing testing style seen in `apps/api/src/sharing/sharing.service.spec.ts` (mock Prisma service methods).

### Step 6 — Smoke checks
Run:

```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

Optional manual test:
- start API and curl the endpoint.

## Acceptance criteria
- Endpoint exists under `/v1/card/public/:publicId/modes/:modeSlug`.
- Response uses shared DTOs.
- No internal identifiers or contact fields are returned.
- Throttling applies.
- Jest tests pass.
