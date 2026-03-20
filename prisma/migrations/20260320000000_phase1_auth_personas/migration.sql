-- Phase 1 resets starter tables from Phase 0 scaffold.
-- This migration assumes no production data exists yet.

-- DropForeignKey
ALTER TABLE "Persona" DROP CONSTRAINT IF EXISTS "Persona_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Persona";

-- DropTable
DROP TABLE IF EXISTS "User";

-- DropEnum
DROP TYPE IF EXISTS "PersonaAccessMode";

-- CreateEnum
CREATE TYPE "PersonaType" AS ENUM ('personal', 'professional', 'business');

-- CreateEnum
CREATE TYPE "PersonaAccessMode" AS ENUM ('open', 'request', 'private');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" "PersonaType" NOT NULL,
    "username" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "profilePhotoUrl" TEXT,
    "accessMode" "PersonaAccessMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_username_key" ON "Persona"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_publicUrl_key" ON "Persona"("publicUrl");

-- CreateIndex
CREATE INDEX "Persona_userId_idx" ON "Persona"("userId");

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
