-- Phase 32 adds item-level content access rules on top of resolved connection permissions.

-- CreateTable
CREATE TABLE "ContentAccessRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contentId" UUID NOT NULL,
    "targetIdentityId" UUID NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "canForward" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "screenshotPolicy" VARCHAR(16) NOT NULL DEFAULT 'INHERIT',
    "recordPolicy" VARCHAR(16) NOT NULL DEFAULT 'INHERIT',
    "expiryAt" TIMESTAMP(3),
    "viewLimit" INTEGER,
    "watermarkMode" VARCHAR(64),
    "aiAccessAllowed" BOOLEAN,
    "metadataJson" JSONB,
    "createdByIdentityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentAccessRule_contentId_targetIdentityId_key"
ON "ContentAccessRule"("contentId", "targetIdentityId");

-- CreateIndex
CREATE INDEX "ContentAccessRule_contentId_idx" ON "ContentAccessRule"("contentId");

-- CreateIndex
CREATE INDEX "ContentAccessRule_targetIdentityId_idx" ON "ContentAccessRule"("targetIdentityId");

-- CreateIndex
CREATE INDEX "ContentAccessRule_expiryAt_idx" ON "ContentAccessRule"("expiryAt");

-- CreateIndex
CREATE INDEX "ContentAccessRule_contentId_targetIdentityId_idx"
ON "ContentAccessRule"("contentId", "targetIdentityId");

-- AddForeignKey
ALTER TABLE "ContentAccessRule" ADD CONSTRAINT "ContentAccessRule_targetIdentityId_fkey"
FOREIGN KEY ("targetIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessRule" ADD CONSTRAINT "ContentAccessRule_createdByIdentityId_fkey"
FOREIGN KEY ("createdByIdentityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
