-- Phase 18 enforces persona ownership integrity across all persona-user joins.

UPDATE "Persona" AS persona
SET
  "emailVerified" = COALESCE("user"."isVerified", false),
  "phoneVerified" = "user"."phoneVerifiedAt" IS NOT NULL,
  "businessVerified" = COALESCE(persona."businessVerified", false),
  "trustScore" =
    (CASE WHEN COALESCE("user"."isVerified", false) THEN 40 ELSE 0 END) +
    (CASE WHEN "user"."phoneVerifiedAt" IS NOT NULL THEN 40 ELSE 0 END)
FROM "User" AS "user"
WHERE "user"."id" = persona."userId";

DELETE FROM "EventParticipant" AS ep
WHERE NOT EXISTS (
  SELECT 1
  FROM "Persona" AS p
  WHERE p."id" = ep."personaId"
    AND p."userId" = ep."userId"
);

DELETE FROM "ContactRequest" AS cr
WHERE NOT EXISTS (
  SELECT 1
  FROM "Persona" AS p
  WHERE p."id" = cr."fromPersonaId"
    AND p."userId" = cr."fromUserId"
)
OR NOT EXISTS (
  SELECT 1
  FROM "Persona" AS p
  WHERE p."id" = cr."toPersonaId"
    AND p."userId" = cr."toUserId"
);

DELETE FROM "ContactRelationship" AS rel
WHERE NOT EXISTS (
  SELECT 1
  FROM "Persona" AS p
  WHERE p."id" = rel."ownerPersonaId"
    AND p."userId" = rel."ownerUserId"
)
OR NOT EXISTS (
  SELECT 1
  FROM "Persona" AS p
  WHERE p."id" = rel."targetPersonaId"
    AND p."userId" = rel."targetUserId"
);

CREATE UNIQUE INDEX IF NOT EXISTS "Persona_id_userId_key"
ON "Persona"("id", "userId");

ALTER TABLE "EventParticipant"
DROP CONSTRAINT IF EXISTS "EventParticipant_personaId_fkey";

ALTER TABLE "EventParticipant"
ADD CONSTRAINT "EventParticipant_personaId_userId_fkey"
FOREIGN KEY ("personaId", "userId")
REFERENCES "Persona"("id", "userId")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ContactRequest"
DROP CONSTRAINT IF EXISTS "ContactRequest_fromPersonaId_fkey";

ALTER TABLE "ContactRequest"
DROP CONSTRAINT IF EXISTS "ContactRequest_toPersonaId_fkey";

ALTER TABLE "ContactRequest"
ADD CONSTRAINT "ContactRequest_fromPersonaId_fromUserId_fkey"
FOREIGN KEY ("fromPersonaId", "fromUserId")
REFERENCES "Persona"("id", "userId")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ContactRequest"
ADD CONSTRAINT "ContactRequest_toPersonaId_toUserId_fkey"
FOREIGN KEY ("toPersonaId", "toUserId")
REFERENCES "Persona"("id", "userId")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ContactRelationship"
DROP CONSTRAINT IF EXISTS "ContactRelationship_ownerPersonaId_fkey";

ALTER TABLE "ContactRelationship"
DROP CONSTRAINT IF EXISTS "ContactRelationship_targetPersonaId_fkey";

ALTER TABLE "ContactRelationship"
ADD CONSTRAINT "ContactRelationship_ownerPersonaId_ownerUserId_fkey"
FOREIGN KEY ("ownerPersonaId", "ownerUserId")
REFERENCES "Persona"("id", "userId")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ContactRelationship"
ADD CONSTRAINT "ContactRelationship_targetPersonaId_targetUserId_fkey"
FOREIGN KEY ("targetPersonaId", "targetUserId")
REFERENCES "Persona"("id", "userId")
ON DELETE CASCADE
ON UPDATE CASCADE;
