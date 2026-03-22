# Run Dotly

This guide covers how to run Dotly locally in development mode and how to start both services in production mode.

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL
- Redis

Backend password hashing uses `bcryptjs`, so there is no native `bcrypt` addon to compile or rebuild during install or deploy.

## Backend Environment

Create the backend env file:

```bash
cp .env.example .env
```

Minimum required backend values:

```env
NODE_ENV=development
PORT=3000
TRUST_PROXY=false
DATABASE_URL=postgresql://naveenprasath-p@localhost/dotly_one_id?host=/var/run/postgresql
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
JWT_ISSUER=dotly-backend
JWT_AUDIENCE=dotly-clients
CORS_ORIGINS=http://localhost:3001
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
STORAGE_BUCKET=dotly-local
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAIL_FROM_EMAIL=
FRONTEND_VERIFICATION_URL_BASE=http://localhost:3001/verify-email
FRONTEND_PASSWORD_RESET_URL_BASE=http://localhost:3001/reset-password
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE_NUMBER=
QR_BASE_URL=http://localhost:3001/q
```

Optional frontend auth cookie overrides:

```env
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=
AUTH_COOKIE_DOMAIN=
```

Production hardening rules:

- `JWT_SECRET` must be at least 32 characters, use multiple character classes, and cannot be a placeholder.
- `JWT_EXPIRES_IN` must use the supported duration format: `s`, `m`, `h`, or `d` suffixes.
- `TRUST_PROXY` must be set explicitly in production to match the actual ingress chain. Use `false` for direct edge deployment, `true` only when every inbound hop is trusted, or a bounded hop count / named Express preset such as `1` or `loopback` when traffic crosses known reverse proxies.
- `CORS_ORIGINS`, `FRONTEND_VERIFICATION_URL_BASE`, `FRONTEND_PASSWORD_RESET_URL_BASE`, and `QR_BASE_URL` must use trusted HTTPS origins in production. Localhost, `.local`, `.example`, and `.internal` hosts are rejected.
- `NEXT_PUBLIC_API_BASE_URL` must point at the final HTTPS backend origin in production. Frontend startup now rejects insecure or localhost API origins.
- Frontend auth cookies are `HttpOnly`, `priority=high`, `Secure` in production, and `SameSite=Lax` by default. If you need cross-subdomain auth continuity, set `AUTH_COOKIE_DOMAIN` to the registrable domain and keep `AUTH_COOKIE_SECURE=true`.
- `AUTH_COOKIE_SAME_SITE=none` is only valid with `AUTH_COOKIE_SECURE=true` and should be reserved for deliberate cross-site embedding or federation cases.
- Mailgun is optional in development, but production startup now fails fast unless `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAIL_FROM_EMAIL`, `FRONTEND_VERIFICATION_URL_BASE`, and `FRONTEND_PASSWORD_RESET_URL_BASE` are all present.
- Twilio is optional in every environment, but partial Twilio configuration is rejected. Configure all three values together or leave all three blank.

Mail behavior:

- Email verification links are sent through Mailgun only when all four mail values above are configured.
- Password reset links are sent through Mailgun when the mail credentials and `FRONTEND_PASSWORD_RESET_URL_BASE` are configured.
- Mobile OTP verification codes are sent through Twilio when all three Twilio values above are configured.
- If Mailgun is disabled or only partially configured, signup still succeeds, the account remains unverified, and the frontend explains that email delivery is unavailable in the current environment.
- Verification links expire after 24 hours. Resend requests are cooldown-limited to avoid rapid abuse.
- Password reset links are single-use, hashed at rest, expire after one hour, and do not reveal whether an account exists.
- Mobile OTP codes expire after 10 minutes, invalidate older active challenges, apply resend guardrails, and rate-limit rapid retry attempts after incorrect codes.

## Verification Policy

- Dotly keeps signup, login, persona setup, and basic onboarding available to unverified accounts.
- Dotly currently requires a verified email for trust-sensitive actions: sending contact requests, creating profile QR codes, creating Quick Connect QR codes, joining events, enabling event discovery, and viewing discoverable event participants.
- Verified mobile OTP now counts as the next active trust factor and satisfies the same trust-sensitive policy seam.
- Blocked trust actions return a user-facing `403` message that tells the user to verify their email and resend a verification link if needed.
- The backend rule is centralized in a trust-aware verification policy service. Email verification and verified mobile OTP now plug into the same requirement model without rewriting each call site.

## Resend Verification UX

- Unverified users see their verification state in the app shell and settings.
- Authenticated users can now manage account trust from Settings, including email verification status, password changes, mobile OTP enrollment, active sessions, and remote sign-out.
- Restricted entry points such as contact requests, QR sharing, and event participation show verification guidance before the user attempts the action.
- The resend CTA is available from the verification page and the in-app unverified prompts.
- Successful resend attempts confirm that a fresh link is on the way.
- Cooldown responses tell the user to check the latest email and wait about a minute before trying again.

## Password Recovery

