-- Phase 17 adds lightweight relationship and memory context for event-aware connections.

ALTER TABLE "ContactRelationship"
ADD COLUMN "connectionContext" JSONB;

ALTER TABLE "ContactMemory"
ADD COLUMN "eventId" UUID,
ADD COLUMN "contextLabel" VARCHAR(160) NOT NULL DEFAULT '';

UPDATE "ContactMemory"
SET "contextLabel" = COALESCE("sourceLabel", '')
WHERE "contextLabel" = '';