CREATE UNIQUE INDEX "Persona_identityId_default_routing_key"
ON "Persona"("identityId")
WHERE "identityId" IS NOT NULL AND "isDefaultRouting" IS TRUE;