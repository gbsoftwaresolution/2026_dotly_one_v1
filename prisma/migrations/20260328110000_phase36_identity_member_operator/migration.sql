CREATE TYPE "IdentityMemberRole" AS ENUM ('MEMBER', 'MANAGER', 'OWNER');
CREATE TYPE "IdentityMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

CREATE TABLE "IdentityMember" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "role" "IdentityMemberRole" NOT NULL,
  "status" "IdentityMemberStatus" NOT NULL DEFAULT 'INVITED',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "IdentityMember_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IdentityMember_identityId_personId_key" ON "IdentityMember"("identityId", "personId");
CREATE INDEX "IdentityMember_identityId_idx" ON "IdentityMember"("identityId");
CREATE INDEX "IdentityMember_personId_idx" ON "IdentityMember"("personId");
CREATE INDEX "IdentityMember_status_idx" ON "IdentityMember"("status");

CREATE TYPE "IdentityOperatorRole" AS ENUM ('OPERATOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "IdentityOperatorStatus" AS ENUM ('ACTIVE', 'INVITED', 'REVOKED');

CREATE TABLE "IdentityOperator" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "role" "IdentityOperatorRole" NOT NULL,
  "status" "IdentityOperatorStatus" NOT NULL DEFAULT 'INVITED',
  "permissionsJson" JSONB,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "IdentityOperator_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IdentityOperator_identityId_personId_key" ON "IdentityOperator"("identityId", "personId");
CREATE INDEX "IdentityOperator_identityId_idx" ON "IdentityOperator"("identityId");
CREATE INDEX "IdentityOperator_personId_idx" ON "IdentityOperator"("personId");
CREATE INDEX "IdentityOperator_status_idx" ON "IdentityOperator"("status");
