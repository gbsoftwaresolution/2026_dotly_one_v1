-- Phase 30 adds the foundational identity connection and permission persistence layer.

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM (
    'personal',
    'professional',
    'business',
    'couple',
    'family'
);

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM (
    'unknown',
    'requested',
    'known',
    'trusted',
    'inner_circle',
    'family',
    'partner',
    'colleague',
    'client',
    'vendor',
    'verified_business',
    'admin_managed',
    'blocked',
    'suspended_risky'
);

-- CreateEnum
CREATE TYPE "TrustState" AS ENUM (
    'unverified',
    'basic_verified',
    'strong_verified',
    'trusted_by_user',
    'high_risk',
    'restricted',
    'blocked'
);

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM (
    'pending',
    'active',
    'restricted',
    'blocked',
    'archived'
);

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM (
    'allow',
    'deny',
    'request_approval',
    'allow_with_limits'
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personId" UUID,
    "identityType" "IdentityType" NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "handle" VARCHAR(80),
    "verificationLevel" VARCHAR(64) NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityConnection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceIdentityId" UUID NOT NULL,
    "targetIdentityId" UUID NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "trustState" "TrustState" NOT NULL,
    "status" "ConnectionStatus" NOT NULL,
    "createdByIdentityId" UUID NOT NULL,
    "note" VARCHAR(500),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionPermissionOverride" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connectionId" UUID NOT NULL,
    "permissionKey" VARCHAR(120) NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "limitsJson" JSONB,
    "reason" VARCHAR(280),
    "createdByIdentityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionPermissionSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connectionId" UUID NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "permissionsJson" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionPermissionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Identity_identityType_idx" ON "Identity"("identityType");

-- CreateIndex
CREATE INDEX "Identity_personId_idx" ON "Identity"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_handle_key" ON "Identity"("handle") WHERE "handle" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "IdentityConnection_sourceIdentityId_targetIdentityId_key"
ON "IdentityConnection"("sourceIdentityId", "targetIdentityId");

-- CreateIndex
CREATE INDEX "IdentityConnection_sourceIdentityId_idx" ON "IdentityConnection"("sourceIdentityId");

-- CreateIndex
CREATE INDEX "IdentityConnection_targetIdentityId_idx" ON "IdentityConnection"("targetIdentityId");

-- CreateIndex
CREATE INDEX "IdentityConnection_connectionType_idx" ON "IdentityConnection"("connectionType");

-- CreateIndex
CREATE INDEX "IdentityConnection_trustState_idx" ON "IdentityConnection"("trustState");

-- CreateIndex
CREATE INDEX "IdentityConnection_status_idx" ON "IdentityConnection"("status");

-- CreateIndex
CREATE INDEX "IdentityConnection_sourceIdentityId_status_idx" ON "IdentityConnection"("sourceIdentityId", "status");

-- CreateIndex
CREATE INDEX "IdentityConnection_targetIdentityId_status_idx" ON "IdentityConnection"("targetIdentityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionPermissionOverride_connectionId_permissionKey_key"
ON "ConnectionPermissionOverride"("connectionId", "permissionKey");

-- CreateIndex
CREATE INDEX "ConnectionPermissionSnapshot_connectionId_idx" ON "ConnectionPermissionSnapshot"("connectionId");

-- CreateIndex
CREATE INDEX "ConnectionPermissionSnapshot_connectionId_policyVersion_idx"
ON "ConnectionPermissionSnapshot"("connectionId", "policyVersion");

-- AddForeignKey
ALTER TABLE "IdentityConnection" ADD CONSTRAINT "IdentityConnection_sourceIdentityId_fkey"
FOREIGN KEY ("sourceIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityConnection" ADD CONSTRAINT "IdentityConnection_targetIdentityId_fkey"
FOREIGN KEY ("targetIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityConnection" ADD CONSTRAINT "IdentityConnection_createdByIdentityId_fkey"
FOREIGN KEY ("createdByIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionPermissionOverride" ADD CONSTRAINT "ConnectionPermissionOverride_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IdentityConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionPermissionOverride" ADD CONSTRAINT "ConnectionPermissionOverride_createdByIdentityId_fkey"
FOREIGN KEY ("createdByIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionPermissionSnapshot" ADD CONSTRAINT "ConnectionPermissionSnapshot_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IdentityConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
