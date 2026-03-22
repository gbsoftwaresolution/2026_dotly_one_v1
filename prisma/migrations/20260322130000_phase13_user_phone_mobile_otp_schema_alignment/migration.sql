-- CreateEnum
CREATE TYPE "MobileOtpPurpose" AS ENUM ('enrollment');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "pendingPhoneNumber" VARCHAR(32),
ADD COLUMN "phoneNumber" VARCHAR(32),
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileOtpChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phoneNumber" VARCHAR(32) NOT NULL,
    "purpose" "MobileOtpPurpose" NOT NULL DEFAULT 'enrollment',
    "codeHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "invalidAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_consumedAt_supersededAt_expiresAt_idx" ON "PasswordResetToken"("userId", "consumedAt", "supersededAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_consumedAt_idx" ON "PasswordResetToken"("consumedAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_supersededAt_idx" ON "PasswordResetToken"("supersededAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_userId_createdAt_idx" ON "MobileOtpChallenge"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_userId_expiresAt_idx" ON "MobileOtpChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_userId_phoneNumber_createdAt_idx" ON "MobileOtpChallenge"("userId", "phoneNumber", "createdAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_userId_purpose_consumedAt_supersededAt_e_idx" ON "MobileOtpChallenge"("userId", "purpose", "consumedAt", "supersededAt", "expiresAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_consumedAt_idx" ON "MobileOtpChallenge"("consumedAt");

-- CreateIndex
CREATE INDEX "MobileOtpChallenge_supersededAt_idx" ON "MobileOtpChallenge"("supersededAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- AddForeignKey
ALTER TABLE "PasswordResetToken"
ADD CONSTRAINT "PasswordResetToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileOtpChallenge"
ADD CONSTRAINT "MobileOtpChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "EmailVerificationToken_userId_consumedAt_supersededAt_expiresAt" RENAME TO "EmailVerificationToken_userId_consumedAt_supersededAt_expir_idx";