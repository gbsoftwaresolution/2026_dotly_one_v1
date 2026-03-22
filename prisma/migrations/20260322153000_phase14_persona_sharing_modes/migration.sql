-- CreateEnum
CREATE TYPE "PersonaSharingMode" AS ENUM ('controlled', 'smart_card');

-- AlterTable
ALTER TABLE "Persona"
ADD COLUMN "sharingMode" "PersonaSharingMode" NOT NULL DEFAULT 'controlled',
ADD COLUMN "smartCardConfig" JSONB;