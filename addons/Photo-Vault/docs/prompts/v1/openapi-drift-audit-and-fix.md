# V1 Spec Prompt — OpenAPI Drift Audit + Fix (api/openapi.yaml)

## Role
You are a senior backend engineer responsible for ensuring the published OpenAPI spec matches the actual NestJS implementation.

## Goal (V1 quality + integrations)
Audit and fix **drift** between:
- Implementation (NestJS controllers in `apps/api/src/**`) and
- Spec (`api/openapi.yaml`)

So that:
- Generated clients are correct
- Docs are trustworthy
- E2E tests can validate contract

## Success Criteria
1. Every implemented `@Controller()` route under `/v1` is represented in `api/openapi.yaml` with:
   - correct HTTP method + path
   - correct auth (Bearer JWT vs public)
   - correct request body schema
   - correct response codes + response schema
2. Spec does **not** contain endpoints that no longer exist.
3. Add a lightweight **drift test** or CI check (optional but recommended) so drift is caught early.

## Constraints / Repo Pointers
- Spec: `api/openapi.yaml`
- API source: `apps/api/src`
- Likely drift-heavy areas:
  - `apps/api/src/billing/*`
  - `apps/api/src/sharing/*`
  - `apps/api/src/exports/*`
  - `apps/api/src/life-docs/*`
  - `apps/api/src/continuity/*`

## Implementation Plan

### Step 1 — Produce a route inventory from the code
Create a simple inventory by scanning controllers:
- Search for `@Controller(` and `@Get/@Post/@Put/@Patch/@Delete`
- Capture:
  - full path (controller prefix + method path)
  - auth guard usage (`@UseGuards(JwtAuthGuard)` etc.)
  - DTO types used for request body
  - return type (if specified)

You may implement a small script (Node/TS) under `scripts/` to help extract routes, OR do a manual curated list.

### Step 2 — Compare against `api/openapi.yaml`
For each route in the inventory:
- If missing in OpenAPI: add it.
- If present but wrong: correct it.
- If spec has route not in code: remove or mark deprecated (choose one strategy).

### Step 3 — Normalize common concerns
- Ensure all JWT-protected endpoints declare:
  - `security: [{ bearerAuth: [] }]`
  - `401` response
- Ensure pagination params (`limit`, `cursor`) are consistent.
- Ensure IDs are `format: uuid` where applicable.

### Step 4 — Update schemas
Prefer reusing shared DTOs/types:
- Use the shapes from `packages/shared/src/**` as the ground truth.
- Keep schemas DRY by using `$ref` components.

### Step 5 — Add a drift guard (recommended)
Pick one:
1) **Snapshot route list**: a test that asserts known route strings haven’t changed unexpectedly.
2) **OpenAPI compile check**: parse `api/openapi.yaml` during CI and ensure it’s valid.
3) (Best) **Generate OpenAPI from code** (Swagger module) and diff it — only if it fits the project direction.

## Deliverables
- Updated `api/openapi.yaml`
- (Optional) `scripts/openapi-drift-audit.*` and/or `apps/api/**.spec.ts` drift guard
- Short report in `IMPLEMENTATION_REPORT.md` or `SHARING_IMPLEMENTATION_SUMMARY.md` summarizing changes

## Acceptance Checks
1. `pnpm lint` passes
2. `pnpm --filter @booster-vault/api test` passes
3. `api/openapi.yaml` validates with an OpenAPI validator
