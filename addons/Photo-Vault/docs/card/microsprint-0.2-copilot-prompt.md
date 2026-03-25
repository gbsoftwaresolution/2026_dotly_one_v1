<!--
Booster Personal Card
Micro-sprint 0.2 implementation prompt for VS Code Copilot

Scope: Shared contracts (DTOs/types) in packages/shared.
-->

# Micro-sprint 0.2 — Shared Card contracts (Copilot prompt)

## Role
You are a senior TypeScript engineer. You will add shared DTOs/types for the upcoming “Booster Personal Card” feature.

## Goal
Create a new shared “card” area under `packages/shared/src/` so both:
- `apps/api` (NestJS controllers/services) and
- `apps/web` (React client)

can consume **one canonical set of request/response shapes**.

This sprint does **not** implement any API endpoints yet.

## Context
Specs:
- `docs/card/card.context.md`
- `docs/card/card.spec.md`

Data model (Prisma) was introduced in Micro-sprint 0.1 (see `docs/card/microsprint-0.1-copilot-prompt.md`).

Repo conventions:
- `packages/shared/src/*` contains shared DTOs/types.
- API imports from `@booster-vault/shared` (via jest moduleNameMapper, and build outputs in `packages/shared/dist/*`).

## Deliverables
1) New shared module: `packages/shared/src/card/`
2) Export from `packages/shared/src/index.ts`
3) Type-check passes workspace-wide

## Constraints
- Keep types **JSON-serializable** (no `Date` objects in runtime; use `string` ISO timestamps when representing API payloads).
- Prefer explicit field names (avoid overly generic `any`).
- Keep v1 minimal; do not add messaging/calls.

## Files to add/update

### 1) Add folder and barrel
Create:
- `packages/shared/src/card/index.ts`

### 2) Add enums and core types
Create:
- `packages/shared/src/card/card.types.ts`

Include enums mirroring the Prisma semantics (string unions or `export enum`, choose whichever is consistent with other shared modules):

- `CardContactGate`: `OPEN | REQUEST_REQUIRED | HIDDEN`
- `CardContactRequestStatus`: `PENDING | APPROVED | DENIED | EXPIRED | REVOKED`
- `CardAttachmentKind`: `ALBUM | MEDIA | LIFE_DOC`

Also include lightweight “entity” response shapes (these are API responses, not DB rows):

```ts
export type IsoDateString = string;

export interface PersonalCardResponse {
  id: string;
  userId: string; // internal; will not be exposed publicly in v1 public endpoints, but useful for owner views
  publicId: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CardModePublicResponse {
  modeId: string;
  cardPublicId: string;
  slug: string;

  // public fields
  name: string;
  headline?: string;
  bio?: string;

  // policy flags (safe to expose)
  contactGate: CardContactGate;
  indexingEnabled: boolean;
  themeKey?: string;

  // timestamps
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CardAttachmentResponse {
  id: string;
  kind: CardAttachmentKind;
  refId: string;
  label?: string;
  sortOrder: number;
  expiresAt?: IsoDateString;
  revokedAt?: IsoDateString;
}
```

### 3) Add DTOs for upcoming endpoints
Create:
- `packages/shared/src/card/card.dtos.ts`

DTOs we will need soon:

#### Public read
- `GetPublicCardModeResponse`:
  - `{ mode: CardModePublicResponse; attachments: CardAttachmentResponse[] }`

#### Public contact request submit
`CreateCardContactRequestDto`:

```ts
export interface CreateCardContactRequestDto {
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  message?: string;
}
```

Response:

```ts
export interface CreateCardContactRequestResponse {
  requestId: string;
  status: CardContactRequestStatus; // PENDING
  createdAt: IsoDateString;
}
```

#### Owner approval

```ts
export interface ApproveCardContactRequestDto {
  // duration selection
  expiresInDays?: number; // 7/30 etc.
  expiresAt?: IsoDateString; // premium custom in future
}

export interface ApproveCardContactRequestResponse {
  grantId: string;
  // raw token returned ONCE; server stores only tokenHash
  token: string;
  expiresAt: IsoDateString;
}
```

#### vCard download (future)
We won’t implement vCard here, but we can define a response for it:

```ts
export interface CardVCardResponse {
  filename: string; // e.g. "contact.vcf"
  contentType: "text/vcard" | "text/x-vcard";
  vcf: string;
}
```

### 4) Export from root shared index
Update `packages/shared/src/index.ts` to export the new card module:

```ts
export * from "./card";
```

## Quality checks
Run:

```bash
pnpm -w type-check
```

Optionally:

```bash
pnpm --filter @booster-vault/api test
```

## Acceptance criteria
- Card types are available as `import { ... } from "@booster-vault/shared"`
- Workspace type-check passes
- No circular deps introduced in shared package

## Notes
- Keep names stable and explicit; we will use these types in Nest controllers soon.
- Use ISO date strings for API payloads.
