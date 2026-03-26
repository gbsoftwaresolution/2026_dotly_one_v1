-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM (
  'unknown',
  'friend',
  'partner',
  'family_member',
  'colleague',
  'client',
  'vendor',
  'verified_business_contact',
  'inner_circle',
  'household_service',
  'support_agent'
);

-- AlterTable
ALTER TABLE "IdentityConnection"
ADD COLUMN "relationshipType" "RelationshipType";

-- CreateIndex
CREATE INDEX "IdentityConnection_relationshipType_idx"
ON "IdentityConnection"("relationshipType");
