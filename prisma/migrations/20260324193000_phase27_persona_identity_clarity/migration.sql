-- Phase 27 adds lightweight identity clarity fields to personas.

-- AlterTable
ALTER TABLE "Persona"
ALTER COLUMN "companyName" DROP NOT NULL,
ALTER COLUMN "tagline" DROP NOT NULL,
ADD COLUMN "websiteUrl" VARCHAR(500),
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
