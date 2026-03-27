CREATE TYPE "PasskeyChallengePurpose" AS ENUM ('registration', 'authentication');

CREATE TABLE "PasskeyChallenge" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "purpose" "PasskeyChallengePurpose" NOT NULL,
  "challengeHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasskeyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasskeyCredential" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL DEFAULT 'Passkey',
  "credentialId" VARCHAR(512) NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "deviceType" VARCHAR(32) NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),

  CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");
CREATE INDEX "PasskeyChallenge_userId_purpose_consumedAt_supersededAt_expiresAt_idx" ON "PasskeyChallenge"("userId", "purpose", "consumedAt", "supersededAt", "expiresAt");
CREATE INDEX "PasskeyChallenge_purpose_expiresAt_idx" ON "PasskeyChallenge"("purpose", "expiresAt");
CREATE INDEX "PasskeyChallenge_consumedAt_idx" ON "PasskeyChallenge"("consumedAt");
CREATE INDEX "PasskeyChallenge_supersededAt_idx" ON "PasskeyChallenge"("supersededAt");
CREATE INDEX "PasskeyCredential_userId_createdAt_idx" ON "PasskeyCredential"("userId", "createdAt");
CREATE INDEX "PasskeyCredential_userId_lastUsedAt_idx" ON "PasskeyCredential"("userId", "lastUsedAt");

ALTER TABLE "PasskeyChallenge"
ADD CONSTRAINT "PasskeyChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasskeyCredential"
ADD CONSTRAINT "PasskeyCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
