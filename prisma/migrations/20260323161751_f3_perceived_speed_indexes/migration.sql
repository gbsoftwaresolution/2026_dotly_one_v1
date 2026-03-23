-- CreateIndex
CREATE INDEX "ContactRelationship_ownerUserId_lastInteractionAt_createdAt_idx" ON "ContactRelationship"("ownerUserId", "lastInteractionAt", "createdAt");

-- CreateIndex
CREATE INDEX "Persona_userId_updatedAt_createdAt_idx" ON "Persona"("userId", "updatedAt", "createdAt");
