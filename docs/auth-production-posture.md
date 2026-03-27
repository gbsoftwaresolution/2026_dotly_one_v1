# Dotly Auth Production Posture

This document captures the deployment assumptions that keep Dotly auth and abuse controls correct in production.

Related docs:

- `docs/auth-runbooks.md` for active incident response
- `docs/auth-operational-checklists.md` for release and smoke validation
- `docs/auth-degraded-modes.md` for graceful-degradation and fail-closed behavior

## HTTPS And Edge Boundaries

- Terminate external traffic over HTTPS only. Plain HTTP should be redirected at the edge and never exposed as a public origin.
- Keep frontend and backend on explicitly trusted origins. Production values for `CORS_ORIGINS`, `FRONTEND_VERIFICATION_URL_BASE`, `FRONTEND_PASSWORD_RESET_URL_BASE`, `QR_BASE_URL`, and `NEXT_PUBLIC_API_BASE_URL` must all be HTTPS and must not point at localhost or placeholder hosts.
- Keep `CORS_ORIGINS` to bare frontend origins only, such as `https://app.dotly.one`, without paths or query strings.
- Ensure the origins used by `FRONTEND_VERIFICATION_URL_BASE` and `FRONTEND_PASSWORD_RESET_URL_BASE` are both present in `CORS_ORIGINS` so browser auth flows and API calls stay aligned.
- Preserve `X-Forwarded-Proto` when TLS terminates at the load balancer or ingress so Dotly can distinguish secure transport correctly.
- Preserve or inject `X-Request-Id` at the edge. Dotly accepts a bounded safe format and regenerates malformed values before they reach logs.

## Browser Response Hardening

- Backend and frontend should emit a shared baseline of browser-facing hardening headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and production-only `Strict-Transport-Security`.
- The current frontend CSP is an intentionally compatible starting point. It locks down framing, plugins, base URI, and mixed-content upgrades in production, but still allows inline styles and inline scripts to avoid breaking the current Next.js runtime.
- The next CSP phase should replace permissive `script-src` allowances with nonce- or hash-based enforcement once the app shell, analytics hooks, and any remaining inline runtime dependencies are inventoried.
- Keep edge-managed security headers aligned with app-managed values. Avoid conflicting duplicate policies between CDN, ingress, Next.js, and NestJS.

## Reverse Proxy And Client IP Trust

- Set `TRUST_PROXY` explicitly in production. Do not rely on the default.
- Use `TRUST_PROXY=false` only when the app is directly internet-facing.
- Use a bounded hop count such as `1` when one ingress or load balancer sits in front of the app.
- Use `true` only when every upstream hop is controlled and trusted. An overly broad trust setting lets callers influence `request.ip` and weakens rate limiting and abuse controls.
- Verify the proxy preserves `X-Forwarded-For` and strips spoofed values from untrusted clients before forwarding traffic.

## Cookie And Session Transport

- Frontend auth cookies are intended for frontend route handlers and same-origin app requests. They are `HttpOnly`, `priority=high`, and `Secure` in production.
- Default `AUTH_COOKIE_SAME_SITE` posture is `lax`. Tighten to `strict` if product flows do not require top-level cross-site returns with an existing session.
- Only use `AUTH_COOKIE_SAME_SITE=none` when you deliberately support cross-site embedding or a federated frontend surface, and always pair it with `AUTH_COOKIE_SECURE=true`.
- Set `AUTH_COOKIE_DOMAIN` only when one authenticated experience must span subdomains such as `app.dotly.one` and `admin.dotly.one`. Leave it unset for a host-only cookie when possible.
- Backend API authentication continues to use `Authorization: Bearer <token>` between frontend route handlers and the backend. CORS should stay scoped to the frontend origins that are expected to send those calls.

## Provider Dependency Posture

- Mailgun is required in production. Missing mail configuration should block rollout because signup verification and password reset would otherwise degrade immediately.
- Twilio may be disabled intentionally, but partial Twilio configuration is not allowed. Configure all SMS credentials together or none of them.
- Mailgun or Twilio transport failures should degrade the affected flow without leaking provider details to end users. Operators should treat repeated `provider_error` metric spikes as alert-worthy.
- Retry provider calls at the job or workflow layer only when the action is safe to repeat. Dotly currently records the failure and returns a degraded user outcome rather than retrying inline inside the request path.
- Monitor `/v1/health/verification` for mail, password reset, SMS, and migration readiness before and after deploys.

## Rate Limiting Behind Infrastructure

- Auth and request-abuse controls depend on the resolved client IP. Re-check rate limits after every ingress, CDN, or service mesh change.
- If multiple regions or pods serve traffic, back the limiters with shared Redis so abuse counters survive individual instance restarts.
- Validate that the edge does not collapse all callers to the same source IP. If it does, IP-scoped controls will over-throttle legitimate users.
- Exercise login, password reset, resend verification, and OTP request flows through the real ingress path to confirm `429` behavior still matches expectations.

## Production Smoke Checks

- Login through the real frontend origin and confirm session creation, `/api/auth/session`, and logout all work over HTTPS.
- Complete email verification from a real delivered email and confirm the verified state appears on the frontend and backend session reads.
- Request a password reset, complete it once, and confirm old links and revoked sessions stop working.
- Request and verify a mobile OTP challenge, then confirm incorrect retries and cooldowns still trigger through the production ingress path.
- Disable Mailgun or Twilio in staging on purpose once before launch and confirm the app surfaces the intended degraded behavior, logs the failure, and emits provider metrics.
