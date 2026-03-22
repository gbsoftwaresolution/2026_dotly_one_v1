# Security Audit Logging

Security audit events are separate from general application logs. They use the `SecurityAuditService`, emit through the existing structured logger with the `SecurityAudit` context, and standardize these fields when available:

- `action`
- `outcome`
- `actorUserId`
- `requestId`
- `sessionId`
- `targetType`
- `targetId`
- `reason`
- `policySource`
- `metadata`

The logger timestamp remains the source of truth for when the audit event occurred.

## Audit-worthy auth and trust events

- `auth.signup`
- `auth.login`
- `auth.email_verification.issue`
- `auth.email_verification.resend`
- `auth.email_verification.complete`
- `auth.password.change`
- `auth.password_reset.request`
- `auth.password_reset.complete`
- `auth.mobile_otp.request`
- `auth.mobile_otp.verify`
- `auth.session.revoke`
- `auth.session.revoke_others`
- `auth.session.logout_current`
- `auth.verification_requirement.enforcement`

## Sensitive data rules

- Never include raw passwords, OTP codes, reset tokens, JWTs, API keys, or cookie values.
- Prefer hashed or masked identifiers where full values are unnecessary.
- Prefer masked phone numbers and email hashes for anonymous or account-discovery-resistant flows.
- Put operational detail in `reason` and `metadata`, but keep those fields safe to expose to support and incident responders.