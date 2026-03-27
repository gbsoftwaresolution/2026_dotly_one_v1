ALTER TABLE "Persona"
ADD COLUMN "routingKey" VARCHAR(64),
ADD COLUMN "routingDisplayName" VARCHAR(160),
ADD COLUMN "isDefaultRouting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "routingRulesJson" JSON;

CREATE UNIQUE INDEX "Persona_identityId_routingKey_key"
ON "Persona"("identityId", "routingKey")
WHERE "routingKey" IS NOT NULL;
