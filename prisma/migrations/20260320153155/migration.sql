-- AlterTable
ALTER TABLE "Block" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContactMemory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContactRelationship" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContactRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Persona" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QRAccessToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "ContactRelationship_ownerUserId_targetUserId_ownerPersonaId_tar" RENAME TO "ContactRelationship_ownerUserId_targetUserId_ownerPersonaId_key";
