/*
  Warnings:

  - You are about to drop the column `base_amount_cents` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `paid_at` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `payment_address` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `plan_code` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `tx_hash` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `crypto_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `search_tsv` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `stripe_events` table. All the data in the column will be lost.
  - You are about to drop the column `event_id` on the `stripe_events` table. All the data in the column will be lost.
  - You are about to drop the column `processed_at` on the `stripe_events` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[eventId]` on the table `stripe_events` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `baseAmountCents` to the `crypto_invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `crypto_invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentAddress` to the `crypto_invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `planCode` to the `crypto_invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `crypto_invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `crypto_invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventId` to the `stripe_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PlanCode" ADD VALUE 'Y1_1000';

-- DropForeignKey
ALTER TABLE "crypto_invoices" DROP CONSTRAINT "crypto_invoices_user_id_fkey";

-- DropIndex
DROP INDEX "idx_album_items_user_album_media";

-- DropIndex
DROP INDEX "idx_albums_user_name_search";

-- DropIndex
DROP INDEX "crypto_invoices_user_id_status_expires_at_idx";

-- DropIndex
DROP INDEX "idx_media_search_tsv";

-- DropIndex
DROP INDEX "idx_media_user_trashed_taken";

-- DropIndex
DROP INDEX "stripe_events_event_id_key";

-- AlterTable
ALTER TABLE "crypto_invoices" DROP COLUMN "base_amount_cents",
DROP COLUMN "created_at",
DROP COLUMN "expires_at",
DROP COLUMN "paid_at",
DROP COLUMN "payment_address",
DROP COLUMN "plan_code",
DROP COLUMN "tx_hash",
DROP COLUMN "updated_at",
DROP COLUMN "user_id",
ADD COLUMN     "baseAmountCents" INTEGER NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentAddress" TEXT NOT NULL,
ADD COLUMN     "planCode" "PlanCode" NOT NULL,
ADD COLUMN     "txHash" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "media" DROP COLUMN "search_tsv",
ADD COLUMN     "uploadedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stripe_events" DROP COLUMN "created_at",
DROP COLUMN "event_id",
DROP COLUMN "processed_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "eventId" TEXT NOT NULL,
ADD COLUMN     "processedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_userId_type_idx" ON "tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "tokens_hash_idx" ON "tokens"("hash");

-- CreateIndex
CREATE INDEX "tokens_expiresAt_idx" ON "tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "crypto_invoices_userId_status_expiresAt_idx" ON "crypto_invoices"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "media_uploadedAt_idx" ON "media"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_eventId_key" ON "stripe_events"("eventId");

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_invoices" ADD CONSTRAINT "crypto_invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
