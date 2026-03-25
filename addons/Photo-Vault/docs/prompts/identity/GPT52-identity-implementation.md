# Booster Identity (Digital Card) — World-Class Execution Plan + GPT-5.2 Implementation Prompt

This document is a **world-class, end-to-end prompt** for GPT-5.2 to implement **Booster Identity / Digital Card** inside this repo.

It must deliver a product that is **clearly better than** Linq/Popl/OVOU/Wave/Dot, with **privacy + control + context** as the core differentiators.

**AI is NOT part of this scope**. (AI will be a separate addon later.)

It is designed to **reuse the existing auth (login/register) flow** and follow existing patterns in:
- API: `apps/api/src/*` (NestJS)
- Web: `apps/web/src/*` (React + Vite)
- DB: `apps/api/prisma/schema.prisma`

## Context (Repo Reality)

### Existing auth flow (must reuse)
- API endpoints (NestJS):
  - `POST /v1/auth/register` (`apps/api/src/auth/auth.controller.ts`)
  - `POST /v1/auth/login`
  - `GET /v1/me` (used by web AuthProvider)
- Web auth state:
  - `apps/web/src/app/AuthProvider.tsx` stores tokens in `localStorage` key `booster_vault_auth` and uses `apiClient.setTokens()`
  - Protected routes are under `/app/*` using `RequireAuth` + `Layout` (`apps/web/src/app/router.tsx`)

### Architecture principles (non-negotiable)
1. **One login, multiple surfaces**: Identity Card is a new surface under authenticated app routes.
2. **Privacy-first**: do not add tracking beacons/analytics. Any share/audit should be explicit.
3. **Follow existing defensive coding patterns** (e.g., array safety) and TypeScript conventions.

---

## Objective (100% Feature-Complete for Non‑AI Identity)

Implement **Booster Identity / Digital Card** as an authenticated feature area and a public share surface.

### Full scope (NON‑AI)
Implement the complete **Killer Feature Set** (non‑AI), including:

1) **Contextual Sharing Modes** (not one static card)
- Modes: `public`, `professional`, `personal`, `private`
- Each mode controls exactly which claims/links are visible.

2) **Per-Link Privacy & Expiry** (the privacy moat)
- Each link/field (phone/email/URL/social) supports:
  - expiry (timestamp)
  - view limit (max views)
  - optional region allowlist/denylist
  - “hide after save” (client-level behavior + server support via one-time tokens)

3) **Offline-first card**
- Public card pages must be ultra-fast, mobile-first, and resilient to poor networks.
- No login required for viewers.
- Provide caching rules that respect privacy.

4) **Contact-native save (best-in-class)**
- Generate a **correct vCard** with properly mapped fields.
- Include photo when available.
- Ensure iOS/Android contact apps import cleanly.

5) **Zero-Spam Guarantee enforcement**
- No email sending, lead capture, or outbound actions without explicit user tap.
- No hidden tracking pixels.

6) **Region-first readiness**
- Implement localization hooks (RTL support readiness) and phone formatting defaults.
- Make WhatsApp a first-class link type.

7) **Identity continuity**
- Identity profile is part of the same logged-in account and key space; it is a first-class surface within `/app/*`.

8) **Auditability + Revocation**
- Audit events for create/share/view/revoke.
- Owner can revoke any share and all associated access tokens.

9) **Family / Couple Profiles (Phase 4)**
- Household identity group(s) with roles (owner/member/child)
- Kids safe mode: no indexing + strict share defaults

> Deliver this in phases, but the overall plan must include **everything above**.

### Success criteria (world-class)
- User logs in with existing flow and can navigate to **Identity** section inside `/app`.
- User can edit identity card data.
- User can generate a share link for a chosen mode with:
  - expiry
  - view limit
  - region rules (at least allowlist)
  - per-link rules
- Anyone with the link can view the card without logging in, with fast load.
- Viewer can “Save contact” and it imports cleanly on iOS/Android.
- Owner can revoke the share; link becomes invalid immediately.
- System has clear, inspectable audit trail.

---

