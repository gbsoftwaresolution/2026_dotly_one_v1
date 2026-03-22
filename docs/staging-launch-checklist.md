# Dotly Backend Staging Launch Checklist

Use this checklist before promoting the backend to production.

## Environment And Secrets

- Verify `DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `QR_BASE_URL`, `CORS_ORIGINS`, and `REDIS_URL` are set for staging.
- Verify `TRUST_PROXY` is set explicitly to match the staging ingress topology.
- Verify `JWT_SECRET` is a non-placeholder 32+ character secret and does not match example or bootstrap values.
- Verify `FRONTEND_VERIFICATION_URL_BASE` and `FRONTEND_PASSWORD_RESET_URL_BASE` point to the intended HTTPS frontend routes.
- Verify `NEXT_PUBLIC_API_BASE_URL` points to the final HTTPS backend origin used by the frontend build.
- Verify `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`, and `AUTH_COOKIE_DOMAIN` match the intended frontend domain topology. For host-only cookies, leave `AUTH_COOKIE_DOMAIN` unset.
- Verify `REDIS_ENABLED` matches the intended staging runtime contract.
- Confirm secrets come from the platform secret manager, not checked-in files or shell history.
- Verify staging uses a dedicated PostgreSQL database and Redis instance.
- Confirm TLS is enabled at the load balancer or ingress and external traffic is HTTPS only.
- Confirm the ingress preserves `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-Id` without trusting caller-supplied spoofed values.
- Verify Mailgun is fully configured for staging if signup verification and password recovery are expected to work there.
- Verify Twilio is either fully configured or fully disabled; partial values now fail startup.

## Database And Migrations

- Run `npm run prisma:generate` in the staging build step.
- Apply all Prisma migrations to staging before app rollout with `npm run prisma:migrate:deploy`.
- Verify unique constraints exist for usernames, emails, QR codes, pending request guards, and relationship ownership pairs.
- Confirm staging DB timezone and app hosts both operate in UTC.

## Backend Startup Verification

- Run `npm run build` and confirm the service boots cleanly with no schema or config errors.
- Verify `/v1` prefix is reachable through the staging ingress.
- Verify `/v1/metrics` is reachable by the platform scraper or monitoring agent.
- Verify `/v1/health/verification` is reachable from the staging support path and does not expose PII or token values.
- Verify `/v1/health/verification` reports the expected mail, password-reset, SMS, and verification dependency readiness booleans for the staging environment.
- Confirm CORS only allows intended staging frontend origins.
- Confirm the frontend auth cookie is `Secure`, `HttpOnly`, and uses the expected `SameSite` value after a staging login.
- Confirm the app logs do not print secrets, tokens, password hashes, or raw request bodies.
- Confirm request logs and error logs include `x-request-id` for trace correlation.
- Confirm request logs show secure transport metadata when traffic flows through the ingress.

## Security Verification

- Verify protected endpoints reject anonymous access with `401`.
- Verify invalid JWTs and wrong `iss` or `aud` claims are rejected with `401`.
- Verify unverified users still can sign up and log in successfully.
- Verify trust-sensitive actions return user-friendly `403` responses for unverified accounts.
- Verify password reset throttling still applies when the same email is retried with different casing or extra whitespace.
- Verify mobile OTP incorrect-code retries hit a short cooldown and fully lock the challenge after the configured failure threshold.
- Verify session revoke endpoints reject malformed session ids and requests that do not carry a tracked current session id.
- Verify public profile responses expose only `username`, `fullName`, `jobTitle`, `companyName`, `tagline`, and `profilePhotoUrl`.
- Verify QR resolve responses do not expose private persona fields, internal IDs, usage counts, or token state.
- Verify private personas cannot create public profile QR codes.
- Verify raw internal exceptions are not exposed in HTTP `500` responses.

## Ownership And Access Control

- Verify one user cannot read, update, or delete another user's persona by UUID.
- Verify contact requests always bind to the authenticated user, not caller-supplied user identifiers.
- Verify only request recipients can approve or reject requests.
- Verify expired instant-access relationships are not returned in contact detail reads.
- Verify blocks prevent requests, event discovery visibility, and quick-connect QR connections.

## Event And Discovery Verification

- Verify unverified users cannot join events, enable discovery, or view discoverable participants.
- Verify users cannot join future, ended, or draft events.
- Verify participant visibility only works for joined users with discovery enabled.
- Verify event-based requests require the actor's joined persona and a discoverable target in the same event.
- Verify blocked users are excluded from visible participant lists.

## Email Verification Verification

- Verify the session or current-user response exposes `isVerified` correctly after signup, login, and successful verification.
- Verify in-app unverified banners render on protected frontend surfaces until the account is verified.
- Verify resend verification succeeds for pending accounts and returns cooldown guidance when rate limited.
- Verify verified accounts can create contact requests, QR sharing links, and event discovery actions without additional regressions.
- Verify `/v1/health/verification` reports the expected trust factors, migration coverage, and token counters after a signup, resend, and successful verification flow.

## Notifications And Analytics

- Verify notification listing only returns the authenticated user's records.
- Verify notification payloads do not expose sensitive fields.
- Verify analytics endpoints only return owned persona aggregates.
- Verify analytics conversions handle zero denominators safely.
- Verify analytics summary now includes verification issuance, resend, completion, and blocked-action counts after exercising those flows in staging.
- Verify `/v1/metrics` now reports auth security gauges for active password reset tokens, active OTP challenges, and active or recently revoked sessions.

## Rate Limiting And Concurrency

- Verify rapid repeated request creation returns `429` after the configured threshold.
- Verify auth rate limits still separate callers correctly behind the ingress and do not collapse all users onto a single proxy IP bucket.
- Verify duplicate pending requests return `409` consistently.
- Verify simultaneous quick-connect scans do not create inconsistent duplicate active relationships.
- Verify simultaneous request approvals leave a single final approved state and no partial writes.

## Smoke Tests

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.
- Run a staging HTTP smoke pass for auth, personas, profiles, QR, contact requests, events, and notifications.
- Include smoke coverage for login, email verification, password reset, OTP request and verify, logout, current-session revoke, revoke-all-other-sessions, and a deliberate provider-failure fallback check.

## Go / No-Go

- Launch only if all checks above pass and staging logs show no repeated unexpected `500` responses.
