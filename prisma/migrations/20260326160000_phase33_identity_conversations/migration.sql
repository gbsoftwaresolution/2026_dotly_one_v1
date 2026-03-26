-- Phase 33 adds conversation context rows that bind direct identity conversations to connection permissions.

-- CreateTable
CREATE TABLE "IdentityConversation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceIdentityId" UUID NOT NULL,
    "targetIdentityId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "conversationType" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "title" VARCHAR(160),
    "metadataJson" JSONB,
    "lastResolvedAt" TIMESTAMP(3),
    "lastPermissionHash" VARCHAR(128),
    "createdByIdentityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityConversation_sourceIdentityId_targetIdentityId_con_key"
ON "IdentityConversation"("sourceIdentityId", "targetIdentityId", "connectionId");

-- CreateIndex
CREATE INDEX "IdentityConversation_sourceIdentityId_idx" ON "IdentityConversation"("sourceIdentityId");

-- CreateIndex
CREATE INDEX "IdentityConversation_targetIdentityId_idx" ON "IdentityConversation"("targetIdentityId");

-- CreateIndex
CREATE INDEX "IdentityConversation_connectionId_idx" ON "IdentityConversation"("connectionId");

-- CreateIndex
CREATE INDEX "IdentityConversation_status_idx" ON "IdentityConversation"("status");

-- CreateIndex
CREATE INDEX "IdentityConversation_conversationType_idx" ON "IdentityConversation"("conversationType");

-- CreateIndex
CREATE INDEX "IdentityConversation_sourceIdentityId_status_idx"
ON "IdentityConversation"("sourceIdentityId", "status");

-- CreateIndex
CREATE INDEX "IdentityConversation_targetIdentityId_status_idx"
ON "IdentityConversation"("targetIdentityId", "status");

-- AddForeignKey
ALTER TABLE "IdentityConversation" ADD CONSTRAINT "IdentityConversation_sourceIdentityId_fkey"
FOREIGN KEY ("sourceIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityConversation" ADD CONSTRAINT "IdentityConversation_targetIdentityId_fkey"
FOREIGN KEY ("targetIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityConversation" ADD CONSTRAINT "IdentityConversation_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IdentityConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityConversation" ADD CONSTRAINT "IdentityConversation_createdByIdentityId_fkey"
FOREIGN KEY ("createdByIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
