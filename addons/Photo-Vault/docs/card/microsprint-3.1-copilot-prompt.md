<!--
Booster Personal Card
Micro-sprint 3.1 implementation prompt for VS Code Copilot

Scope: Album attachments on card modes by reusing existing Sharing links.
-->

# Micro-sprint 3.1 — Mode attachments (album-first via Sharing) (Copilot prompt)

## Role
You are a senior full-stack engineer working in this monorepo:
- Backend: `apps/api` (NestJS + Prisma)
- Shared contracts: `packages/shared`
- Web: `apps/web`

## Goal
Enable **Vault-sourced attachments** on Personal Card modes, starting with **albums**, by reusing the existing **Sharing** system.

This micro-sprint should allow an owner to:
1) Attach an album to a Card Mode
2) Have the public Card Mode endpoint return a **safe public link** to the already-existing Shared Album page (`/shared/:shareId`) when available

Important: we must **not** introduce new storage. All content remains Vault-sourced.

## Key design decision (MVP)
We will **not** build new cryptography flows for Card attachments in this sprint.

Instead:
- A Card Mode can reference an `albumId` (Vault album).
- The public Card endpoint will *resolve* that album into an active share link **only if** a `SharedAlbum` already exists for `(albumId, ownerUserId)` (this is already unique in the Prisma schema) and is not revoked/expired.
- If no active share exists, we omit the attachment from the public response (privacy-first).

This reuses the existing and proven sharing unlock page:
- Web route: `/shared/:shareId` (already implemented)

## Prereqs assumed complete
- Micro-sprints 0.1–2.4 are implemented (schema, DTOs, public mode view, contact request, grants, vCard, contact reveal).
- Prisma includes `SharedAlbum` and `ShareAccessToken` (already in repo).

## Deliverables
1) **Owner API**: create/list/reorder Card attachments for a mode
2) **Public API**: resolve ALBUM attachments into share links (if share exists)
3) Shared DTO updates in `packages/shared/src/card`
4) Minimal web UI affordance (optional but recommended): add attachment config entry point on a Settings page

## API work

### A) Shared DTO updates
Update `packages/shared/src/card/card.types.ts` and/or `card.dtos.ts` to support “resolved attachments”.

Recommended change (keep backward compatible):

```ts
export interface CardAttachmentResolvedLink {
  kind: "SHARED_ALBUM";
  shareId: string;
  shareLink: string; // absolute web URL
  expiresAt: IsoDateString;
}

export interface CardAttachmentResponse {
  id: string;
  kind: CardAttachmentKind;
  refId: string;
  label?: string;
  sortOrder: number;
  expiresAt?: IsoDateString;
  revokedAt?: IsoDateString;

  // NEW
  resolvedLink?: CardAttachmentResolvedLink;
}
```

Also add DTOs for owner management:

```ts
export class CreateCardAttachmentDto {
  kind!: CardAttachmentKind; // only ALBUM supported in 3.1
  refId!: string;            // albumId
  label?: string;
  sortOrder?: number;
}

export interface CreateCardAttachmentResponse {
  attachment: CardAttachmentResponse;
}

export interface ListCardAttachmentsResponse {
  attachments: CardAttachmentResponse[];
}
```

Use `class-validator` for DTO validation (as already done for `CreateCardContactRequestDto`).

### B) Owner endpoints
Add a new controller (or extend existing owner controller if you have one):

#### Create attachment
`POST /v1/card/modes/:modeId/attachments`
- JWT auth required
- owner-only (mode.card.userId must match)
- body: `CreateCardAttachmentDto`
- enforce `kind === "ALBUM"` for this sprint
- validate album ownership: `Album.userId` must match owner

#### List attachments
`GET /v1/card/modes/:modeId/attachments`
- JWT auth required
- owner-only

Optional in this sprint:
- `DELETE /v1/card/attachments/:attachmentId`
- `PUT /v1/card/attachments/:attachmentId` (label/sortOrder)

### C) Public endpoint changes
Update `apps/api/src/card/card.service.ts` mapping inside `getPublicModeView()`:

When building `attachments`, for each attachment of kind `ALBUM`:
1) Resolve `albumId = attachment.refId`
2) Lookup active `SharedAlbum`:

```ts
const share = await prisma.sharedAlbum.findFirst({
  where: {
    albumId: albumId,
    ownerUserId: mode.card.userId,
    revokedAt: null,
    expiresAt: { gt: now },
  },
  select: { id: true, expiresAt: true },
});
```

3) If found, set:
- `resolvedLink.kind = "SHARED_ALBUM"`
- `shareId = share.id`
- `shareLink = `${config.webAppUrl}/shared/${share.id}`` (use `ConfigService.webAppUrl` like SharingService)
- `expiresAt = share.expiresAt.toISOString()`

4) If not found, **omit** the attachment from public response.

Notes:
- This keeps “Vault is only file source” and avoids exposing storage URLs.
- It also ensures revocation/expiry immediately removes the link.

## Web (optional but recommended)
Add a small owner UI to attach albums:
- New section in Settings (or a new page) that lists modes and allows selecting an album to attach.
- On attach, call owner attachment endpoint.

We do NOT need to create shares here; user can create a share via existing Shares UI.

## Tests

### Backend service tests
Extend `apps/api/src/card/card.service.spec.ts`:
- when mode has an ALBUM attachment but no active share exists → attachment omitted
- when an active share exists → attachment includes `resolvedLink.shareId/shareLink/expiresAt`

Add tests for owner attachment creation:
- rejects non-owner
- rejects album not owned
- rejects kind != ALBUM

Mock Prisma + ConfigService.

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
pnpm --filter @booster-vault/web test
```

## Acceptance criteria
- Owner can attach an album to a mode
- Public mode view returns a working `/shared/:shareId` link when (and only when) an active share exists
- No direct storage URLs or sensitive IDs are exposed
- Revoked/expired shares disappear from public card immediately
- Tests pass
