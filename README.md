# Dotly

Dotly is a permissioned identity and contact platform built around personas, approval-based sharing, and auditable relationship growth. This repository contains a NestJS modular monolith backend and a Next.js App Router frontend spanning identity, QR sharing, contact requests, relationships, notifications, events, blocks, trust controls, and analytics.

## Architecture

- Backend: NestJS modular monolith with domain modules under `src/modules`, shared cross-cutting concerns under `src/common`, and infrastructure adapters under `src/infrastructure`
- Data layer: Prisma + PostgreSQL for persistence, with advisory-lock-backed request throttling and Redis as an optional fail-soft cache/runtime dependency
- Frontend: Next.js App Router + TypeScript + Tailwind CSS, same-origin route handlers, protected `/app` surfaces, and client-side tests around auth, analytics, QR, request, and route-guard flows
- Observability: structured JSON logs, request ID propagation via `x-request-id`, global exception envelopes, liveness at `/v1/health`, and readiness at `/v1/health/ready`
- Metrics: Prometheus-style gauges are exposed at `/v1/metrics` for service, database, and cache readiness integration
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

Backend mail env:

- `MAILGUN_API_KEY`: Mailgun private API key
- `MAILGUN_DOMAIN`: Mailgun sending domain
- `MAIL_FROM_EMAIL`: verified sender address, for example `Dotly <hello@dotly.one>`
- `FRONTEND_VERIFICATION_URL_BASE`: full public verify route, for example `http://localhost:3001/verify-email`

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev -- --port 3001
```

Full development and production startup instructions live in `docs/run-dotly.md`.

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
- Unverified users can still sign up, log in, create personas, browse protected screens, and complete basic onboarding without being locked out of the workspace
- Frontend verification UX now exposes session verification state with badges, an in-app unverified banner, resend verification actions, and clear trust-language guidance on blocked request, QR, and event flows
- The trust-policy layer now evaluates allowed trust factors per action. Email verification satisfies all current trust-sensitive requirements, and the same policy seam is ready for later mobile OTP or additional identity factors without changing call sites.
- Resend verification accepts the request when the account is still pending, applies cooldown feedback when retried too quickly, and records verification analytics for issued links, resend usage, successful verification, and blocked trust actions.
- When `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAIL_FROM_EMAIL`, or `FRONTEND_VERIFICATION_URL_BASE` are missing, signup still creates a pending account but verification email delivery is skipped safely
- Browser clients can supply and read `x-request-id` for correlation across backend responses
- `GET /v1/metrics` is safe for infrastructure scraping and returns plain-text gauges for service/database/cache health
- `GET /v1/health/verification` is safe for staging and support diagnostics and returns runtime verification readiness, trust-factor availability, required migration status, and token volume counters without exposing user emails or token values
- Use `docs/staging-launch-checklist.md` before promoting staging to production
