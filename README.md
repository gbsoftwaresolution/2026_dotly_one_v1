# Dotly

Dotly is a permissioned identity and contact platform built around personas, approval-based sharing, and auditable relationship growth. This repository contains a NestJS modular monolith backend and a Next.js App Router frontend spanning identity, QR sharing, contact requests, relationships, notifications, events, blocks, trust controls, and analytics.

## Architecture

- Backend: NestJS modular monolith with domain modules under `src/modules`, shared cross-cutting concerns under `src/common`, and infrastructure adapters under `src/infrastructure`
- Data layer: Prisma + PostgreSQL for persistence, with advisory-lock-backed request throttling and Redis as an optional fail-soft cache/runtime dependency
- Frontend: Next.js App Router + TypeScript + Tailwind CSS, same-origin route handlers, protected `/app` surfaces, and client-side tests around auth, analytics, QR, request, and route-guard flows
- Observability: structured JSON logs, request ID propagation via `x-request-id`, global exception envelopes, liveness at `/v1/health`, and readiness at `/v1/health/ready`
- Metrics: Prometheus-style gauges are exposed at `/v1/metrics` for service, database, cache, and auth security state integration
- Verification diagnostics: `/v1/health/verification` exposes non-PII verification runtime state for staging and support debugging
- Domain modules: auth, personas, profiles, QR, contact requests, contacts, relationships, contact memory, events, notifications, analytics, blocks, trust-abuse, and users

## Product Scope

- Public discovery and profile access through persona usernames and QR codes
- Permissioned contact requests from profile, QR, and event entry points
- Relationship creation with approval workflows and contact memory bootstrap
- Event creation, participation, and gated event request flows
- Notifications for requests, approvals, and event-driven interactions
- Persona and aggregate analytics for views, scans, requests, approvals, and contacts
- Account-level verification analytics for issued links, resend usage, completed verification, and trust-policy blocks
- Blocking and verified-only safeguards to preserve privacy and abuse boundaries
- Email verification for new accounts, resend guardrails, and Mailgun-backed delivery when configured
- Password change, password reset, Twilio-backed mobile OTP enrollment, and revocable device sessions in the account security center
- Dedicated in-app settings controls for account trust, verification management, password recovery, mobile OTP, and active devices

## Current Repository Layout

- `src/app.module.ts`: backend composition root
- `src/modules/*`: business capabilities grouped by domain boundary
- `src/infrastructure/*`: config, database, cache, logging, mail, and storage adapters
- `test/*`: backend unit-style coverage using Node's test runner
- `frontend/src/app/*`: App Router pages, layouts, and API route handlers
- `frontend/src/components/*`: UI building blocks and feature screens
- `frontend/src/context` and `frontend/src/hooks`: client-side state and behavior hooks
- `frontend/src/**/*.test.tsx`: Vitest coverage for protected flows and critical interaction paths
- `.github/workflows/*.yml`: backend and frontend CI pipelines

## Local Development

Backend:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

Password hashing uses `bcryptjs` rather than native `bcrypt`, so backend installs do not depend on a compiled `bcrypt_lib.node` addon or postinstall rebuild step.

Backend mail env:

- `MAILGUN_API_KEY`: Mailgun private API key
- `MAILGUN_DOMAIN`: Mailgun sending domain
- `MAIL_FROM_EMAIL`: verified sender address, for example `Dotly <hello@dotly.one>`
- `FRONTEND_VERIFICATION_URL_BASE`: full public verify route, for example `http://localhost:3001/verify-email`
- `FRONTEND_PASSWORD_RESET_URL_BASE`: full public reset route, for example `http://localhost:3001/reset-password`
- `TWILIO_ACCOUNT_SID`: Twilio account SID for SMS OTP delivery
- `TWILIO_AUTH_TOKEN`: Twilio auth token for SMS OTP delivery
- `TWILIO_FROM_PHONE_NUMBER`: Twilio phone number used to send verification codes

Production config posture:

