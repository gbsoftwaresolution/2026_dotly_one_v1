-- CreateEnum
CREATE TYPE "ContinuityPackStatus" AS ENUM ('DRAFT', 'ARMED', 'RELEASED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContinuityRecipientRole" AS ENUM ('HEIR_VIEWER', 'TRUSTEE_MANAGER');

-- CreateEnum
CREATE TYPE "ReleasePolicyType" AS ENUM ('INACTIVITY', 'MANUAL_EMERGENCY', 'MULTI_PARTY_ATTESTATION');

-- CreateEnum
CREATE TYPE "ReleaseInstanceStatus" AS ENUM ('RELEASED', 'REVOKED', 'EXPIRED');

-- DropIndex
DROP INDEX IF EXISTS "idx_life_doc_reminder_events_custom";

-- CreateTable
CREATE TABLE "continuity_packs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContinuityPackStatus" NOT NULL DEFAULT 'DRAFT',
    "release_policy_id" TEXT NOT NULL,
    "reveal_category" BOOLEAN NOT NULL DEFAULT false,
    "reveal_expiry" BOOLEAN NOT NULL DEFAULT false,
    "reveal_issuer" BOOLEAN NOT NULL DEFAULT false,
    "force_masked_mode" BOOLEAN NOT NULL DEFAULT true,
    "release_expiry_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuity_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuity_pack_items" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "life_doc_id" TEXT,
    "version_group_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "continuity_pack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_policies" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "type" "ReleasePolicyType" NOT NULL,
    "parameters" JSONB NOT NULL,
    "cooldown_period" INTEGER NOT NULL DEFAULT 0,
    "grace_period" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuity_recipients" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuity_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuity_pack_recipients" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "role" "ContinuityRecipientRole" NOT NULL DEFAULT 'HEIR_VIEWER',

    CONSTRAINT "continuity_pack_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_instances" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "scope_snapshot" JSONB NOT NULL,
    "status" "ReleaseInstanceStatus" NOT NULL DEFAULT 'RELEASED',
    "key" TEXT,

    CONSTRAINT "release_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "continuity_packs_owner_id_idx" ON "continuity_packs"("owner_id");

-- CreateIndex
CREATE INDEX "continuity_pack_items_pack_id_idx" ON "continuity_pack_items"("pack_id");

-- CreateIndex
CREATE INDEX "release_policies_owner_id_idx" ON "release_policies"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "continuity_recipients_owner_id_email_key" ON "continuity_recipients"("owner_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "continuity_pack_recipients_pack_id_recipient_id_key" ON "continuity_pack_recipients"("pack_id", "recipient_id");

-- CreateIndex
CREATE INDEX "release_instances_recipient_id_idx" ON "release_instances"("recipient_id");

-- CreateIndex
CREATE INDEX "release_instances_pack_id_idx" ON "release_instances"("pack_id");

-- AddForeignKey
ALTER TABLE "continuity_packs" ADD CONSTRAINT "continuity_packs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_packs" ADD CONSTRAINT "continuity_packs_release_policy_id_fkey" FOREIGN KEY ("release_policy_id") REFERENCES "release_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_pack_items" ADD CONSTRAINT "continuity_pack_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "continuity_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_pack_items" ADD CONSTRAINT "continuity_pack_items_life_doc_id_fkey" FOREIGN KEY ("life_doc_id") REFERENCES "life_docs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_policies" ADD CONSTRAINT "release_policies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_recipients" ADD CONSTRAINT "continuity_recipients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_pack_recipients" ADD CONSTRAINT "continuity_pack_recipients_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "continuity_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_pack_recipients" ADD CONSTRAINT "continuity_pack_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "continuity_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_instances" ADD CONSTRAINT "release_instances_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "continuity_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_instances" ADD CONSTRAINT "release_instances_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "continuity_recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
