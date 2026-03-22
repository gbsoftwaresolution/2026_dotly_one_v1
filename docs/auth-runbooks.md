# Auth And Security Runbooks

Use these runbooks when the auth stack is unhealthy in production or staging. They assume the current Dotly runtime contract:

- backend APIs are exposed under `/v1`
- metrics are available at `/v1/metrics`
- readiness is available at `/v1/health/ready`
- auth verification diagnostics are available at `/v1/health/verification`
- auth audit events are emitted through the `SecurityAudit` logger context

Before changing anything during an incident:

- capture the request IDs from affected requests when available
- confirm whether the issue is isolated to one flow or affects all auth traffic
- compare current behavior with the latest deploy, config, or provider change
- preserve a short incident timeline with observed symptoms, mitigations, and reversions

## Shared Places To Check

Logs:

- structured HTTP request logs with `x-request-id`
- `SecurityAudit` events such as `auth.login`, `auth.email_verification.resend`, `auth.password_reset.request`, `auth.mobile_otp.request`, and `auth.session.revoke`
- provider adapter logs from `MailService`, `SmsService`, and `CacheService`

Metrics:

- `dotly_auth_login_total`
- `dotly_auth_verification_email_issue_total`
- `dotly_auth_verification_resend_total`
- `dotly_auth_password_reset_request_total`
- `dotly_auth_password_reset_complete_total`
- `dotly_auth_otp_request_total`
- `dotly_auth_otp_verify_total`
- `dotly_auth_session_security_total`
- `dotly_auth_trust_blocked_total`
- `dotly_auth_delivery_total`

Diagnostics:

- `/v1/health/ready` for database and cache state
- `/v1/health/verification` for Mailgun, password reset, SMS, migration, and trust-factor readiness

## Mailgun Delivery Failures

### Symptoms

- signup completes but users report no verification email
- password reset requests are accepted but no reset mail arrives
- account security UI reports mail delivery or password reset delivery as unavailable
- delivery-related metrics show `provider_error` or `provider_unavailable`

### Likely Causes

- Mailgun credentials are missing or rotated incorrectly
- `MAIL_FROM_EMAIL`, `FRONTEND_VERIFICATION_URL_BASE`, or `FRONTEND_PASSWORD_RESET_URL_BASE` is missing or invalid
- Mailgun API outage or network egress problem
- provider rejects sender domain or verified sender identity

### Where To Check

- `/v1/health/verification`:
  `mailConfigured`, `passwordResetConfigured`, and `missingMailSettings`
- `dotly_auth_delivery_total{channel="email",provider="mailgun"}`
- `dotly_auth_verification_email_issue_total`
- `dotly_auth_password_reset_request_total`
- application logs for `Mailgun email delivery failed` and `Mailgun email delivery request failed`
- application logs for `Password reset email skipped because mail delivery is not fully configured`

### Immediate Mitigation

- verify current secret values in the deployment platform and restore the known-good Mailgun configuration
- confirm frontend verification and reset URLs still point to the intended public HTTPS routes
- if only verification mail is broken, pause rollout of any feature that newly depends on verified email completion
- if password reset mail is broken, treat account recovery as degraded and route urgent user recovery through support escalation rather than repeated retries
- if the failure started immediately after deploy, rollback the deploy or config change

### Follow-Up

- document whether the issue was config drift, provider outage, or code regression
- add or tighten alerting on `dotly_auth_delivery_total{outcome="provider_error"|"provider_unavailable"}`
- validate one successful verification email and one successful reset email after mitigation
- review provider account health, domain verification, and rate limits

## SMS Provider Failures

### Symptoms

- mobile OTP requests return a challenge, but the user never receives a code
- account security UI reports SMS delivery as unavailable
- OTP request metrics show accepted requests without corresponding sent deliveries
- support sees repeated OTP resends followed by user lockout or cooldown complaints

### Likely Causes

- partial or missing Twilio configuration
- Twilio transport outage or API authentication failure
- number formatting issues or rejected destination phone numbers
- outbound network failure between the app and Twilio

### Where To Check

- `/v1/health/verification`:
  `smsConfigured` and `missingSmsSettings`
- `dotly_auth_delivery_total{channel="sms",provider="twilio"}`
- `dotly_auth_otp_request_total`
- `SecurityAudit` events for `auth.mobile_otp.request`
- application logs for `Twilio SMS delivery failed`, `Twilio SMS delivery request failed`, and `SMS delivery skipped because Twilio is not fully configured`

### Immediate Mitigation

