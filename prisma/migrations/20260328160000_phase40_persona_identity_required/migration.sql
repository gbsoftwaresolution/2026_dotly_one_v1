INSERT INTO "Identity" (
  "id",
  "personId",
  "identityType",
  "displayName",
  "handle",
  "verificationLevel",
  "status",
  "metadataJson",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."userId",
  CASE p."type"
    WHEN 'PERSONAL' THEN 'PERSONAL'::"IdentityType"
    WHEN 'PROFESSIONAL' THEN 'PROFESSIONAL'::"IdentityType"
    WHEN 'BUSINESS' THEN 'BUSINESS'::"IdentityType"
  END,
  p."fullName",
  NULL,
  CASE
    WHEN COALESCE(p."businessVerified", false) = true THEN 'strong_verified'
    WHEN COALESCE(p."emailVerified", false) = true OR COALESCE(p."phoneVerified", false) = true THEN 'basic_verified'
    ELSE 'unverified'
  END,
  'active',
  jsonb_build_object(
    'migratedFromPersonaId', p."id",
    'migration', 'phase40_persona_identity_required'
  ),
  NOW(),
  NOW()
FROM "Persona" p
WHERE p."identityId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Identity" i
    WHERE i."personId" = p."userId"
      AND i."identityType" = CASE p."type"
        WHEN 'PERSONAL' THEN 'PERSONAL'::"IdentityType"
        WHEN 'PROFESSIONAL' THEN 'PROFESSIONAL'::"IdentityType"
        WHEN 'BUSINESS' THEN 'BUSINESS'::"IdentityType"
      END
  );

UPDATE "Persona" p
SET "identityId" = i."id"
FROM "Identity" i
WHERE i."personId" = p."userId"
  AND i."identityType" = CASE p."type"
    WHEN 'PERSONAL' THEN 'PERSONAL'::"IdentityType"
    WHEN 'PROFESSIONAL' THEN 'PROFESSIONAL'::"IdentityType"
    WHEN 'BUSINESS' THEN 'BUSINESS'::"IdentityType"
  END
  AND (
    p."identityId" IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM "Identity" owned
      WHERE owned."id" = p."identityId"
        AND owned."personId" = p."userId"
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Persona" WHERE "identityId" IS NULL) THEN
    RAISE EXCEPTION 'Persona identity backfill incomplete; found Persona rows with null identityId';
  END IF;
END $$;

ALTER TABLE "Persona"
DROP CONSTRAINT IF EXISTS "Persona_identityId_fkey";

ALTER TABLE "Persona"
ALTER COLUMN "identityId" SET NOT NULL;

ALTER TABLE "Persona"
ADD CONSTRAINT "Persona_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "Identity"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Persona_identityId_default_routing_key";

CREATE UNIQUE INDEX "Persona_identityId_default_routing_key"
ON "Persona"("identityId")
WHERE "isDefaultRouting" IS TRUE;