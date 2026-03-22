-- Phase 16 adds persona-scoped trust flags for safe public verification signals.

ALTER TABLE "Persona"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "businessVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trustScore" INTEGER;

UPDATE "Persona" AS persona
SET
  "emailVerified" = COALESCE("user"."isVerified", false),
  "phoneVerified" = "user"."phoneVerifiedAt" IS NOT NULL,
  "businessVerified" = false,
  "trustScore" =
    (CASE WHEN COALESCE("user"."isVerified", false) THEN 40 ELSE 0 END) +
    (CASE WHEN "user"."phoneVerifiedAt" IS NOT NULL THEN 40 ELSE 0 END)
FROM "User" AS "user"
WHERE "user"."id" = persona."userId";