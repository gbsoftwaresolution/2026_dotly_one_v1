-- Phase 5 adds backend-enforced verification gates for persona requests.

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Persona"
ADD COLUMN "verifiedOnly" BOOLEAN NOT NULL DEFAULT false;
