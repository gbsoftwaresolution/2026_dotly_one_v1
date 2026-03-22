# Auth And Security Operational Checklists

Use this document for concise auth-specific verification before and after deployment. It complements the broader platform checklist in `docs/staging-launch-checklist.md`.

## Staging Verification

- confirm `/v1/health/ready` is `ok` or intentionally `degraded` only because Redis is unavailable
- confirm `/v1/health/verification` reports the expected values for `mailConfigured`, `passwordResetConfigured`, `smsConfigured`, `verificationDependenciesOperational`, and `missingRequiredMigrations`
- confirm one signup returns `verificationPending=true`
- confirm one login creates an active tracked session and `/auth/sessions` lists it
- confirm one email verification flow completes and unlocks trust-sensitive actions
- confirm one password reset request is accepted and one reset completion revokes older sessions
- confirm one mobile OTP request returns a challenge and one verification marks the phone as verified
- confirm trust-sensitive actions reject untrusted users with friendly `403` responses and unlock after either verified email or verified mobile OTP
- confirm account security UI shows the expected provider availability flags for mail, password reset, and SMS

## Production Release Verification

- verify production secrets for Mailgun, frontend verification/reset URLs, JWT settings, and CORS origins are the intended values
- verify `TRUST_PROXY` matches the real ingress topology before checking any auth rate limits
- verify no required verification migrations are missing before traffic cutover
- verify `/v1/metrics` is reachable by the monitoring path
- verify startup logs show the expected verification runtime status and do not log degraded provider state unexpectedly
- verify no repeated `provider_error`, `provider_unavailable`, or auth `system_error` metrics appear during canary traffic

## Post-Deploy Smoke Tests

- log in through the real frontend origin
- confirm `/api/auth/session` returns the authenticated user
- confirm logout revokes the current tracked session
- sign up a fresh account and confirm the login page reflects whether verification delivery succeeded
- complete email verification from a real delivered message and confirm the verified badge or trust state updates in the account security UI
- request a password reset and confirm only the newest link succeeds
- request and verify a mobile OTP code, then confirm a wrong code triggers invalid-attempt handling and cooldown behavior
- revoke one other session and confirm the revoked token stops working

## Auth And Security Regression Checks

- invalid or expired JWTs must return `401`
- JWTs missing a tracked `sessionId` must return `401`
- revoked, expired, or missing `AuthSession` records must return `401`
- unknown-email password reset requests must still return the generic accepted response
- verified users must not continue issuing fresh verification tokens on resend
- password reset completion must revoke all active sessions
- password change must revoke other sessions but preserve the current session when expected
- OTP verify must enforce cooldown and terminal lockout after repeated failures
- cache degradation must not take the service down, but readiness must reflect the degraded state

## Final Validation Before Release

Tests to run:

- `npm run prisma:generate`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `cd frontend && npm run build`

Metrics to inspect:

- `dotly_auth_login_total`
- `dotly_auth_verification_resend_total`
- `dotly_auth_password_reset_request_total`
- `dotly_auth_password_reset_complete_total`
- `dotly_auth_otp_request_total`
- `dotly_auth_otp_verify_total`
- `dotly_auth_session_security_total`
- `dotly_auth_delivery_total`
- active and recently revoked auth session gauges

Manual smoke flows to verify:

- signup and verification delivery
- verified login and session listing
- resend verification cooldown and success path
- password reset request, completion, and old-session invalidation
- mobile OTP request, invalid-code handling, and successful verification
- remote sign-out, sign out other sessions, and current-session logout

Security-sensitive behaviors to confirm:

- trust-sensitive actions stay blocked until one allowed trust factor is active
- provider misconfiguration shows up in diagnostics and UI capability flags
- auth audit events contain request correlation data but no secrets or raw tokens
- proxy configuration still yields correct client IP resolution for abuse controls