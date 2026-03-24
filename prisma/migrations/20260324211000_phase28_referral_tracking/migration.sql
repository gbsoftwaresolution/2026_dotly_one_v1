-- Phase 28 adds simple referral tracking for users.

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "referralCode" VARCHAR(24),
ADD COLUMN "referredBy" UUID;

-- Backfill deterministic temporary referral codes for existing users.
UPDATE "User"
SET "referralCode" = CONCAT('DOT', SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 12))
WHERE "referralCode" IS NULL;

-- Enforce constraints after backfill.
ALTER TABLE "User"
ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredBy_idx" ON "User"("referredBy");

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_referredBy_fkey"
FOREIGN KEY ("referredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