## Phased Execution Plan (Ship Like a Top-Tier Product)

### Phase 1 — Identity Profile Core + In-App Identity Surface
**Goal**: Best-in-class identity editing inside the authenticated app.

Backend:
- Add Prisma models (preferred approach):
  - `IdentityProfile` (1:1 with User)
  - `IdentityLink` (0..n per profile) with types: WEBSITE, LINKEDIN, X, INSTAGRAM, WHATSAPP, EMAIL, PHONE, CUSTOM
  - Each `IdentityLink` includes privacy fields:
    - `expiresAt` (nullable)
    - `maxViews` (nullable)
    - `viewCount` (default 0)
    - `allowedRegions` (Json nullable)
    - `oneTimeAfterSave` boolean (supports “hide after save” semantics)
  - `IdentityModeConfig` (profile-defined visibility per mode) OR store as JSON on profile:
    - visibleFieldsByMode
    - visibleLinksByMode
  - Keep `User.displayName` as the canonical name; profile may store additional fields.
- Add module `apps/api/src/identity/`:
  - `IdentityModule`
  - `IdentityController` endpoints (JWT):
    - `GET /v1/identity/me`
    - `PUT /v1/identity/me`
    - `GET /v1/identity/links`
    - `POST /v1/identity/links`
    - `PUT /v1/identity/links/:id`
    - `DELETE /v1/identity/links/:id`
  - `IdentityService`
- Add audit event types in `apps/api/src/audit/audit-event-types.ts`:
  - `IDENTITY_PROFILE_UPDATED`

Frontend (world-class UX basics):
- Add route: `/app/identity`
- Add page: `apps/web/src/pages/Identity.tsx`
- Add API client: `apps/web/src/api/identity.ts`
- Update navigation (SideNav or TopNav) to include “Identity”.

UX requirements:
- Mobile-first editing
- Instant preview of each mode
- Copy/share flow from same screen
- Clear privacy labels for each field/link

Acceptance tests:
- Can update profile fields and refresh sees changes.

### Phase 2 — Public Card Rendering + Secure Share Tokens (Expiry/View Limits/Region)
**Goal**: Share links that are safer, more controllable, and faster than competitors.

Backend:
- Add Prisma models:
  - `IdentityShare` (share instance)
    - `mode`, `expiresAt`, `revokedAt`
    - `maxViews`, `viewCount`
    - `allowedRegions` (Json)
    - `noIndex` boolean default true (prevent indexing)
  - `IdentityShareAccessToken`
    - tokenHash, expiresAt, revokedAt
    - hashed using sha256 like `ShareAccessToken` in `SharingService`
- Endpoints:
  - `POST /v1/identity/shares` (JWT) create share
  - `GET /v1/identity/shares` (JWT) list
  - `POST /v1/identity/shares/:id/revoke` (JWT)
  - `GET /v1/identity/public/:token` (public) -> returns safe projection for mode
  - `GET /v1/identity/public/:token/vcard` (public) -> returns vCard file
  - (optional) `POST /v1/identity/public/:token/saved` (public) -> increments “saved” + triggers one-time hiding semantics without tracking identity
- Implement share access tokens similarly to album shares (pattern exists in `SharedAlbum` + `ShareAccessToken`).
  - Prefer: `IdentityShareAccessToken` table with `tokenHash`, `expiresAt`, `revokedAt`.
  - Public URL uses token, not raw share id (prevents enumeration).
- Audit events:
  - `IDENTITY_SHARE_CREATED`
  - `IDENTITY_SHARE_REVOKED`
  - `IDENTITY_SHARE_VIEWED`

Frontend:
- Inside `/app/identity`, add “Share” UI:
  - choose mode
  - choose expiry (e.g., 1h, 24h, 7d, custom)
  - optional max views
  - generate link -> copy
- Add public route/page:
  - `/id/:token`
  - `apps/web/src/pages/PublicIdentityCardPage.tsx`
  - Must be extremely fast:
    - no heavy bundles
    - skeleton UI
    - resilient on slow networks
  - Include “Save contact” and “Copy” actions.

