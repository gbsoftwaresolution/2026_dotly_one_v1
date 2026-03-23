UPDATE "ContactMemory"
SET "eventId" = NULL
WHERE "eventId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Event"
    WHERE "Event"."id" = "ContactMemory"."eventId"
  );

CREATE INDEX IF NOT EXISTS "ContactMemory_eventId_idx"
ON "ContactMemory"("eventId");

ALTER TABLE "ContactMemory"
ADD CONSTRAINT "ContactMemory_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;