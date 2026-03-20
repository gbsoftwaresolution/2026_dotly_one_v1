-- Historical no-op: this migration ran before Phase 7 created the event tables.
-- Keep it safe for shadow databases and fresh environments.

-- AlterTable
ALTER TABLE IF EXISTS "Event" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "EventParticipant" ALTER COLUMN "id" DROP DEFAULT;
