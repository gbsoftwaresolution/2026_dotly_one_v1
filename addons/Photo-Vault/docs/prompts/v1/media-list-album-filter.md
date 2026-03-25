# V1 Spec Prompt — Implement `albumId` filter for `GET /v1/media`

## Role
You are a senior backend engineer implementing an API capability needed for the V1 vault UX.

## Goal (V1 UX + API correctness)
Implement the `albumId` query filter for `GET /v1/media`.

**Current behavior:** `apps/api/src/media/media.controller.ts` throws `400 Album filtering not yet implemented` when `albumId` is provided.

## Success Criteria
1. `GET /v1/media?albumId=<uuid>` returns a paginated list of media items that are in the given album.
2. Ownership is enforced:
   - Requesting user must own the album.
   - Only media belonging to the same user is returned.
3. Behavior matches existing semantics:
   - `includeTrashed=false` excludes trashed media.
   - Pagination continues to work (cursor + limit).
   - Optional `from`/`to` date filters still apply.
4. API returns **404** if album does not exist, and **403** if it exists but isn’t owned (or a single 404 for non-leakage — pick one consistently with existing patterns).
5. Add tests covering:
   - Happy path
   - Album not owned
   - Album not found
   - Trashed media excluded unless `includeTrashed=true`

## Repo Pointers
- Controller: `apps/api/src/media/media.controller.ts`
- Service: `apps/api/src/media/media.service.ts`
- Album items relations likely in Prisma schema/migrations: `apps/api/prisma/schema.prisma`
- Albums service/controller: `apps/api/src/albums/*`

## Implementation Notes
### Data model expectations
There is an ordered album items table (e.g., `AlbumItem`) connecting `albumId` ↔ `mediaId` with a `position`.

### Query strategy
Implement in `MediaService.listMedia` (or a new `listMediaInAlbum`) by:
1) Validating album exists and belongs to user.
2) Fetching media IDs in the album in order (by position + addedAt fallback).
3) Applying pagination:
   - Prefer cursor-based pagination using the album item position/id as cursor.
   - Or, if existing pagination is strictly on media.createdAt/id, document and implement a stable ordering for album view.

### Output ordering
For album filtered view, order by album item ordering (position). That’s what UX expects.

## Deliverables
- Code changes in:
  - `apps/api/src/media/media.controller.ts`
  - `apps/api/src/media/media.service.ts`
  - Possibly Prisma query helpers
- Tests:
  - `apps/api/src/media/media.controller.spec.ts` or new spec file
- Spec alignment:
  - Ensure `api/openapi.yaml` still documents `albumId` query param and response.

## Manual Test
1) Create album
2) Upload 2 media
3) Add both to album
4) `GET /v1/media?albumId=<albumId>` should return those 2 items in album order.
