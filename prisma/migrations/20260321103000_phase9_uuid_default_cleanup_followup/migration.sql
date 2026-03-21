-- Finish the UUID default cleanup after notifications and analytics tables exist.

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EventParticipant" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AnalyticsEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PersonaAnalytics" ALTER COLUMN "id" DROP DEFAULT;