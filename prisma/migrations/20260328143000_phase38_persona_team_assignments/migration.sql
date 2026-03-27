CREATE TABLE "IdentityMemberPersonaAssignment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "identityMemberId" UUID NOT NULL,
  "personaId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "IdentityMemberPersonaAssignment_identityMemberId_fkey"
    FOREIGN KEY ("identityMemberId") REFERENCES "IdentityMember"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IdentityMemberPersonaAssignment_personaId_fkey"
    FOREIGN KEY ("personaId") REFERENCES "Persona"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IdentityMemberPersonaAssignment_identityMemberId_personaId_key"
ON "IdentityMemberPersonaAssignment"("identityMemberId", "personaId");

CREATE INDEX "IdentityMemberPersonaAssignment_identityMemberId_idx"
ON "IdentityMemberPersonaAssignment"("identityMemberId");

CREATE INDEX "IdentityMemberPersonaAssignment_personaId_idx"
ON "IdentityMemberPersonaAssignment"("personaId");

CREATE TABLE "IdentityOperatorPersonaAssignment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "identityOperatorId" UUID NOT NULL,
  "personaId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "IdentityOperatorPersonaAssignment_identityOperatorId_fkey"
    FOREIGN KEY ("identityOperatorId") REFERENCES "IdentityOperator"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IdentityOperatorPersonaAssignment_personaId_fkey"
    FOREIGN KEY ("personaId") REFERENCES "Persona"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IdentityOperatorPersonaAssignment_identityOperatorId_personaId_key"
ON "IdentityOperatorPersonaAssignment"("identityOperatorId", "personaId");

CREATE INDEX "IdentityOperatorPersonaAssignment_identityOperatorId_idx"
ON "IdentityOperatorPersonaAssignment"("identityOperatorId");

CREATE INDEX "IdentityOperatorPersonaAssignment_personaId_idx"
ON "IdentityOperatorPersonaAssignment"("personaId");
