ALTER TABLE "ContactRelationship"
ADD CONSTRAINT "ContactRelationship_id_ownerUserId_key"
UNIQUE ("id", "ownerUserId");

ALTER TABLE "FollowUp"
DROP CONSTRAINT "FollowUp_relationshipId_fkey";

ALTER TABLE "FollowUp"
ADD CONSTRAINT "FollowUp_relationshipId_ownerUserId_fkey"
FOREIGN KEY ("relationshipId", "ownerUserId")
REFERENCES "ContactRelationship"("id", "ownerUserId")
ON DELETE CASCADE
ON UPDATE CASCADE;