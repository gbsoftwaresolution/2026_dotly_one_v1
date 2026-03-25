# V1 Spec Prompt — Continuity Heir Auth (Replace x-heir-id with real guard)

## Role
You are a senior backend engineer hardening the Continuity “Heir Portal” authentication.

## Goal (V1 security + correctness)
Replace the prototype heir authentication (manual `x-heir-id` header) with a secure, verifiable mechanism.

**Current state (problem):**
- `apps/api/src/continuity/heir/heir.controller.ts` has a TODO for `HeirAuthGuard` and currently trusts `x-heir-id`.
- This is insecure and bypasses real authentication.

## Success Criteria
1. `POST /v1/heir/login` accepts `{ email, accessCode }` and returns a signed token (JWT) scoped for heir access.
2. Subsequent heir endpoints require `Authorization: Bearer <heirToken>` and are guarded by `HeirAuthGuard`.
3. Heir token subject is the **ContinuityRecipient** (not a normal User session):
   - include `recipientId` + `ownerId` in claims.
4. All heir endpoints (`GET /v1/heir/releases`, `GET /v1/heir/releases/:releaseId`, etc.) validate:
   - token is valid and unexpired
   - recipient exists
   - recipient can access requested release/pack
5. Remove the `x-heir-id` path entirely.
6. Add tests:
   - login success/failure
   - protected route rejects missing/invalid token

## Constraints / Repo Pointers
- API global prefix: `/v1`
- Controller: `apps/api/src/continuity/heir/heir.controller.ts`
- Service: `apps/api/src/continuity/heir/heir.service.ts`
- Recipient model: `ContinuityRecipient` in `apps/api/prisma/schema.prisma`
- Frontend heir login: `apps/web/src/pages/heir/HeirAuth.tsx` stores `heir_token` in localStorage.

## Implementation Plan

### Step 1 — Define Heir JWT strategy
- Create a new JWT secret/env var:
  - `HEIR_JWT_SECRET` (must be different from normal JWT_SECRET)
  - `HEIR_JWT_EXPIRES_IN` (default e.g. `1h`)
- Add getters in `ConfigService`.

### Step 2 — Implement HeirAuthGuard
- Add `apps/api/src/auth/guards/heir-auth.guard.ts` (or under `continuity/heir/guards/`).
- Validate Bearer token and attach payload to `req.heir`.

### Step 3 — Update HeirController
- `POST /heir/login`: keep existing route, but make it return `{ token }` that is a JWT.
- Remove `getHeirId` header logic.
- Apply `@UseGuards(HeirAuthGuard)` on heir read endpoints.

### Step 4 — Update HeirService login verification
- If `recipient.accessCodeHash` exists, verify it (already present in service).
- If it doesn’t exist, **do not silently skip in V1**:
  - require it for security OR migrate to always set it.
  - choose one consistent approach and implement it.

### Step 5 — Frontend wiring
- Update `apps/web` heir API calls to send `Authorization: Bearer <heir_token>`.
- Remove any reliance on `x-heir-id`.

### Step 6 — Tests
- Add Jest + Supertest tests for login + guard behavior.

## Acceptance Test
1. Login via heir portal with valid email + access code.
2. Confirm token stored and subsequent routes load releases without custom headers.
3. Invalid token => 401.
