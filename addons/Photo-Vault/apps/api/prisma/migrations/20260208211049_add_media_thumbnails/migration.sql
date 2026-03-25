-- AlterTable
ALTER TABLE "media" ADD COLUMN     "thumbByteSize" BIGINT,
ADD COLUMN     "thumbContentType" TEXT,
ADD COLUMN     "thumbEncMeta" JSONB,
ADD COLUMN     "thumbObjectKey" TEXT,
ADD COLUMN     "thumbUploadedAt" TIMESTAMP(3);
