DROP INDEX IF EXISTS "IdentityConversation_sourceIdentityId_targetIdentityId_con_key";

CREATE UNIQUE INDEX "IdentityConversation_sourceIdentityId_targetIdentityId_conne_persona_key"
ON "IdentityConversation"(
  "sourceIdentityId",
  "targetIdentityId",
  "connectionId",
  COALESCE("personaId", '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX "IdentityConversation_sourceIdentityId_targetIdentityId_conne_idx"
ON "IdentityConversation"("sourceIdentityId", "targetIdentityId", "connectionId");
