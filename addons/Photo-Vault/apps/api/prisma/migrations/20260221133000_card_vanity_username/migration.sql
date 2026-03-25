/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `personal_cards` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "personal_cards" ADD COLUMN     "username" TEXT,
ADD COLUMN     "username_updated_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "personal_cards_username_key" ON "personal_cards"("username");
