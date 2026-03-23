-- Phase 21 introduces agency ownership and optional persona affiliation.

-- CreateEnum
CREATE TYPE "AgencyProfileStatus" AS ENUM ('draft', 'active', 'archived');

-- AlterTable
ALTER TABLE "Persona"
ADD COLUMN "agencyProfileId" UUID;

-- CreateTable
CREATE TABLE "AgencyProfile" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "tagline" VARCHAR(160),
    "description" TEXT,
    "logoUrl" VARCHAR(500),
    "status" "AgencyProfileStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyProfile_slug_key" ON "AgencyProfile"("slug");

-- CreateIndex
CREATE INDEX "AgencyProfile_ownerUserId_createdAt_idx" ON "AgencyProfile"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AgencyProfile_status_updatedAt_idx" ON "AgencyProfile"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Persona_agencyProfileId_idx" ON "Persona"("agencyProfileId");

-- AddForeignKey
ALTER TABLE "AgencyProfile"
ADD CONSTRAINT "AgencyProfile_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona"
ADD CONSTRAINT "Persona_agencyProfileId_fkey"
FOREIGN KEY ("agencyProfileId") REFERENCES "AgencyProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