- The login page links to `/forgot-password`, which accepts an email address and always returns a neutral success response.
- Reset completion happens on `/reset-password?token=...` and enforces the same password quality policy as authenticated password changes.
- Password change inside settings requires the current password and signs out other sessions after a successful rotation.
- Password reset signs out all active sessions after completion.
- Anonymous password reset throttling normalizes the requested email before hashing the cache key so casing and whitespace variants do not bypass the guardrail.

## Sessions And Devices

- Login now creates a persistent session record with device and platform summaries derived from the user agent.
- Authenticated requests validate both the JWT and the stored session record, so revoked sessions immediately stop working.
- Settings shows the current device, other active devices, individual remote sign-out actions, and a sign-out-all-other-devices action.
- Session revoke endpoints depend on a tracked current session id and reject malformed session ids before they reach the revocation path.

## Verification Analytics And Diagnostics

- The analytics summary now tracks verification link issuance, resend usage, successful verification completion, and trust-policy block frequency in addition to persona activity metrics.
- The protected frontend analytics page surfaces those verification metrics so product and support teams can spot whether trust friction is rising.
- `GET /v1/health/verification` returns verification runtime diagnostics for staging and support use, including mail and SMS configuration status, verification dependency readiness, required migration coverage, trust-factor availability, and aggregate token counters.
- The diagnostics endpoint intentionally avoids PII and does not expose raw verification tokens or user email addresses.

## Frontend Environment

Create the frontend env file:

```bash
cp frontend/.env.example frontend/.env.local
```

Frontend value:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/v1
```

## Development Mode

### 1. Install dependencies

Backend:

```bash
npm install
```

Frontend:

```bash
cd frontend
npm install
cd ..
```

### 2. Prepare the database

From the repo root:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:seed
```

### 3. Start the backend in dev mode

From the repo root:

```bash
npm run start:dev
```

Backend URLs:

- App: `http://localhost:3000`
- API: `http://localhost:3000/v1`

### 4. Start the frontend in dev mode

In a second terminal:

```bash
cd frontend
npm run dev -- --port 3001
```

Frontend URL:

- App: `http://localhost:3001`

## Production Mode

Production mode assumes env files are already set correctly and the database is reachable.

Before booting in production, ensure the frontend base URLs and allowed CORS origins already point to their final HTTPS domains. The backend now rejects placeholder secrets and untrusted/local URL bases during startup.

If the backend runs behind a load balancer or ingress, set `TRUST_PROXY` before rollout so Express computes `request.ip` and `request.protocol` from the trusted forwarded chain. Rate limits, abuse controls, request correlation, and security diagnostics all depend on that setting being correct.

### 1. Build the backend

From the repo root:

```bash
npm install
npm run prisma:generate
npm run build
```

No extra native hashing rebuild step is required after install because the backend no longer depends on the native `bcrypt` module.

If this is a fresh deployment, apply migrations before starting:

```bash
npm run prisma:migrate:deploy
```

### 2. Start the backend in production mode

From the repo root:

```bash
NODE_ENV=production npm run start:prod
```

### 3. Build the frontend

From the frontend directory:

```bash
cd frontend
npm install
npm run build
```

### 4. Start the frontend in production mode

From the frontend directory:

```bash
NODE_ENV=production npm run start -- --port 3001
```

## Recommended Verification

Backend:

```bash
npm run typecheck
npm test
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

## Notes

- Backend uses the `/v1` API prefix.
- Backend exposes `/v1/metrics` for Prometheus-compatible health gauges, including auth security gauges for active reset tokens, OTP challenges, and session churn.
- Backend exposes `/v1/health/verification` for non-PII verification runtime diagnostics.
- Frontend expects the backend at `NEXT_PUBLIC_API_BASE_URL`.
- Local CORS is configured for `http://localhost:3001` by default.
- Reverse proxy deployments should preserve `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-Id`. Dotly sanitizes invalid incoming request IDs and emits hardened response headers including HSTS in production.
- Backend startup attempts a Redis connection in the background when `REDIS_ENABLED=true`; if Redis is unavailable the app still serves traffic and `/v1/health/ready` reports a degraded cache check.
- Set `REDIS_ENABLED=false` in environments where Redis is intentionally not part of the runtime contract; readiness then reports cache as disabled.
- Readiness checks do not force a fresh Redis reconnect on every probe; they report the latest known cache state and last attempted connection timestamp.
- Backend logs are structured JSON and include `x-request-id` correlation for request/exception tracing.
- Backend logs now redact secrets and mask auth-related identifiers such as user IDs, session IDs, challenge IDs, emails, and configured URL credentials when those values appear in structured metadata.
- Unverified accounts can still log in, but trust-sensitive product surfaces continue to gate on the backend verification policy.
- Twilio is the SMS gateway for mobile OTP enrollment. Use a verified sender number that can deliver to the regions you support.
- Mailgun and Twilio failures intentionally degrade the affected auth flows without exposing provider internals to end users. Alert on repeated `provider_error` outcomes in metrics or repeated degraded `/v1/health/verification` responses before promoting traffic.
- The current trust model is now email verification plus verified mobile OTP, with room for future linked auth methods or passkeys.
