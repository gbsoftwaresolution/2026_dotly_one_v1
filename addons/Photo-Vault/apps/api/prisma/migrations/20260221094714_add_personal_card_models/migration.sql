-- CreateEnum
CREATE TYPE "CardContactGate" AS ENUM ('OPEN', 'REQUEST_REQUIRED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "CardContactRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CardAttachmentKind" AS ENUM ('ALBUM', 'MEDIA', 'LIFE_DOC');

-- DropIndex
DROP INDEX "idx_life_doc_reminder_events_custom";

-- AlterTable
ALTER TABLE "continuity_recipients" ADD COLUMN     "access_code_hash" TEXT;

-- CreateTable
CREATE TABLE "personal_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_modes" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "contact_gate" "CardContactGate" NOT NULL DEFAULT 'REQUEST_REQUIRED',
    "indexing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "theme_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_contact_requests" (
    "id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "status" "CardContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "requester_phone" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_contact_grants" (
    "id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "request_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_contact_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_attachments" (
    "id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "kind" "CardAttachmentKind" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_cards_userId_key" ON "personal_cards"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_cards_public_id_key" ON "personal_cards"("public_id");

-- CreateIndex
CREATE INDEX "personal_cards_public_id_idx" ON "personal_cards"("public_id");

-- CreateIndex
CREATE INDEX "card_modes_card_id_idx" ON "card_modes"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_modes_card_id_slug_key" ON "card_modes"("card_id", "slug");

-- CreateIndex
CREATE INDEX "card_contact_requests_mode_id_createdAt_idx" ON "card_contact_requests"("mode_id", "createdAt");

-- CreateIndex
CREATE INDEX "card_contact_requests_status_idx" ON "card_contact_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "card_contact_grants_request_id_key" ON "card_contact_grants"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_contact_grants_token_hash_key" ON "card_contact_grants"("token_hash");

-- CreateIndex
CREATE INDEX "card_contact_grants_mode_id_expires_at_idx" ON "card_contact_grants"("mode_id", "expires_at");

-- CreateIndex
CREATE INDEX "card_contact_grants_revoked_at_idx" ON "card_contact_grants"("revoked_at");

-- CreateIndex
CREATE INDEX "card_attachments_mode_id_sort_order_idx" ON "card_attachments"("mode_id", "sort_order");

-- CreateIndex
CREATE INDEX "card_attachments_kind_ref_id_idx" ON "card_attachments"("kind", "ref_id");

-- AddForeignKey
ALTER TABLE "personal_cards" ADD CONSTRAINT "personal_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_modes" ADD CONSTRAINT "card_modes_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "personal_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_contact_requests" ADD CONSTRAINT "card_contact_requests_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "card_modes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_contact_grants" ADD CONSTRAINT "card_contact_grants_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "card_modes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_contact_grants" ADD CONSTRAINT "card_contact_grants_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "card_contact_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_attachments" ADD CONSTRAINT "card_attachments_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "card_modes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
