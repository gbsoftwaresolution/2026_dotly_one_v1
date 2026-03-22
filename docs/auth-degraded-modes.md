# Auth Degraded Modes And Failure Semantics

This document describes what currently degrades gracefully, what fails closed, and what operators should expect when auth dependencies are unhealthy.

## Decision Rules

- fail closed when a security guarantee would otherwise be bypassed
- degrade gracefully when the system can preserve safety while temporarily losing convenience or a recovery channel
- always surface degraded dependencies through health, metrics, logs, or frontend capability flags

## Failure Mode Matrix

### Mail Not Configured

Current behavior:

- signup still creates a pending account
- verification token issuance still occurs, but verification email delivery is skipped
- resend verification may be accepted, but `verificationEmailSent` will be false
- password reset request may be accepted, but reset delivery can fail
- frontend security surfaces show mail or password reset availability as false

Security posture:

- graceful degradation for account creation and resend acceptance
- fail closed for trust-sensitive actions that still require verified email or another allowed trust factor

Operator expectation:

- acceptable only in controlled non-production environments
- treat as a release blocker in production

### SMS Not Configured

Current behavior:

- OTP request still creates an enrollment challenge and returns a `challengeId`
- SMS delivery is skipped and `deliveryAvailable` is false
- OTP verification cannot succeed in practice without the code, so the flow is operationally degraded
- existing verified phone trust remains intact; only new enrollment is impacted

Security posture:

- graceful degradation for the API surface
- functionally unavailable for new mobile OTP enrollment

Operator expectation:

- acceptable only if OTP is intentionally disabled for the environment
- otherwise treat as degraded recovery and step-up capability

### Redis Or Cache Unavailable

Current behavior:

- service startup continues
- `/v1/health/ready` reports degraded cache state
- cache-backed login lockouts and auth throttles partially fail open because Redis increments and set-if-absent operations can return `null`
- database-backed cooldowns and durable artifact checks still run

Security posture:

- graceful degradation for availability
- reduced abuse resistance for shared counters and IP/session rate limits

Operator expectation:

- restore Redis quickly
- treat sustained cache outage as a security-risking degraded state, not only a performance issue

### Database Unavailable

Current behavior:

- readiness returns `down`
- auth flows depending on users, sessions, tokens, or verification artifacts fail
- tracked-session validation cannot confirm active sessions

Security posture:

- fail closed

Operator expectation:

- database outage is a hard auth outage
- do not attempt to bypass database-backed checks to keep auth partially alive

### Missing Verification Migrations

Current behavior:

- `/v1/health/verification` reports missing required migrations
- verification dependency status becomes degraded
- token-table assumptions and verification counters may be incomplete or wrong for the current deployment

Security posture:

- rollout should stop until migrations are applied

Operator expectation:

- treat as a deployment correctness issue, not a user-behavior issue

### Missing Or Inactive Tracked Session

Current behavior:

- requests with missing, revoked, expired, or unknown tracked sessions receive the same unauthorized response
- revoked or expired sessions disappear from active-session listings

Security posture:

- fail closed by design

Operator expectation:

- if this starts happening broadly, investigate session issuance or persistence regressions immediately

### Mailgun Or Twilio Provider Runtime Errors

Current behavior:

- provider adapters return `false` rather than throwing raw provider details to end users
- metrics record `provider_error`
- structured logs capture provider status metadata
- flow-level responses stay user-safe but can become operationally incomplete

Security posture:

- graceful degradation in transport handling
- trust and recovery outcomes may remain incomplete until delivery is restored

Operator expectation:

- rely on metrics and diagnostics to distinguish provider outage from configuration loss

## What Must Fail Closed

- JWTs without a valid tracked session
- revoked or expired sessions
- trust-sensitive actions when no allowed trust factor is active
- invalid, expired, inactive, or overused password reset and OTP artifacts
- database-backed writes for password mutation, token consumption, and session revocation

## What Degrades Gracefully

- verification mail delivery during signup or resend acceptance
- password reset request acceptance when delivery fails
- OTP request acceptance when SMS delivery is unavailable
- Redis-backed abuse counters and readiness when cache is unavailable
- operator-facing diagnostics and frontend capability messaging

## Operator Guidance

- do not confuse graceful API acceptance with a healthy end-user outcome
- use `/v1/health/verification`, `/v1/health/ready`, and `dotly_auth_delivery_total` together when classifying auth incidents
- when in doubt, prioritize restoring provider configuration and cache health before relaxing auth controls