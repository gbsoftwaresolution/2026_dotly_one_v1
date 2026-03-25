<!--
Booster Personal Card
Micro-sprint 5.2 implementation prompt for VS Code Copilot

Scope: Owner dashboard UI for managing Card (modes, requests, grants, attachments, analytics)
-->

# Micro-sprint 5.2 — Web UI: Owner dashboard (Copilot prompt)

## Role
You are a senior frontend engineer working in `apps/web`.

## Goal
Build an **owner-only** dashboard to manage the Personal Card feature end-to-end.

Owner should be able to:
1) See their card public link(s)
2) Create/manage modes (free vs premium limits enforced by API)
3) View contact requests inbox per mode
4) Approve/deny requests, revoke grants
5) Manage attachments (album-first; list/add/revoke/delete/reorder)
6) View private analytics per mode

## Context / existing patterns
- Auth + layout: routed under `/app/vault/*` and `/apps/*` with `RequireAuth`.
- Existing “Shares” page is a good pattern for owner management UI: `apps/web/src/pages/Shares.tsx`.
- API client helpers: `apps/web/src/api/client.ts` with `get/post/put/del`.
- Toasts + error states exist.

## Recommended route placement
Add an authenticated route:

- `/apps/card` (recommended, as Card is a “surface layer app” similar to Life Docs)

Or place under Vault settings:
- `/app/vault/settings/card`

Pick one and be consistent.

## Backend endpoints assumed available
From previous micro-sprints:

Public:
- `GET /v1/card/public/:publicId/modes/:modeSlug`

Owner (JWT):
- `GET /v1/card/modes` and `POST /v1/card/modes` (4.2)
- `GET /v1/card/modes/:modeId/contact-requests` (2.1)
- `POST /v1/card/contact-requests/:requestId/approve` (2.2)
- `POST /v1/card/contact-requests/:requestId/deny` (2.2)
- `POST /v1/card/contact-grants/:grantId/revoke` (2.2)

Attachments:
- `GET /v1/card/modes/:modeId/attachments` (3.1)
- `POST /v1/card/modes/:modeId/attachments` (3.1)
- `PUT /v1/card/attachments/:attachmentId` (3.2)
- `POST /v1/card/attachments/:attachmentId/revoke` (3.2)
- `DELETE /v1/card/attachments/:attachmentId` (3.2)
- `PUT /v1/card/modes/:modeId/attachments/reorder` (3.2)

Analytics:
- `GET /v1/card/modes/:modeId/analytics` (4.1)

Username (premium):
- `PUT /v1/card/username` (4.2)

## Shared DTOs assumed
Use types from `@booster-vault/shared`:
- card mode responses, contact request list, approve response, attachment DTOs, analytics response.

## Files to add

### 1) API client module
Create `apps/web/src/api/card.owner.ts` (separate from public `card.ts`).

It should include methods like:

```ts
export const cardOwnerApi = {
  listModes(): Promise<...>,
  createMode(dto): Promise<...>,
  listContactRequests(modeId: string, status?: string): Promise<ListCardContactRequestsResponse>,
  approveRequest(requestId: string, dto: ApproveCardContactRequestDto): Promise<ApproveCardContactRequestResponse>,
  denyRequest(requestId: string): Promise<void>,
  revokeGrant(grantId: string): Promise<void>,
  listAttachments(modeId: string): Promise<ListCardAttachmentsResponse>,
  createAttachment(modeId: string, dto: CreateCardAttachmentDto): Promise<CardAttachmentResponse>,
  updateAttachment(attachmentId: string, dto: UpdateCardAttachmentDto): Promise<CardAttachmentResponse>,
  revokeAttachment(attachmentId: string): Promise<void>,
  deleteAttachment(attachmentId: string): Promise<void>,
  reorderAttachments(modeId: string, attachmentIds: string[]): Promise<CardAttachmentResponse[]>,
  getModeAnalytics(modeId: string): Promise<CardModeAnalyticsResponse>,
  updateUsername(dto: UpdateCardUsernameDto): Promise<{ username: string }>,
};
```

### 2) Page: `CardDashboard.tsx`
Create `apps/web/src/pages/CardDashboard.tsx`.

Layout suggestion (single page with sections):

#### Section A — Your Card link
- Show publicId (if the API provides it; if not, show a placeholder)
- Build shareable link: `${origin}/u/${publicId}/personal`

#### Section B — Modes
- List modes
- Button to create mode (name + slug)
- If API returns a “mode limit reached” error, show upgrade hint.

#### Section C — Requests Inbox
- Mode selector
- List PENDING requests
- For each request:
  - Approve (choose duration 7/30; premium custom optional)
  - Deny
- On approve, show the returned raw token in a “copy once” UI (warn user it won’t be shown again).

#### Section D — Attachments
- List current attachments
- Add album attachment:
  - input for albumId (MVP)
  - label
  - create
- Reorder attachments (up/down buttons is fine)
- Revoke/delete

#### Section E — Analytics
- Show `viewsTotal`, `lastViewedAt`, request counts, approval rate

### 3) Router wiring
Update `apps/web/src/app/router.tsx`:
- lazy import CardDashboard
- add route under authenticated `/apps` group:

```tsx
<Route path="card" element={<CardDashboard />} />
```

Add a navigation link (optional):
- In Layout sidebar, add “Card” under Apps.

## UX + safety notes
- Never show requester email/phone in toasts.
- Mask long tokens (show full only after explicit click) and provide “Copy” button.
- Use `window.confirm` for destructive actions (deny/revoke/delete).

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/web dev
```

## Acceptance criteria
- Authenticated user can manage modes
- Authenticated user can approve/deny requests and copy the token
- Attachments can be managed
- Analytics are visible
- No crashes, and errors are handled with ErrorState/Toast
