-- This migration was created before later phase 8/9 tables existed.
-- Keep only the adjustments for tables available at this point in history.

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EventParticipant" ALTER COLUMN "id" DROP DEFAULT;
