ALTER TABLE "User"
ADD COLUMN "lastUsedPersonaId" UUID;

CREATE INDEX "User_lastUsedPersonaId_idx" ON "User"("lastUsedPersonaId");

ALTER TABLE "Persona"
ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Persona_userId_isPrimary_createdAt_idx"
ON "Persona"("userId", "isPrimary", "createdAt");