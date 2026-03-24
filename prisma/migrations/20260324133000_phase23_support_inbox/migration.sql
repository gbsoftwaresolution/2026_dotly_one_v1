-- Phase 23 adds persisted support inbox records.

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "SupportDeliveryStatus" AS ENUM ('sent', 'logged', 'failed');

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" UUID NOT NULL,
    "referenceId" VARCHAR(64) NOT NULL,
    "requesterName" VARCHAR(120),
    "requesterEmail" VARCHAR(254) NOT NULL,
    "topic" VARCHAR(80) NOT NULL,
    "details" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'open',
    "deliveryStatus" "SupportDeliveryStatus" NOT NULL DEFAULT 'logged',
    "ipAddressHash" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_referenceId_key" ON "SupportRequest"("referenceId");

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_requesterEmail_createdAt_idx" ON "SupportRequest"("requesterEmail", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_resolvedByUserId_resolvedAt_idx" ON "SupportRequest"("resolvedByUserId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
