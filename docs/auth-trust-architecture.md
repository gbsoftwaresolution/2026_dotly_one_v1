# Auth And Trust Architecture

This document describes the current auth, verification, and trust model for Dotly. It is meant to help operators and future contributors understand what the system guarantees today and where each guarantee is enforced.

## System Shape

The auth stack is split across a few core layers:

- `src/modules/auth`: auth flows, session registry logic, verification policy, auth metrics, and abuse protection
- `src/modules/users`: authenticated account-security and trust-profile read models that surface verification, provider readiness, and session state to the frontend
- `src/common/guards/jwt-auth.guard.ts`: bearer-token validation plus tracked-session enforcement
- `src/infrastructure/mail`, `src/infrastructure/sms`, and `src/infrastructure/cache`: provider adapters and fail-soft infrastructure dependencies
- `src/modules/health`: readiness, metrics, and verification diagnostics endpoints

The frontend mirrors those backend seams through:

- route handlers under `frontend/src/app/api/auth/*` and `frontend/src/app/api/users/me/*`
- protected `/app` surfaces guarded by `frontend/src/middleware.ts`
- account-security UI under `frontend/src/components/settings/account-security-settings.tsx`
- verification flows under `frontend/src/components/auth/*` and public pages such as login and reset-password

## Authentication Lifecycle

### Signup And Login

- signup creates a user with `isVerified=false`
- signup immediately issues an email verification token and attempts delivery
- successful login creates a stored `AuthSession` record and mints a JWT that carries the tracked `sessionId`
- the JWT alone is not enough for continued access; the backend also requires the session row to remain active

### Email Verification

- email verification is the first active trust factor
- verification links are random, one-time, hashed before storage, and time limited
- issuing a new verification token supersedes prior active verification tokens
- resend is guarded by cooldown, hourly window caps, and cache-backed abuse controls by email, IP, and session
- verified accounts stop issuing fresh verification tokens and return a suppression-safe accepted response instead

### Password Change And Password Reset

- password policy validation happens before password mutation
- password reset tokens are hashed, one-time, time limited, and supersede older active reset tokens
- completing password reset revokes all active sessions in the same database transaction as token consumption and password update
- changing password revokes other active sessions in the same database transaction as the password update
- password reset requests use account-discovery-safe responses for unknown emails and suppressed per-account issuance

### Mobile OTP Trust Factor

- mobile OTP is the second current trust factor and is modeled as an enrollment challenge
- requesting OTP stores a `pendingPhoneNumber`, supersedes older active enrollment challenges, and attempts SMS delivery
- verification enforces challenge ownership, expiry, inactivity checks, retry cooldown, and attempt ceiling before marking `phoneVerifiedAt`
- successful OTP verification satisfies the same trust-sensitive policy seam as verified email

## Trust Model

Dotly currently recognizes two trust factors:

- `email_verified`
- `mobile_otp_verified`

Trust-sensitive actions are described centrally in `VerificationPolicyService`. Each requirement currently uses `anyOf`, not `allOf`, so either trust factor can unlock the action.

Current trust-sensitive requirements:

- send contact requests
- create profile QR codes
- create Quick Connect QR codes
- create trust-based events
- join event networking
- enable event discovery
- view discoverable event participants

The enforcement contract is:

- untrusted users may still sign up, log in, browse protected surfaces, and complete onboarding
- the policy layer blocks only the trust-sensitive actions
- blocked actions emit both analytics and security audit events
- blocked actions increment `dotly_auth_trust_blocked_total`

## Session Registry And Revocation

The session registry is the source of truth for authenticated access.

Tracked-session contract:

- every authenticated JWT must carry a `sessionId`
- the `sessionId` must map to an `AuthSession` owned by the token subject
- a session is active only when `revokedAt` is null and `expiresAt` is in the future
- JWT validation updates `lastActiveAt` only after confirming the session is still active
- revoked, expired, or missing tracked sessions are rejected uniformly

Revocation guarantees:

- current-session logout revokes the tracked current session
- remote sign-out revokes one other active session owned by the user
- sign out other sessions revokes all other active sessions while leaving the current session intact
- password change revokes other sessions atomically with the credential change
- password reset revokes all sessions atomically with reset completion

## Abuse Protection And Rate Limiting

Auth abuse protection uses `AuthAbuseProtectionService` and Redis-backed counters. The current policy set includes:

- login failure lockouts by account, IP, and account-plus-IP
- signup throttles by email and IP
- password reset request throttles by email and IP
- password reset completion throttles by IP
- verification resend throttles by email, IP, and session
- verification completion throttles by IP
- OTP request throttles by phone, session, and IP
- OTP verification throttles by session and IP

Important operational nuance:

- these shared counters fail soft when Redis is unavailable because cache increments return `null`
- some per-user controls still remain in the database path, including resend cooldown/window checks, password reset per-account issuance suppression, OTP resend cooldown/window checks, and OTP challenge attempt ceilings
- readiness will report cache degradation, but the app continues serving traffic

## Provider Dependencies

### Mailgun

Mailgun is used for:

- email verification delivery
- password reset delivery

Behavioral rules:

- if verification mail is unavailable, signup can still create a pending account
- if password-reset mail is unavailable, reset requests still return the generic accepted response but email delivery fails
- production posture treats missing mail configuration as a release blocker

### Twilio

Twilio is used for:

- mobile OTP delivery

Behavioral rules:

- Twilio is optional overall, but partial configuration is invalid
- if SMS is unavailable, OTP request still creates a challenge but returns `deliveryAvailable=false`
- operators should treat repeated SMS provider failures as a degraded security and recovery condition, not a harmless warning

### Redis

Redis is used for:

- shared auth abuse counters and lockouts

Behavioral rules:

- Redis is fail soft at runtime
- readiness degrades when Redis is unavailable
- auth traffic continues, but several shared abuse controls partially fail open

## Operational Surfaces

Use these endpoints and outputs to understand the system in production:

- `/v1/health`: liveness
- `/v1/health/ready`: database and cache readiness
- `/v1/health/verification`: mail, password reset, SMS, migration, and trust runtime diagnostics
- `/v1/metrics`: auth delivery, verification, password reset, OTP, session-security, trust-blocked, and cache gauges
- structured logs with `x-request-id`
- security audit logs for auth and trust events

## Extensibility Constraints

When changing the trust model, keep these invariants intact:

- keep trust requirements centralized in `VerificationPolicyService`
- preserve account-discovery-safe behavior for anonymous recovery and resend flows
- keep sensitive state changes and session revocation in the same transaction where required
- do not let provider outages leak raw provider details to end users
- add metrics, audit events, and health signals for every new trust factor or provider dependency