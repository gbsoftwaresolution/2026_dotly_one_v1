-- Phase 7 adds event-scoped discovery with opt-in participation visibility.

-- AlterEnum
ALTER TYPE "ContactRequestSourceType" ADD VALUE IF NOT EXISTS 'event';

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'live', 'ended');

-- CreateEnum
CREATE TYPE "EventParticipantRole" AS ENUM ('attendee', 'speaker', 'organizer');

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "role" "EventParticipantRole" NOT NULL DEFAULT 'attendee',
    "discoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_createdByUserId_createdAt_idx" ON "Event"("createdByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_personaId_key" ON "EventParticipant"("eventId", "personaId");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_discoveryEnabled_joinedAt_idx" ON "EventParticipant"("eventId", "discoveryEnabled", "joinedAt");

-- CreateIndex
CREATE INDEX "EventParticipant_userId_joinedAt_idx" ON "EventParticipant"("userId", "joinedAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_personaId_fkey"
FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
