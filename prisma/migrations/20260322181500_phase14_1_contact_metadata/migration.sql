-- AlterTable
ALTER TABLE "ContactRelationship"
ADD COLUMN "interactionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastInteractionAt" TIMESTAMP(3);

-- Existing rows inherit the nullable/default contract from the new columns.
ALTER TABLE "ContactRelationship"
ADD CONSTRAINT "ContactRelationship_interactionCount_nonnegative"
CHECK ("interactionCount" >= 0);