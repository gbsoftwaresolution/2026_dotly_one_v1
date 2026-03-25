-- Phase 29 adds persona-level public links display and location metadata.

-- CreateEnum
CREATE TYPE "PersonaSocialLinksDisplayMode" AS ENUM ('buttons', 'icons');

-- AlterTable
ALTER TABLE "Persona"
ADD COLUMN "locationAddress" VARCHAR(200),
ADD COLUMN "locationMapUrl" VARCHAR(500),
ADD COLUMN "socialLinks" JSONB,
ADD COLUMN "socialLinksDisplayMode" "PersonaSocialLinksDisplayMode" NOT NULL DEFAULT 'buttons';
