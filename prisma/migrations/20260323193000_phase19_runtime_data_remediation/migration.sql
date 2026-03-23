-- Phase 19 applies forward-only remediation for legacy persona sharing,
-- event context backfill, instant-access expiry safety, and ownership integrity.

-- 1. Normalize invalid legacy system-managed smart-card rows to fail-closed controlled mode.
UPDATE "Persona"
SET
  "sharingMode" = 'controlled',
  "smartCardConfig" = NULL
WHERE "sharingMode" = 'smart_card'
  AND (
    "smartCardConfig" IS NULL
    OR jsonb_typeof("smartCardConfig") <> 'object'
    OR NOT ("smartCardConfig" ? 'primaryAction')
    OR NOT ("smartCardConfig" ? '_meta')
  )
  AND (
    "smartCardConfig" IS NULL
    OR "smartCardConfig"->'_meta'->>'source' IS DISTINCT FROM 'user_custom'
  );

-- 2. Backfill missing relationship event context from event-sourced relationships.
UPDATE "ContactRelationship"
SET "connectionContext" = jsonb_build_object(
  'type', 'event',
  'eventId', event_source."id",
  'label', event_source."name"
)
FROM "Event" AS event_source
WHERE "ContactRelationship"."sourceType" = 'event'
  AND "ContactRelationship"."sourceId" = event_source."id"
  AND (
    "ContactRelationship"."connectionContext" IS NULL
    OR jsonb_typeof("ContactRelationship"."connectionContext") <> 'object'
    OR COALESCE("ContactRelationship"."connectionContext"->>'eventId', '') = ''
  );

-- 3. Backfill missing contact-memory event context from relationships.
UPDATE "ContactMemory"
SET
  "eventId" = event_source."id",
  "contextLabel" = CASE
    WHEN btrim(COALESCE("ContactMemory"."contextLabel", '')) = ''
      THEN event_source."name"
    ELSE "ContactMemory"."contextLabel"
  END
FROM "ContactRelationship" AS rel
JOIN "Event" AS event_source
  ON rel."sourceType" = 'event'
 AND rel."sourceId" = event_source."id"
WHERE rel."id" = "ContactMemory"."relationshipId"
  AND (
    "ContactMemory"."eventId" IS NULL
    OR btrim(COALESCE("ContactMemory"."contextLabel", '')) = ''
  );

-- 4. Repair ownership mismatches by aligning user ids to the owning personas instead of deleting rows.
UPDATE "EventParticipant" AS ep
SET "userId" = persona."userId"
FROM "Persona" AS persona
WHERE persona."id" = ep."personaId"
  AND ep."userId" <> persona."userId";

UPDATE "ContactRequest" AS cr
SET "fromUserId" = from_persona."userId"
FROM "Persona" AS from_persona
WHERE from_persona."id" = cr."fromPersonaId"
  AND cr."fromUserId" <> from_persona."userId";

UPDATE "ContactRequest" AS cr
SET "toUserId" = to_persona."userId"
FROM "Persona" AS to_persona
WHERE to_persona."id" = cr."toPersonaId"
  AND cr."toUserId" <> to_persona."userId";

UPDATE "ContactRelationship" AS rel
SET "ownerUserId" = owner_persona."userId"
FROM "Persona" AS owner_persona
WHERE owner_persona."id" = rel."ownerPersonaId"
  AND rel."ownerUserId" <> owner_persona."userId";

UPDATE "ContactRelationship" AS rel
SET "targetUserId" = target_persona."userId"
FROM "Persona" AS target_persona
WHERE target_persona."id" = rel."targetPersonaId"
  AND rel."targetUserId" <> target_persona."userId";

-- 5. Expire legacy instant-access relationships that were created without an expiry.
UPDATE "ContactRelationship"
SET
  "state" = 'expired',
  "accessEndAt" = COALESCE("accessStartAt", "createdAt")
WHERE "state" = 'instant_access'
  AND "accessEndAt" IS NULL;

-- 6. Guard future writes from recreating null-expiry instant-access rows.
ALTER TABLE "ContactRelationship"
DROP CONSTRAINT IF EXISTS "ContactRelationship_instant_access_requires_end_at";

ALTER TABLE "ContactRelationship"
ADD CONSTRAINT "ContactRelationship_instant_access_requires_end_at"
CHECK (
  "state" <> 'instant_access'
  OR "accessEndAt" IS NOT NULL
);
