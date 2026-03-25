-- Phase 31 adds seedable connection policy templates for identity connection defaults.

-- CreateTable
CREATE TABLE "ConnectionPolicyTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceIdentityType" "IdentityType",
    "connectionType" "ConnectionType" NOT NULL,
    "templateKey" VARCHAR(120) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "permissionsJson" JSONB NOT NULL,
    "limitsJson" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionPolicyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionPolicyTemplate_templateKey_key" ON "ConnectionPolicyTemplate"("templateKey");

-- CreateIndex
CREATE INDEX "ConnectionPolicyTemplate_sourceIdentityType_idx" ON "ConnectionPolicyTemplate"("sourceIdentityType");

-- CreateIndex
CREATE INDEX "ConnectionPolicyTemplate_connectionType_idx" ON "ConnectionPolicyTemplate"("connectionType");

-- CreateIndex
CREATE INDEX "ConnectionPolicyTemplate_isActive_idx" ON "ConnectionPolicyTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ConnectionPolicyTemplate_sourceIdentityType_connectionType_isA_idx"
ON "ConnectionPolicyTemplate"("sourceIdentityType", "connectionType", "isActive");
