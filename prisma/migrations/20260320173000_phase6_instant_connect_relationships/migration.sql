-- Phase 6 adds instant access relationships with time-bound expiry windows.

-- AlterEnum
ALTER TYPE "ContactRelationshipState" ADD VALUE IF NOT EXISTS 'instant_access';
ALTER TYPE "ContactRelationshipState" ADD VALUE IF NOT EXISTS 'expired';

-- AlterTable
ALTER TABLE "ContactRelationship"
ADD COLUMN "accessStartAt" TIMESTAMP(3),
ADD COLUMN "accessEndAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "ContactRelationship_ownerUserId_state_createdAt_idx";

-- CreateIndex
CREATE INDEX "ContactRelationship_ownerUserId_state_accessEndAt_createdAt_idx"
ON "ContactRelationship"("ownerUserId", "state", "accessEndAt", "createdAt");
