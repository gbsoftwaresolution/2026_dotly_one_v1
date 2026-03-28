ALTER TABLE "Persona"
ADD COLUMN "identityId" UUID;

ALTER TABLE "Persona"
ADD CONSTRAINT "Persona_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "Identity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Persona_identityId_idx" ON "Persona"("identityId");

ALTER TABLE "IdentityConversation"
ADD COLUMN "personaId" UUID;

ALTER TABLE "IdentityConversation"
ADD CONSTRAINT "IdentityConversation_personaId_fkey"
FOREIGN KEY ("personaId") REFERENCES "Persona"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "IdentityConversation_personaId_idx" ON "IdentityConversation"("personaId");

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
  WHEN 'personal' THEN 'personal'::"IdentityType"
  WHEN 'professional' THEN 'professional'::"IdentityType"
  WHEN 'business' THEN 'business'::"IdentityType"
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
    'migration', 'phase34_persona_identity_ownership'
  ),
  NOW(),
  NOW()
FROM "Persona" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "Identity" i
  WHERE i."personId" = p."userId"
    AND i."identityType" = CASE p."type"
      WHEN 'personal' THEN 'personal'::"IdentityType"
      WHEN 'professional' THEN 'professional'::"IdentityType"
      WHEN 'business' THEN 'business'::"IdentityType"
    END
);

UPDATE "Persona" p
SET "identityId" = i."id"
FROM "Identity" i
WHERE p."identityId" IS NULL
  AND i."personId" = p."userId"
  AND i."identityType" = CASE p."type"
    WHEN 'personal' THEN 'personal'::"IdentityType"
    WHEN 'professional' THEN 'professional'::"IdentityType"
    WHEN 'business' THEN 'business'::"IdentityType"
  END;
