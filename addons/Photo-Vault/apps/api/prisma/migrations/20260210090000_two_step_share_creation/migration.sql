-- Two-step share creation: allow creating a share stub before uploading the encrypted bundle.

ALTER TABLE "shared_albums"
  ALTER COLUMN "encryptedAlbumKey" DROP NOT NULL,
  ALTER COLUMN "encryptedMediaKeys" DROP NOT NULL,
  ALTER COLUMN "iv" DROP NOT NULL,
  ALTER COLUMN "kdfParams" DROP NOT NULL;

ALTER TABLE "shared_albums"
  ADD COLUMN "bundleUploadedAt" TIMESTAMP(3);
