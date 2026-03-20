# Dotly Backend Staging Launch Checklist

Use this checklist before promoting the backend to production.

## Environment And Secrets

- Verify `DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `QR_BASE_URL`, `CORS_ORIGINS`, and `REDIS_URL` are set for staging.
- Confirm secrets come from the platform secret manager, not checked-in files or shell history.
- Verify staging uses a dedicated PostgreSQL database and Redis instance.
- Confirm TLS is enabled at the load balancer or ingress and external traffic is HTTPS only.

## Database And Migrations

- Run `npm run prisma:generate` in the staging build step.
- Apply all Prisma migrations to staging before app rollout.
- Verify unique constraints exist for usernames, emails, QR codes, pending request guards, and relationship ownership pairs.
- Confirm staging DB timezone and app hosts both operate in UTC.

## Backend Startup Verification

- Run `npm run build` and confirm the service boots cleanly with no schema or config errors.
- Verify `/v1` prefix is reachable through the staging ingress.
- Confirm CORS only allows intended staging frontend origins.
- Confirm the app logs do not print secrets, tokens, password hashes, or raw request bodies.

## Security Verification

- Verify protected endpoints reject anonymous access with `401`.
- Verify invalid JWTs and wrong `iss` or `aud` claims are rejected with `401`.
- Verify public profile responses expose only `username`, `fullName`, `jobTitle`, `companyName`, `tagline`, and `profilePhotoUrl`.
- Verify QR resolve responses do not expose private persona fields, internal IDs, usage counts, or token state.
- Verify private personas cannot create public profile QR codes.
- Verify raw internal exceptions are not exposed in HTTP `500` responses.

## Ownership And Access Control

- Verify one user cannot read, update, or delete another user's persona by UUID.
- Verify contact requests always bind to the authenticated user, not caller-supplied user identifiers.
- Verify only request recipients can approve or reject requests.
- Verify expired instant-access relationships are not returned in contact detail reads.
- Verify blocks prevent requests, event discovery visibility, and quick-connect QR connections.

## Event And Discovery Verification

- Verify users cannot join future, ended, or draft events.
- Verify participant visibility only works for joined users with discovery enabled.
- Verify event-based requests require the actor's joined persona and a discoverable target in the same event.
- Verify blocked users are excluded from visible participant lists.

## Notifications And Analytics

- Verify notification listing only returns the authenticated user's records.
- Verify notification payloads do not expose sensitive fields.
- Verify analytics endpoints only return owned persona aggregates.
- Verify analytics conversions handle zero denominators safely.

## Rate Limiting And Concurrency

- Verify rapid repeated request creation returns `429` after the configured threshold.
- Verify duplicate pending requests return `409` consistently.
- Verify simultaneous quick-connect scans do not create inconsistent duplicate active relationships.
- Verify simultaneous request approvals leave a single final approved state and no partial writes.

## Smoke Tests

- Run `npm run typecheck`.
- Run `npm test`.
- Run a staging HTTP smoke pass for auth, personas, profiles, QR, contact requests, events, and notifications.

## Go / No-Go

- Launch only if all checks above pass and staging logs show no repeated unexpected `500` responses.
