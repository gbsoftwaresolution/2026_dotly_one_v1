-- Phase 22 adds lightweight relationship timeline fields with safe backfills.

-- CreateEnum
CREATE TYPE "RelationshipConnectionSource" AS ENUM (
  'qr',
  'event',
  'manual',
  'unknown'
);

-- AlterTable
ALTER TABLE "ContactRelationship"
ADD COLUMN "connectedAt" TIMESTAMP(3),
ADD COLUMN "metAt" TIMESTAMP(3),
ADD COLUMN "connectionSource" "RelationshipConnectionSource" NOT NULL DEFAULT 'unknown',
ADD COLUMN "contextLabel" VARCHAR(160);

-- Existing relationships should retain a stable origin point.
UPDATE "ContactRelationship"
SET
  "connectedAt" = COALESCE("connectedAt", "createdAt"),
  "metAt" = COALESCE("metAt", "createdAt"),
  "connectionSource" = COALESCE("connectionSource", 'unknown'::"RelationshipConnectionSource");

-- AlterTable
ALTER TABLE "ContactRelationship"
ALTER COLUMN "connectedAt" SET NOT NULL,
ALTER COLUMN "connectedAt" SET DEFAULT CURRENT_TIMESTAMP;