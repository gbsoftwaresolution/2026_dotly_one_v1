-- Phase 26 adds lightweight predefined interaction signals for relationships.

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('GREETING', 'FOLLOW_UP', 'THANK_YOU');

-- CreateTable
CREATE TABLE "Interaction" (
	"id" UUID NOT NULL,
	"relationshipId" UUID NOT NULL,
	"senderUserId" UUID NOT NULL,
	"type" "InteractionType" NOT NULL,
	"payload" JSONB,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interaction_relationshipId_createdAt_idx"
ON "Interaction"("relationshipId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_senderUserId_createdAt_idx"
ON "Interaction"("senderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_relationshipId_senderUserId_createdAt_idx"
ON "Interaction"("relationshipId", "senderUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Interaction"
ADD CONSTRAINT "Interaction_relationshipId_fkey"
FOREIGN KEY ("relationshipId") REFERENCES "ContactRelationship"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction"
ADD CONSTRAINT "Interaction_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;