ALTER TABLE "FollowUp"
ADD COLUMN "triggeredAt" TIMESTAMP(3);

CREATE INDEX "FollowUp_ownerUserId_status_triggeredAt_remindAt_idx"
ON "FollowUp"("ownerUserId", "status", "triggeredAt", "remindAt");