- `JWT_SECRET` must be a non-placeholder secret with at least 32 characters and strong entropy.
- `JWT_EXPIRES_IN` must use the supported duration format such as `15m`, `12h`, or `7d`.
- `CORS_ORIGINS`, `FRONTEND_VERIFICATION_URL_BASE`, `FRONTEND_PASSWORD_RESET_URL_BASE`, and `QR_BASE_URL` must use trusted HTTPS origins in production. Localhost and placeholder hosts are rejected.
- Production startup now fails fast when Mailgun credentials or frontend verification/reset URLs are missing, instead of silently degrading verification and recovery.
- Twilio remains optional, but partial Twilio configuration is rejected in every environment.

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev -- --port 3001
```

Full development and production startup instructions live in `docs/run-dotly.md`.

## Auth And Security Docs

- `docs/auth-trust-architecture.md`: current auth, trust-factor, provider, and session architecture
- `docs/auth-runbooks.md`: operator runbooks for delivery failures, abuse spikes, login spikes, and session anomalies
- `docs/auth-operational-checklists.md`: staging, release, post-deploy, and final auth validation checklists
- `docs/auth-developer-onboarding.md`: contributor map for auth entry points, policies, rate limiting, and safe extension patterns
- `docs/auth-degraded-modes.md`: degraded-mode and fail-closed behavior by dependency and flow
- `docs/auth-production-posture.md`: deployment assumptions for ingress, cookies, providers, and production smoke checks
- `docs/auth-metrics.md`: auth-specific metrics and operational interpretation
- `docs/security-audit-logging.md`: auth and trust audit event vocabulary and safe logging rules
- `docs/session-security-contract.md`: tracked-session enforcement and revocation guarantees
- `docs/staging-launch-checklist.md`: broader backend staging readiness checklist

## Quality Gates

Backend:

```bash
npm run prisma:generate
npm run typecheck
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

CI workflows:

- `.github/workflows/backend-ci.yml` covers backend install, Prisma generate, typecheck, tests, and build
- `.github/workflows/frontend-ci.yml` covers frontend lint, typecheck, tests, and build

## Operational Notes

- Backend API prefix: `/v1`
- Default local backend URL: `http://localhost:3000/v1`
- Expected local frontend URL: `http://localhost:3001`
- Redis connectivity is fail-soft: startup attempts a background connection when `REDIS_ENABLED=true`, request handling continues without Redis, and readiness reports degraded or disabled cache state without forcing reconnect storms
- Email verification is required for trust-aware features that depend on `isVerified`; unverified users can still log in and continue basic setup
- Verified email is currently required for sending contact requests, creating shareable profile QR codes, creating Quick Connect QR codes, joining events, enabling event discovery, and viewing discoverable event participants
- Mobile OTP is now the next active trust factor and satisfies the same trust-sensitive policy seam once verified
- Unverified users can still sign up, log in, create personas, browse protected screens, and complete basic onboarding without being locked out of the workspace
- Frontend verification UX now exposes session verification state with badges, an in-app unverified banner, resend verification actions, and clear trust-language guidance on blocked request, QR, and event flows
- Account trust management now has a dedicated settings surface where authenticated users can review verification status, rotate passwords, enroll mobile OTP, inspect active sessions, revoke devices, and trigger recovery-friendly flows
- Password reset links are hashed, one-time, and time-limited. Completing a reset revokes all active sessions.
- Mobile OTP verification enforces resend guardrails, a short retry cooldown between incorrect code attempts, and terminal lockout after repeated failures.
- The trust-policy layer now evaluates allowed trust factors per action. Email verification and verified mobile OTP satisfy trust-sensitive requirements without changing downstream call sites.
- Each successful login creates a stored session record with device metadata so current-device badges and remote sign-out can work predictably.
- Authenticated JWTs are now valid only when they carry a tracked session id that still resolves to an active session record; revoked, expired, or missing session records are rejected uniformly.
- Session listings intentionally show active sessions only. Revoked and expired sessions are treated as inactive state, excluded from active-device views, and remote sign-out remains idempotent when a target session is already inactive.
- Password change and password reset now revoke sessions inside the same database transaction as the credential mutation so sensitive auth events cannot commit while leaving prior sessions active.
- Resend verification accepts the request when the account is still pending, applies cooldown feedback when retried too quickly, and records verification analytics for issued links, resend usage, successful verification, and blocked trust actions.
- Session-management endpoints require a tracked current session context, reject malformed revoke targets, and emit structured auth-security logs for device sign-out actions.
- When `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAIL_FROM_EMAIL`, or `FRONTEND_VERIFICATION_URL_BASE` are missing, signup still creates a pending account but verification email delivery is skipped safely
- Browser clients can supply and read `x-request-id` for correlation across backend responses
- `GET /v1/metrics` is safe for infrastructure scraping and returns plain-text gauges for service/database/cache health plus active password reset tokens, active OTP challenges, and active/recently revoked sessions
- `GET /v1/health/verification` is safe for staging and support diagnostics and returns runtime verification readiness, mail and SMS configuration status, required migration status, and token volume counters without exposing raw secrets, user emails, or token values
- Use `docs/staging-launch-checklist.md` before promoting staging to production