Acceptance:
- Share link works on mobile.
- Revocation makes it invalid.

### Phase 3 — Per-Link Privacy + One-Time/Hide-After-Save Semantics
**Goal**: the killer controls competitors lack.

- Enforce **share-level** max views (atomic increment)
- Enforce **per-link** max views + expiry
- Support **hide after save** via one-time token behavior:
  - The vCard download (or saved endpoint) consumes a one-time capability for links marked oneTimeAfterSave
  - After consumption, those links are omitted in subsequent public responses
- Region allowlist (use request IP if geo exists; otherwise implement a deterministic placeholder using request headers and config so the policy plumbing is real)
- Caching:
  - `Cache-Control: no-store` for private mode
  - Safe caching for public/pro modes but never beyond expiry

### Phase 4 — Family/Couple Profiles + Kids Safe Mode
**Goal**: unique moat feature.

- Prisma models:
  - `IdentityHousehold` + `IdentityHouseholdMember`
  - `child` role and safe mode defaults
- UI:
  - manage household profiles
  - share household card

### Phase 5 — Region-first UX + RTL readiness
**Goal**: India/GCC excellence.

- RTL CSS support hooks
- Phone formatting (E.164 storage, local display)
- WhatsApp first-class

---

## Implementation Constraints / Repo Conventions

1. **Routes prefix**: API appears to be mounted at `/v1/*`.
2. Use existing guards and patterns:
   - `JwtAuthGuard` in `apps/api/src/auth/guards/jwt-auth.guard`
3. Use `PrismaService` and transactions where needed.
4. Update `apps/api/src/app.module.ts` to include `IdentityModule`.
5. Update `packages/shared` DTOs if this repo expects shared DTOs (preferred).
6. Use the existing `SharingService` token hashing pattern (`sha256(rawToken)` stored, raw token only returned once).
7. Do NOT introduce user-identifying tracking for views/saves (counts are allowed, identities are not).

---

## Deliverables (must be complete)

### Backend
- Prisma migration adding Identity models
- New Nest module `identity` with controllers/services
- Public share endpoint (token-based)
- Audit event additions
- vCard generation endpoint
- Share constraints enforcement (expiry/view/region)
- One-time “hide after save” semantics

### Frontend
- Identity page under `/app/identity`
- Public identity card page under `/id/:token`
- Nav link in authenticated app
- Mode preview + share creation UI
- “Save contact” functionality

### Documentation
- Update `README.md` or add `docs/identity.md` explaining sharing modes + privacy

---

## Step-by-step instructions for GPT-5.2

1. Inspect existing sharing module patterns: `apps/api/src/sharing/*` and Prisma models `SharedAlbum`, `ShareAccessToken`.
2. Design Prisma schema for IdentityProfile/Links/Shares/Households and create migrations.
3. Implement Identity controllers/services mirroring sharing patterns:
   - token hashing
   - expiry
   - revocation
   - audit events
4. Implement vCard endpoint with correct field mapping; add unit tests for vCard output.
5. Implement public card endpoint returning a safe projection:
   - no PII beyond allowed mode
   - apply per-link privacy rules
6. Implement web pages and API clients mirroring existing patterns.
7. Ensure public page is extremely fast and mobile-first.
8. Add tests (Jest) for:
   - share expiry
   - revoke
   - view limit
   - one-time/hide-after-save semantics
   - mode projections

---

## Acceptance Checklist

- [ ] Existing register/login continues to work unchanged.
- [ ] `/app/identity` loads for authenticated user.
- [ ] Identity profile + links CRUD works.
- [ ] Mode configs work (public/pro/personal/private).
- [ ] Share created with expiry; link opens public page.
- [ ] Public page is fast and renders correctly on mobile.
- [ ] vCard downloads and imports cleanly (manual verification instructions included).
- [ ] View increments and blocks after max.
- [ ] Per-link expiry + view limits enforced.
- [ ] Hide-after-save works for links configured that way.
- [ ] Region policy plumbing exists.
- [ ] Revoke works and invalidates link.
- [ ] Audit events written for update/create/view/revoke.
