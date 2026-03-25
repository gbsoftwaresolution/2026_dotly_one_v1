# Project Brief

## Project Name
Booster Vault (Memory/Photo Vault)

## Core Requirements & Goals
- Build a secure, private photo and video storage service with client-side encryption
- Server never has access to unencrypted media or decryption keys
- Provide non-AI features: albums, timeline view, search, exports
- Provide a secure “Life Docs” area for structured personal document entries (metadata + reminders)
- Provide optional “Continuity” flows for heirs/recipients (packs/policies/releases)
- Support read-only album sharing via public links (passphrase unlock client-side)
- Implement subscription/billing (crypto invoices + Stripe fallback)
- Create a RESTful API (OpenAPI-first where practical)
- Use PostgreSQL for data persistence with proper schema design
- Ensure scalability for media storage (S3-compatible object storage via signed URLs)
- Maintain zero-knowledge architecture: all encryption/decryption happens on client side

## Source of Truth for Project Scope
- **Implementation reality**: `IMPLEMENTATION_REPORT.md` (kept in-sync with repo)
- API intent/spec: `api/openapi.yaml`
- DB models: `apps/api/prisma/schema.prisma` + migrations in `apps/api/prisma/migrations/*`
- Developer runbook + env vars: `README.md` + `.env.example`

## Key Constraints
- Non-AI MVP: No facial recognition, object detection, or AI-powered search
- Client-side encryption mandatory for all media blobs
- Server stores only encrypted bytes and metadata
- Search limited to full-text on titles, notes, location text, album names
- Encryption primitives (current): Web Crypto AES-256-GCM (single-shot) and AES-256-GCM chunked scheme for large files

## Success Criteria
- Users can register/login, manage profile
- Upload encrypted photos/videos/documents with metadata
- Organize media into albums with manual ordering
- Browse timeline by date and search across media/albums (non-AI)
- Create exports (encrypted ZIP + manifest) via background jobs
- Share albums read-only via public links (passphrase unlock client-side)
- Users can create, browse, version, and search Life Docs
- Reminders for Life Docs run via background jobs
- Billing endpoints exist (crypto invoices + Stripe checkout + webhooks)
- Maintain privacy through zero-knowledge architecture

## Project Status
### Current state (as of 2026-02-20)
- **Repo**: pnpm workspace monorepo
  - `apps/api`: NestJS API (Postgres + Prisma, BullMQ workers)
  - `apps/web`: React/Vite web client (client-side crypto)
  - `packages/shared`: shared DTOs/types
- **Core vault is implemented** end-to-end: auth, vault-key bundle, recovery phrase, uploads/downloads (incl. multipart), albums, timeline, search, trash/purge, encrypted thumbnails, exports, sharing.

### Known gaps / TODOs (tracked)
- `GET /v1/media` has an `albumId` filter path that currently returns 400 (“not yet implemented”).
- Continuity “heir flow” has TODOs around guard wiring.
- Billing: Stripe webhook signature verification is marked TODO in code.