-- Phase 24 adds passive follow-up flags and types for system-generated reminders.

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('manual', 'inactivity', 'event_followup');

-- AlterTable
ALTER TABLE "FollowUp"
ADD COLUMN "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "type" "FollowUpType" NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE INDEX "FollowUp_relationshipId_isSystemGenerated_type_createdAt_idx"
ON "FollowUp"("relationshipId", "isSystemGenerated", "type", "createdAt");