# Dotly Frontend Phase 1

Frontend for Dotly built with Next.js App Router, TypeScript, and Tailwind CSS.

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Notes

- Public routes: `/signup`, `/login`, and `/u/[username]`
- Authenticated routes: `/app`, `/app/personas`, and `/app/personas/create`
- Browser-to-backend calls use same-origin Next route handlers for auth and persona creation
- The frontend still reads backend data from `NEXT_PUBLIC_API_BASE_URL`
- Auth session state is stored in an HttpOnly cookie, not local storage
- Persona creation, persona listing, and public profile rendering are wired to the backend
- `/u/[username]` only succeeds for open personas
