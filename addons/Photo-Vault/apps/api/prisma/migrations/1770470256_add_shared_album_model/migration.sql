-- CreateTable
CREATE TABLE "shared_albums" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "encryptedAlbumKey" BYTEA NOT NULL,
    "encryptedMediaKeys" JSONB NOT NULL,
    "iv" BYTEA NOT NULL,
    "kdfAlgo" TEXT NOT NULL DEFAULT 'pbkdf2',
    "kdfParams" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_albums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_albums_albumId_ownerUserId_key" ON "shared_albums"("albumId", "ownerUserId");

-- CreateIndex
CREATE INDEX "shared_albums_albumId_idx" ON "shared_albums"("albumId");

-- CreateIndex
CREATE INDEX "shared_albums_ownerUserId_idx" ON "shared_albums"("ownerUserId");

-- CreateIndex
CREATE INDEX "shared_albums_expiresAt_idx" ON "shared_albums"("expiresAt");

-- CreateIndex
CREATE INDEX "shared_albums_revokedAt_idx" ON "shared_albums"("revokedAt");

-- AddForeignKey
ALTER TABLE "shared_albums" ADD CONSTRAINT "shared_albums_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_albums" ADD CONSTRAINT "shared_albums_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;