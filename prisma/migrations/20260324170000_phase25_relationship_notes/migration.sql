-- Phase 25 adds plain-text private notes to owned relationships.

-- AlterTable
ALTER TABLE "ContactRelationship"
ADD COLUMN "notes" TEXT;

-- Backfill legacy private notes from the most recent contact memory entry.
UPDATE "ContactRelationship" AS relationship
SET "notes" = memory."note"
FROM (
	SELECT DISTINCT ON ("relationshipId")
		"relationshipId",
		"note"
	FROM "ContactMemory"
	WHERE "note" IS NOT NULL
		AND BTRIM("note") <> ''
	ORDER BY "relationshipId", "metAt" DESC, "id" DESC
) AS memory
WHERE relationship."id" = memory."relationshipId"
	AND relationship."notes" IS NULL;