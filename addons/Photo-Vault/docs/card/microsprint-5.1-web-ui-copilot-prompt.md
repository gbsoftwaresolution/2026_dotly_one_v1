<!--
Booster Personal Card
Micro-sprint 5.1 implementation prompt for VS Code Copilot

Scope: Web UI (public card page) + API client glue.
-->

# Micro-sprint 5.1 — Web UI: Public Card Page (Copilot prompt)

## Role
You are a senior frontend engineer working in `apps/web` (React + Vite + react-router).

## Goal
Make Personal Card usable for visitors by implementing the **public Card page**:

1) View a mode surface (name/headline/bio + attachments)
2) Request contact access (submit form)
3) After approval, allow the visitor to:
   - paste/enter a grant token (`X-Card-Token`)
   - reveal contact (`/contact` endpoint)
   - download vCard (`/vcard` endpoint)

This sprint is public/unauthenticated and must be privacy-first.

## Context
Routing lives in `apps/web/src/app/router.tsx`.

Existing pattern to copy:
- `PublicSharedAlbumPage.tsx` (public experience with token header + progressive unlock)

API client:
- `apps/web/src/api/client.ts` exports `get/post/put/del` convenience wrappers.

Shared types:
- Card DTOs live in `@booster-vault/shared` under `packages/shared/src/card/*`.

## Routes to add
Add public routes (do not put behind RequireAuth):

1) `/u/:publicId/:modeSlug?`
2) `/card/:publicId/:modeSlug?` (optional alias for local dev)

Default mode slug:
- If `modeSlug` missing, use `"personal"` as a fallback (or show a “mode not found” error).

## API endpoints used
Assume backend exists (from micro-sprints):

- `GET /v1/card/public/:publicId/modes/:modeSlug`
  - returns `GetPublicCardModeResponse`

- `POST /v1/card/public/:publicId/modes/:modeSlug/contact-requests`
  - body: `CreateCardContactRequestDto`
  - returns `{ request: CreateCardContactRequestResponse }`

- `GET /v1/card/public/:publicId/modes/:modeSlug/contact`
  - header: `X-Card-Token`
  - returns `{ contact: CardContactRevealResponse }`

- `GET /v1/card/vcard?publicId=...&modeSlug=...`
  - header: `X-Card-Token`
  - returns downloadable `text/vcard` (attachment)

## Files to add

### 1) API module
Create `apps/web/src/api/card.ts`:

```ts
import { get, post } from "./client";
import type {
  GetPublicCardModeResponse,
  CreateCardContactRequestDto,
  CreateCardContactRequestResponse,
  CardContactRevealResponse,
} from "@booster-vault/shared";

export const cardApi = {
  async getPublicMode(publicId: string, modeSlug: string): Promise<GetPublicCardModeResponse> {
    return get(`/v1/card/public/${publicId}/modes/${modeSlug}`);
  },
  async createContactRequest(publicId: string, modeSlug: string, dto: CreateCardContactRequestDto): Promise<CreateCardContactRequestResponse> {
    const res = await post<{ request: CreateCardContactRequestResponse }>(
      `/v1/card/public/${publicId}/modes/${modeSlug}/contact-requests`,
      dto,
    );
    return res.request;
  },
  async revealContact(publicId: string, modeSlug: string, token: string): Promise<CardContactRevealResponse> {
    const res = await get<{ contact: CardContactRevealResponse }>(
      `/v1/card/public/${publicId}/modes/${modeSlug}/contact`,
      { headers: { "X-Card-Token": token } },
    );
    return res.contact;
  },
  async downloadVCard(publicId: string, modeSlug: string, token: string): Promise<Blob> {
    // For vCard we want raw text; use fetch directly to avoid JSON parsing.
    const baseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
    const url = `${baseUrl}/v1/card/vcard?publicId=${encodeURIComponent(publicId)}&modeSlug=${encodeURIComponent(modeSlug)}`;
    const resp = await fetch(url, { headers: { "X-Card-Token": token } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(txt || `Failed to download vCard (${resp.status})`);
    }
    return await resp.blob();
  },
};
```

### 2) Public page
Create `apps/web/src/pages/PublicCardModePage.tsx`.

UI sections:
1) Header: name/headline/bio
2) Attachments list:
   - For `resolvedLink.kind === "SHARED_ALBUM"`, show a button “Open album” linking to `/shared/:shareId`.
3) Contact access:
   - If `contactGate === "HIDDEN"`: don’t show request UI.
   - If `contactGate === "OPEN"`: show “Contact available” but still require token reveal (depends on backend decision); keep it simple.
   - If `REQUEST_REQUIRED`: show request form.

Contact request form fields:
- name, email, phone (optional), message (optional)
- if captcha required (from 4.3), include `captchaToken` placeholder wiring (can stub for now)

Token section:
- input for “Access token”
- button “Reveal contact”
- show revealed contact (email/displayName)
- button “Download vCard” which triggers blob download via `URL.createObjectURL`

Error handling:
- use existing `ErrorState` / `Loading` components.

### 3) Router wiring
Update `apps/web/src/app/router.tsx`:
- lazy import `PublicCardModePage`
- add a public route:

```tsx
<Route path="/u/:publicId/:modeSlug?" element={<PublicCardModePage />} />
```

## Local storage
For better UX, store the entered token in `sessionStorage` keyed by `publicId+modeSlug`.

## Styling
Follow existing minimalist style conventions:
- use `var(--bg-elevated)` cards, `btn btn-primary/secondary` classes.

## Tests (optional)
Add a basic Vitest test for `cardApi` URL formation and error handling if time permits.

## Smoke checks
```bash
pnpm -w type-check
pnpm --filter @booster-vault/web test
pnpm --filter @booster-vault/web dev
```

## Acceptance criteria
- Public route renders a card mode from API
- Visitor can submit a contact request
- Visitor can paste a token and reveal contact
- vCard downloads as `.vcf`
- Attachments link out safely to `/shared/:shareId`
