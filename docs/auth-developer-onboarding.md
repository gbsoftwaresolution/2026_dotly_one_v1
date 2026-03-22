# Auth And Security Developer Onboarding

This guide is the shortest path to understanding where auth logic lives and how to extend it safely.

## Start Here

Backend entry points:

- `src/modules/auth/auth.controller.ts`: public and authenticated auth endpoints
- `src/modules/auth/auth.service.ts`: signup, login, verification, password reset, OTP, and session revoke logic
- `src/modules/users/users.service.ts`: current-user security summary exposed to the frontend
- `src/common/guards/jwt-auth.guard.ts`: JWT validation and tracked-session enforcement

Frontend entry points:

- `frontend/src/app/(public)/login/page.tsx`: login entry and auth-state banners
- `frontend/src/components/forms/auth-form.tsx`: login and signup submission client
- `frontend/src/app/api/auth/*`: Next.js auth route handlers
- `frontend/src/app/api/users/me/*`: authenticated security and session route handlers
- `frontend/src/components/settings/account-security-settings.tsx`: trust-factor, password, OTP, and session management UI
- `frontend/src/middleware.ts`: route protection for `/app`

## Where Security Policies Live

- trust-sensitive action requirements live in `src/modules/auth/verification-policy.service.ts`
- shared auth abuse counters and lockouts live in `src/modules/auth/auth-abuse-protection.service.ts`
- password rules live in `src/modules/auth/password-policy.service.ts`
- session lifecycle rules live in `src/modules/auth/device-session.service.ts`
- auth event names and response-shaping helpers live in `src/modules/auth/auth-error-policy.ts` and `docs/security-audit-logging.md`

When you need to answer "why was this action blocked?" or "where should a new trust rule go?", start with `VerificationPolicyService` before touching downstream modules.

## How Rate Limiting Works

There are two layers of auth throttling today.

Shared cache-backed counters:

- login failure lockouts
- signup throttles
- password reset request and completion throttles
- verification resend and completion throttles
- OTP request and verify throttles

These run through `AuthAbuseProtectionService`, which writes hashed identifiers into Redis-backed keys through `CacheService`.

Flow-specific database guards:

- email verification resend cooldown and hourly issue cap
- password reset per-account issuance suppression
- OTP resend cooldown and hourly issue cap
- OTP invalid-attempt cooldown and terminal challenge lockout

Important nuance for contributors:

- Redis failure does not stop the app
- when Redis is unavailable, shared counters largely fail open
- do not assume cache-backed throttles are always present; keep critical per-user safeguards in durable storage where the security model requires them

## How Sessions Are Tracked

Session behavior is intentionally stricter than plain JWT validation.

- login creates an `AuthSession` row through `DeviceSessionService`
- the JWT includes the created `sessionId`
- `JwtAuthGuard` verifies the JWT and then calls `validateSession`
- the request is authenticated only if the session row exists, is not revoked, and has not expired
- successful validation updates `lastActiveAt`
- revocation endpoints and password mutations operate against `AuthSession` rows, not just tokens in memory

If you change login, token issuance, or auth guards, verify the tracked-session contract in `docs/session-security-contract.md` still holds.

## How Provider Readiness Reaches The Frontend

- `MailService` and `SmsService` expose configuration-status helpers
- `VerificationDiagnosticsService` surfaces runtime readiness at `/v1/health/verification`
- `UsersService.getCurrentUser` returns `mailDeliveryAvailable`, `passwordResetAvailable`, `smsDeliveryAvailable`, trust factors, and restricted actions
- the account-security UI uses that payload to explain degraded capabilities without exposing raw secrets

If you add a new auth provider, it should have the same three surfaces:

- backend configuration-status inspection
- health or diagnostics exposure
- frontend capability messaging

## How To Extend Trust Factors Safely

When adding a new trust factor later, follow this order:

1. Add the trust-factor type and catalog entry in `VerificationPolicyService`.
2. Decide which requirements accept the new factor and whether the rule is `anyOf` or a stricter shape.
3. Add the durable user state or artifact model needed to represent the factor.
4. Add issuance, completion, revocation, and recovery behavior in `AuthService` or a dedicated service.
5. Add metrics, audit events, and diagnostics for both healthy and degraded states.
6. Surface capability and trust-state changes through `UsersService.getCurrentUser` and the account-security UI.
7. Add regression coverage for blocked actions, successful unlock, provider failure, and session interactions.

Do not add a new trust factor by only changing UI labels or downstream feature gates. The policy seam must stay centralized so operators and future contributors can reason about it.

## Safe Change Checklist

- preserve account-discovery-safe responses for anonymous flows
- keep session revocation in the same transaction as sensitive password changes when required
- preserve structured audit logging without logging secrets, codes, or raw tokens
- expose new operational dependencies through metrics and health endpoints
- update the docs in this directory whenever you change an auth invariant or degraded-mode behavior