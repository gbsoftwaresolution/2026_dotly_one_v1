# Auth Metrics

Dotly exposes auth observability through the existing Prometheus `/metrics` endpoint.

Core auth counters:
- `dotly_auth_login_total`: login successes and failures, including `unknown_email`, `invalid_password`, and `system_error`.
- `dotly_auth_signup_total`: signup successes and duplicate-email or system failures.
- `dotly_auth_verification_email_issue_total`: verification email token issuance, split by `signup` vs `resend`, and whether delivery failed.
- `dotly_auth_verification_email_complete_total`: email verification completion outcomes, including successful verification, already-verified acceptance, invalid or expired token failures, and system failures.
- `dotly_auth_verification_resend_total`: resend requests split into `issued`, `suppressed`, `throttled`, and system failures.
- `dotly_auth_password_reset_request_total`: password reset requests split into accepted issuance, unknown-email suppression-safe requests, per-account suppression, throttling, delivery failure, and system failure.
- `dotly_auth_password_reset_complete_total`: password reset completion outcomes, including invalid tokens, password reuse, and successful completion.
- `dotly_auth_otp_request_total`: OTP request flow outcomes for accepted requests, sent SMS, delivery failure, throttling, policy blocks, and system failures.
- `dotly_auth_otp_verify_total`: OTP verification outcomes for success, invalid codes, expired or inactive challenges, throttling, and system failures.
- `dotly_auth_session_security_total`: remote session revoke, revoke-other-sessions, and logout-current actions with success, block, or failure reasons.
- `dotly_auth_trust_blocked_total`: trust-sensitive actions blocked because the caller does not yet satisfy verification policy requirements.
- `dotly_auth_delivery_total`: provider delivery visibility for Mailgun verification or password-reset email delivery and Twilio OTP delivery, split into `sent`, `provider_error`, and `provider_unavailable`.

Existing auth security gauges remain available:
- active password reset tokens
- password reset tokens issued in the last 24 hours
- active OTP challenges
- OTP challenges issued in the last 24 hours
- active sessions
- revoked sessions in the last 24 hours

Operational guidance:
- A spike in `dotly_auth_login_total{outcome="failure",...}` is the first signal for credential attacks or frontend breakage.
- `dotly_auth_delivery_total{outcome="provider_unavailable",...}` isolates configuration gaps from provider outages.
- `dotly_auth_otp_request_total{outcome="throttled",...}` and `dotly_auth_otp_verify_total{outcome="throttled",...}` highlight OTP abuse or aggressive retries.
- `dotly_auth_password_reset_request_total{outcome="throttled"|"suppressed",...}` helps detect password reset abuse without leaking account existence.
- `dotly_auth_trust_blocked_total` shows how often product flows are failing policy because trust factors are missing.