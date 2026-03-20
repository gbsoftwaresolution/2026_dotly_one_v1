-- Phase 9 adds lightweight product analytics with event logs and persona aggregates.

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM (
    'profile_view',
    'qr_scan',
    'request_sent',
    'request_approved',
    'contact_created'
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "personaId" UUID,
    "eventType" "AnalyticsEventType" NOT NULL,
    "entityId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaAnalytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personaId" UUID NOT NULL,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "qrScans" INTEGER NOT NULL DEFAULT 0,
    "requestsReceived" INTEGER NOT NULL DEFAULT 0,
    "requestsApproved" INTEGER NOT NULL DEFAULT 0,
    "contactsCreated" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonaAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_personaId_createdAt_idx" ON "AnalyticsEvent"("personaId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_entityId_idx" ON "AnalyticsEvent"("eventType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_eventType_entityId_key"
ON "AnalyticsEvent"("eventType", "entityId")
WHERE "entityId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PersonaAnalytics_personaId_key" ON "PersonaAnalytics"("personaId");

-- CreateIndex
CREATE INDEX "PersonaAnalytics_updatedAt_idx" ON "PersonaAnalytics"("updatedAt");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_personaId_fkey"
FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaAnalytics" ADD CONSTRAINT "PersonaAnalytics_personaId_fkey"
FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
