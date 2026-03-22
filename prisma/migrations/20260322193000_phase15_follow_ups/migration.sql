CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'completed', 'cancelled');

CREATE TABLE "FollowUp" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "relationshipId" UUID NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FollowUp_ownerUserId_status_remindAt_idx" ON "FollowUp"("ownerUserId", "status", "remindAt");
CREATE INDEX "FollowUp_relationshipId_remindAt_idx" ON "FollowUp"("relationshipId", "remindAt");
CREATE INDEX "FollowUp_ownerUserId_updatedAt_idx" ON "FollowUp"("ownerUserId", "updatedAt");

ALTER TABLE "FollowUp"
ADD CONSTRAINT "FollowUp_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowUp"
ADD CONSTRAINT "FollowUp_relationshipId_fkey"
FOREIGN KEY ("relationshipId") REFERENCES "ContactRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;