- confirm all Twilio settings are present together; partial configuration should be treated as broken, not degraded enough to ignore
- if the outage is provider-side, temporarily disable OTP enrollment communication in operator messaging so users stop burning through resend limits
- advise affected users not to keep retrying while the incident is active because resend and verify throttles still apply
- if a config change caused the issue, restore the last known-good Twilio secret set or rollback the deployment

### Follow-Up

- run one successful OTP request and verification after remediation
- review whether the UI needs stronger operator-facing messaging when `deliveryAvailable` is false
- add or tune alerts on `dotly_auth_delivery_total{channel="sms",outcome="provider_error"|"provider_unavailable"}`

## Password Reset Failures

### Symptoms

- users receive a reset link but cannot complete reset
- reset requests are accepted but no mail arrives
- reset link returns invalid or expired token unexpectedly
- users report that reset succeeded but old sessions still appear active

### Likely Causes

- Mailgun configuration or delivery failure
- stale, already-consumed, superseded, or expired reset token
- password policy rejection or attempted password reuse
- regression in session revocation during reset completion
- aggressive throttling from repeated reset attempts

### Where To Check

- `/v1/health/verification` for `passwordResetConfigured`
- `dotly_auth_password_reset_request_total`
- `dotly_auth_password_reset_complete_total`
- `dotly_auth_delivery_total{template="password_reset"}`
- auth audit events for `auth.password_reset.request` and `auth.password_reset.complete`
- session gauges for active and recently revoked sessions on `/v1/metrics`

### Immediate Mitigation

- determine whether the failure is request-time delivery, token validation, or completion-time password mutation
- if mail delivery is broken, fix mail configuration first; repeated reset requests will not help
- if token validity is the problem, issue a fresh reset request and confirm the user uses only the newest link
- if session revocation appears broken, treat it as a security incident and block rollout until verified because reset is supposed to revoke all active sessions in the same transaction

### Follow-Up

- validate the full path end to end: request reset, receive email, complete reset once, confirm old link fails, confirm previous sessions are rejected
- review whether reset failures correlate with a frontend reset-page regression or backend token issuance/consumption change
- monitor for `password_reuse`, `invalid_or_expired_token`, and `delivery_failed` outcome spikes

## Email Verification Resend Issues

### Symptoms

- resend endpoint returns `429`
- resend is accepted but no message is delivered
- already verified or unknown emails appear to do nothing
- unverified users remain blocked from trust-sensitive actions longer than expected

### Likely Causes

- resend cooldown is active
- resend window limit has been exceeded
- IP-, session-, or email-scoped throttles are firing
- Mailgun is unavailable or misconfigured
- user is already verified, so the resend path is intentionally suppressed

### Where To Check

- `dotly_auth_verification_resend_total`
- `dotly_auth_verification_email_issue_total`
- `dotly_auth_delivery_total{template="verification"}`
- auth audit events for `auth.email_verification.resend`
- `/v1/health/verification` for `mailConfigured`, `verificationDependenciesOperational`, and `missingRequiredMigrations`

### Immediate Mitigation

- distinguish a healthy suppression path from a real delivery incident before escalating
- if users are hitting cooldowns because of UI retry behavior, pause repeated retries and communicate the cooldown expectation
- if delivery is the root cause, fix Mailgun or frontend verification URL config first
- if migration readiness is degraded, stop rollout until the required verification migrations are applied

### Follow-Up

- verify resend from both anonymous and authenticated paths
- confirm verified users now return the expected suppressed response instead of creating new tokens
- review product messaging if users are misreading normal suppression as a system outage

## OTP Abuse Spikes

### Symptoms

- sudden increase in OTP request throttles or verification throttles
- many `429` responses on OTP endpoints
- support reports repeated invalid-code lockouts or cooldown complaints
- infrastructure sees elevated auth traffic from a narrow set of IPs or sessions

### Likely Causes

- scripted OTP abuse against one phone number or many accounts
- frontend retry loop or broken client timer causing excessive resends
- shared ingress IP collapse causing many users to hit the same IP bucket
- provider instability causing users to retry aggressively

### Where To Check

- `dotly_auth_otp_request_total`
- `dotly_auth_otp_verify_total`
- `dotly_auth_delivery_total{template="mobile_otp"}`
- auth audit events for `auth.mobile_otp.request` and `auth.mobile_otp.verify`
- ingress logs for source IP distribution
- `/v1/health/ready` to confirm Redis is healthy, because shared abuse counters depend on cache availability

### Immediate Mitigation

