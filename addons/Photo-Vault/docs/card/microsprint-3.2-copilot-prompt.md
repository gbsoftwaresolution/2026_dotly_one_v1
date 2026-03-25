<!--
Booster Personal Card
Micro-sprint 3.2 implementation prompt for VS Code Copilot

Scope: Attachment policy alignment (expiry/revoke/update/reorder) + public enforcement
-->

# Micro-sprint 3.2 — Attachment policy alignment (Copilot prompt)

## Role
You are a senior full-stack engineer working across `apps/api`, `packages/shared`, and optionally `apps/web`.

## Goal
Turn “attachments” into a complete, safe subsystem by adding:

1) Owner controls to **update / revoke / delete / reorder** Card attachments
2) Public enforcement so revoked/expired attachments disappear immediately
3) Consistent policy alignment between CardAttachment and underlying Sharing (for ALBUM attachments)

This sprint is intentionally still **album-first**.

## Context
- Micro-sprint 3.1 introduced ALBUM attachments resolved via active `SharedAlbum`.
- `CardAttachment` already has `expiresAt` and `revokedAt` fields in Prisma.
- Sharing already has its own expiry + revoke on `SharedAlbum`.

Policy objective:
- A public attachment link must only exist if BOTH:
  - CardAttachment is active (not revoked; not expired)
  - Underlying SharedAlbum is active (not revoked; not expired)

## Deliverables
### Backend
- Owner endpoints:
  - update attachment label/sortOrder/expiresAt
  - revoke attachment
  - delete attachment
  - reorder attachments (batch)
- Public endpoint behavior:
  - already filters revoked/expired; ensure it remains correct
  - share resolution must respect both layers

### Shared
- DTOs for update/reorder/revoke

### Optional Web
- Basic mode attachment management UI (list + reorder + revoke)

## Shared DTOs
Update `packages/shared/src/card/card.dtos.ts`:

```ts
export class UpdateCardAttachmentDto {
  label?: string;
  sortOrder?: number;
  expiresAt?: IsoDateString | null;
}

export interface UpdateCardAttachmentResponse {
  attachment: CardAttachmentResponse;
}

export interface RevokeCardAttachmentResponse { success: true }
export interface DeleteCardAttachmentResponse { success: true }

// Note: 3.1's `ReorderCardAttachmentsDto` (items with sortOrder) remains supported.
// 3.2 introduces a separate ordered-list DTO to avoid breaking 3.1.
export class ReorderCardAttachmentsOrderedDto {
  // ordered list of attachment ids (new order)
  attachmentIds!: string[];
}

export interface ReorderCardAttachmentsResponse {
  attachments: CardAttachmentResponse[];
}
```

Use `class-validator`:
- `attachmentIds` is array of UUID strings, min 1
- `label` max length (e.g. 80)

## Backend API endpoints

All endpoints below are JWT + owner-only.

### 1) Update attachment
`PUT /v1/card/attachments/:attachmentId`
Body: `UpdateCardAttachmentDto`
Response: `{ attachment }`

Rules:
- Attachment must exist
- Owner check via `attachment.mode.card.userId === userId`
- If `expiresAt` is set, it must be in the future (or allow setting past to effectively disable; decide one)

### 2) Revoke attachment
`POST /v1/card/attachments/:attachmentId/revoke`
Response: `{ success: true }`

Rules:
- set `revokedAt=now`

### 3) Delete attachment
`DELETE /v1/card/attachments/:attachmentId`
Response: `{ success: true }`

Rules:
- hard delete is ok (it’s just metadata)

### 4) Reorder attachments for a mode
`PUT /v1/card/modes/:modeId/attachments/reorder`
Body: `ReorderCardAttachmentsOrderedDto`
Response: `{ attachments }`

Implementation:
- ensure all ids belong to the mode
- update `sortOrder` sequentially (0..n-1) in a transaction

## Public enforcement
Update `CardService.getPublicModeView()` to enforce:

1) Filter out CardAttachment revoked/expired (already done)
2) When resolving share:
   - only resolve if card attachment is active
   - only resolve if share is active
3) If share is missing/inactive → omit attachment from public response

## Tests
Extend `apps/api/src/card/card.service.spec.ts` and add a controller spec if needed.

Test cases:
- owner cannot edit another user's attachment
- revoke makes attachment disappear from public response
- reorder updates sortOrder deterministically
- share resolution requires both layers active

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/api test
```

## Status
- Implemented owner endpoints: update, revoke, delete, reorder (ordered list)
- OpenAPI updated; drift audit passing
- Unit tests added in `apps/api/src/card/card.service.spec.ts`

## Acceptance criteria
- Owner can manage attachments (update/revoke/delete/reorder)
- Public mode endpoint never returns revoked/expired attachments
- Public mode endpoint only returns share link when share is active
- Tests pass
