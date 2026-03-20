-- Phase 3 adds stateful contact requests, approved relationships, contact memory,
-- and a minimal block table to support server-side request restrictions.

-- CreateEnum
CREATE TYPE "ContactRequestSourceType" AS ENUM ('profile', 'qr');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired',
    'cancelled'
);

-- CreateEnum
CREATE TYPE "ContactRelationshipState" AS ENUM ('approved');

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "fromPersonaId" UUID NOT NULL,
    "toPersonaId" UUID NOT NULL,
    "reason" VARCHAR(280),
    "sourceType" "ContactRequestSourceType" NOT NULL,
    "sourceId" UUID,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRelationship" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "ownerPersonaId" UUID NOT NULL,
    "targetPersonaId" UUID NOT NULL,
    "state" "ContactRelationshipState" NOT NULL DEFAULT 'approved',
    "sourceType" "ContactRequestSourceType" NOT NULL,
    "sourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMemory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "relationshipId" UUID NOT NULL,
    "sourceLabel" VARCHAR(120),
    "metAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(500),

    CONSTRAINT "ContactMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockerUserId" UUID NOT NULL,
    "blockedUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRequest_fromUserId_createdAt_idx" ON "ContactRequest"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_toUserId_status_createdAt_idx" ON "ContactRequest"("toUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_fromPersonaId_toPersonaId_status_idx" ON "ContactRequest"("fromPersonaId", "toPersonaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContactRequest_pending_fromPersonaId_toPersonaId_key"
ON "ContactRequest"("fromPersonaId", "toPersonaId")
WHERE "status" = 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "ContactRelationship_ownerUserId_targetUserId_ownerPersonaId_targetP_key"
ON "ContactRelationship"("ownerUserId", "targetUserId", "ownerPersonaId", "targetPersonaId");

-- CreateIndex
CREATE INDEX "ContactRelationship_ownerUserId_state_createdAt_idx" ON "ContactRelationship"("ownerUserId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRelationship_targetUserId_createdAt_idx" ON "ContactRelationship"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMemory_relationshipId_idx" ON "ContactMemory"("relationshipId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerUserId_blockedUserId_key" ON "Block"("blockerUserId", "blockedUserId");

-- CreateIndex
CREATE INDEX "Block_blockedUserId_idx" ON "Block"("blockedUserId");

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_fromUserId_fkey"
FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_toUserId_fkey"
FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_fromPersonaId_fkey"
FOREIGN KEY ("fromPersonaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_toPersonaId_fkey"
FOREIGN KEY ("toPersonaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRelationship" ADD CONSTRAINT "ContactRelationship_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRelationship" ADD CONSTRAINT "ContactRelationship_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRelationship" ADD CONSTRAINT "ContactRelationship_ownerPersonaId_fkey"
FOREIGN KEY ("ownerPersonaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRelationship" ADD CONSTRAINT "ContactRelationship_targetPersonaId_fkey"
FOREIGN KEY ("targetPersonaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMemory" ADD CONSTRAINT "ContactMemory_relationshipId_fkey"
FOREIGN KEY ("relationshipId") REFERENCES "ContactRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerUserId_fkey"
FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedUserId_fkey"
FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
