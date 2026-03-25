-- AlterTable
ALTER TABLE "vault_key_bundles" RENAME CONSTRAINT "user_key_bundles_pkey" TO "vault_key_bundles_pkey";

-- CreateTable
CREATE TABLE "recovery_bundles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedMasterKey" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "kdfParams" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_access_tokens" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_bundles_userId_key" ON "recovery_bundles"("userId");

-- CreateIndex
CREATE INDEX "recovery_bundles_userId_idx" ON "recovery_bundles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "share_access_tokens_tokenHash_key" ON "share_access_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "share_access_tokens_shareId_expiresAt_idx" ON "share_access_tokens"("shareId", "expiresAt");

-- CreateIndex
CREATE INDEX "share_access_tokens_tokenHash_idx" ON "share_access_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "share_access_tokens_revokedAt_idx" ON "share_access_tokens"("revokedAt");

-- RenameForeignKey
ALTER TABLE "vault_key_bundles" RENAME CONSTRAINT "user_key_bundles_userId_fkey" TO "vault_key_bundles_userId_fkey";

-- AddForeignKey
ALTER TABLE "recovery_bundles" ADD CONSTRAINT "recovery_bundles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_access_tokens" ADD CONSTRAINT "share_access_tokens_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "shared_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