- confirm whether the spike is malicious traffic, provider-induced retries, or a frontend bug
- if ingress is collapsing many callers to one IP, fix proxy configuration before changing rate limits
- if the cache is degraded, restore Redis first because shared IP/session/phone throttles fail soft when cache counters are unavailable
- if a single phone or IP range is abusive, apply network or edge-level blocking outside the app while the incident is active

### Follow-Up

- review whether current hourly limits are still appropriate for production traffic
- consider adding challenge or step-up measures where the policy already marks elevated risk
- add dashboards separating `invalid_code`, `attempt_limit_reached`, `attempt_cooldown_active`, and provider delivery failures

## Session Revocation Anomalies

### Symptoms

- revoked sessions still appear usable
- current-device logout or remote sign-out behaves inconsistently
- password change or password reset does not terminate prior sessions
- users report being logged out unexpectedly from an active session list mismatch

### Likely Causes

- tracked `sessionId` missing from token or no longer resolves to an active `AuthSession`
- session revoke path failed or was bypassed
- stale frontend state after session revocation
- database issue affecting `AuthSession` writes or reads

### Where To Check

- `dotly_auth_session_security_total`
- active and recently revoked session gauges on `/v1/metrics`
- auth audit events for `auth.session.revoke`, `auth.session.revoke_others`, and `auth.session.logout_current`
- auth audit events for `auth.password.change` and `auth.password_reset.complete`
- request logs for `401` spikes after revoke operations

### Immediate Mitigation

- confirm whether the problem is backend session enforcement or stale frontend session presentation
- test with a fresh login, revoke the session, then replay the same bearer token against an authenticated endpoint
- if password change or reset does not revoke sessions, halt release progression because that violates the session security contract
- if only the active-session list is stale, force-refresh the frontend session state and confirm backend rejection behavior separately

### Follow-Up

- validate the tracked-session contract end to end after remediation
- inspect any recent changes to JWT payload issuance, guard behavior, or `DeviceSessionService`
- add targeted regression coverage if the issue came from a revocation edge case

## Login Failure Spikes

### Symptoms

- large increase in login failures or lockouts
- users report valid credentials failing unexpectedly
- elevated `401` responses on frontend session refresh or login route handlers
- support reports concurrent password reset and login problems

### Likely Causes

- credential attack or password spraying
- upstream config issue such as wrong `JWT_ISSUER`, `JWT_AUDIENCE`, or broken auth cookie/session wiring
- frontend login regression or backend request-shape change
- trust proxy or client IP handling drift causing widespread IP lockouts

### Where To Check

- `dotly_auth_login_total`
- auth audit events for `auth.login`
- ingress logs and HTTP request logs with `x-request-id`
- frontend route-handler errors around `/api/auth/login` and `/api/auth/session`
- `TRUST_PROXY` and ingress forwarding behavior if IP-scoped lockouts look suspicious

### Immediate Mitigation

- separate credential-attack patterns from platform regressions by checking whether failures cluster by account, IP, or all traffic
- if a deploy caused the spike, rollback first and investigate second
- if lockouts are caused by proxy misconfiguration, restore correct forwarding and trust settings instead of relaxing abuse controls blindly
- if password resets are also failing, prioritize provider and session checks because users will not have a recovery path

### Follow-Up

- validate a clean login through the real frontend origin, then validate `/api/auth/session` and logout
- review whether lockout thresholds and alerting are appropriate for current traffic volume
- consider additional edge protections if the spike is malicious rather than accidental

## Degraded Provider Configuration

### Symptoms

- `/v1/health/verification` returns `degraded`
- readiness is `degraded` because cache is unavailable
- frontend security surfaces show delivery capability as unavailable
- some flows still accept requests, but end users cannot complete them successfully

### Likely Causes

- missing Mailgun or Twilio settings
- required verification migrations not applied
- Redis unavailable, disabled, or unhealthy
- environment variables pointing to the wrong origin after deploy

### Where To Check

- `/v1/health/verification`
- `/v1/health/ready`
- `dotly_auth_delivery_total`
- `dotly_cache_up` and related cache health metrics on `/v1/metrics`
- startup logs for verification runtime status and Redis connectivity

### Immediate Mitigation

- decide whether the system is operating in an acceptable degraded state or whether the release should be halted
- restore missing provider configuration or rollback the configuration change
- if Redis is degraded, restore it quickly because abuse controls partially fail open without shared cache counters
- if required verification migrations are missing, stop rollout and apply migrations before attempting more auth validation

### Follow-Up

- record which flows degraded gracefully and which were intentionally fail closed
- update alerts or release gates if the degraded state should have blocked promotion earlier
- re-run the auth smoke checklist after restoring the dependency