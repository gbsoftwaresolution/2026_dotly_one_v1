-- Add CUSTOM option for Life Docs subcategory and store optional free-text label.

-- AlterEnum
ALTER TYPE "LifeDocSubcategory" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "life_docs" ADD COLUMN "custom_subcategory" TEXT;
