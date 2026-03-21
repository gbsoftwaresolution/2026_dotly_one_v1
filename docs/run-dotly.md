# Run Dotly

This guide covers how to run Dotly locally in development mode and how to start both services in production mode.

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL
- Redis

## Backend Environment

Create the backend env file:

```bash
cp .env.example .env
```

Minimum required backend values:

```env
NODE_ENV=development
PORT=3000
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
QR_BASE_URL=http://localhost:3001/q
```

Mail behavior:

- Email verification links are sent through Mailgun only when all four mail values above are configured.
- If Mailgun is disabled or only partially configured, signup still succeeds, the account remains unverified, and the frontend explains that email delivery is unavailable in the current environment.
- Verification links expire after 24 hours. Resend requests are cooldown-limited to avoid rapid abuse.

## Verification Policy

- Dotly keeps signup, login, persona setup, and basic onboarding available to unverified accounts.
- Dotly currently requires a verified email for trust-sensitive actions: sending contact requests, creating profile QR codes, creating Quick Connect QR codes, joining events, enabling event discovery, and viewing discoverable event participants.
- Blocked trust actions return a user-facing `403` message that tells the user to verify their email and resend a verification link if needed.
- The backend rule is centralized in a trust-aware verification policy service. Email verification is the active trust factor today, and the same requirement model is ready to accept mobile OTP or additional verified identity factors later without rewriting each call site.

## Resend Verification UX

- Unverified users see their verification state in the app shell and settings.
- Restricted entry points such as contact requests, QR sharing, and event participation show verification guidance before the user attempts the action.
- The resend CTA is available from the verification page and the in-app unverified prompts.
- Successful resend attempts confirm that a fresh link is on the way.
- Cooldown responses tell the user to check the latest email and wait about a minute before trying again.

## Verification Analytics And Diagnostics

- The analytics summary now tracks verification link issuance, resend usage, successful verification completion, and trust-policy block frequency in addition to persona activity metrics.
- The protected frontend analytics page surfaces those verification metrics so product and support teams can spot whether trust friction is rising.
- `GET /v1/health/verification` returns verification runtime diagnostics for staging and support use, including mail configuration status, required migration coverage, trust-factor availability, and aggregate token counters.
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

### 1. Build the backend

From the repo root:

```bash
npm install
npm run prisma:generate
npm run build
```

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
- Backend exposes `/v1/metrics` for Prometheus-compatible health gauges.
- Backend exposes `/v1/health/verification` for non-PII verification runtime diagnostics.
- Frontend expects the backend at `NEXT_PUBLIC_API_BASE_URL`.
- Local CORS is configured for `http://localhost:3001` by default.
- Backend startup attempts a Redis connection in the background when `REDIS_ENABLED=true`; if Redis is unavailable the app still serves traffic and `/v1/health/ready` reports a degraded cache check.
- Set `REDIS_ENABLED=false` in environments where Redis is intentionally not part of the runtime contract; readiness then reports cache as disabled.
- Readiness checks do not force a fresh Redis reconnect on every probe; they report the latest known cache state and last attempted connection timestamp.
- Backend logs are structured JSON and include `x-request-id` correlation for request/exception tracing.
- Unverified accounts can still log in, but trust-sensitive product surfaces continue to gate on the backend verification policy.
- The current verification policy is email-first, but the active requirement model already supports future mobile OTP or additional verified identity signals as interchangeable trust factors.
