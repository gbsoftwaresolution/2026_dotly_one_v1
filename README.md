# Dotly Phase 1

Dotly is a permissioned identity and contact system. This repo contains the Phase 1 backend and frontend for signup, login, authenticated home, persona creation/listing, and open public profiles.

## Backend

NestJS modular monolith with PostgreSQL and Prisma.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run build
npm run start:dev
```

Required backend env values are documented in `.env.example`, including `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGINS`.

## Frontend

Next.js App Router app with TypeScript and Tailwind CSS.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Phase 1 Scope

- Public routes: `/`, `/signup`, `/login`, `/u/[username]`
- App routes: `/app`, `/app/personas`, `/app/personas/create`
- Public profile lookup only resolves personas with `accessMode = open`
- Auth uses same-origin Next route handlers plus an HttpOnly session cookie

## Local Development Notes

- Backend API prefix: `/v1`
- Default backend URL: `http://localhost:3000/v1`
- Expected frontend URL for local dev CORS: `http://localhost:3001`
- Run `npm run typecheck && npm run build` in both backend and `frontend` before shipping changes
