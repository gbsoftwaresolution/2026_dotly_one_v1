# Dotly Frontend

Frontend for Dotly built with Next.js App Router, TypeScript, and Tailwind CSS.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Current Scope

- Public routes for auth, persona discovery, public profiles, and QR resolution
- Protected app routes for personas, contact requests, contacts, analytics, events, notifications, and QR generation
- Same-origin route handlers that proxy authenticated browser traffic to the backend API
- Theme bootstrap that initializes before hydration and keeps document state in sync with client context
- Vitest coverage for auth/session state, protected middleware, analytics views, QR generation, and request access flows

## Notes

- Public routes include `/signup`, `/login`, `/u/[username]`, and QR/event-facing entry points
- Authenticated routes extend across `/app`, `/app/personas`, `/app/contact-requests`, `/app/contacts`, `/app/analytics`, `/app/events`, `/app/notifications`, and QR tooling
- Browser-to-backend calls use same-origin Next route handlers for auth and domain operations to keep tokens in HttpOnly cookies
- The frontend still reads backend data from `NEXT_PUBLIC_API_BASE_URL`
- Auth session state is stored in an HttpOnly cookie, not local storage
- Persona, request, QR, event, contact, notification, and analytics flows are wired to the backend

## Production Container

- Production image source: `frontend/Dockerfile`
- Next.js runs with `output: "standalone"` so the runtime image contains only the built server, static assets, and traced dependencies
- Set `NEXT_PUBLIC_API_BASE_URL` at build time to the final public backend `/v1` origin
- Local container build and run examples live in `docs/run-dotly.md`
