-- Phase 2 adds QR sharing tokens for persona-based resolution.

-- CreateEnum
CREATE TYPE "QrType" AS ENUM ('profile', 'quick_connect');

-- CreateEnum
CREATE TYPE "QrStatus" AS ENUM ('active', 'expired', 'disabled');

-- CreateTable
CREATE TABLE "QRAccessToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personaId" UUID NOT NULL,
    "type" "QrType" NOT NULL,
    "code" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "QrStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QRAccessToken_code_key" ON "QRAccessToken"("code");

-- CreateIndex
CREATE INDEX "QRAccessToken_personaId_idx" ON "QRAccessToken"("personaId");

-- CreateIndex
CREATE INDEX "QRAccessToken_status_idx" ON "QRAccessToken"("status");

-- AddForeignKey
ALTER TABLE "QRAccessToken" ADD CONSTRAINT "QRAccessToken_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
