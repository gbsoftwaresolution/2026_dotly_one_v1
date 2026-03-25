-- Booster Life Docs (Phase 2): metadata-only usefulness upgrades.
-- Adds renewal workflow state, reminder controls (custom schedule + quiet hours), masked mode,
-- and a reminder events table for idempotency + quiet-hours deferral.

-- CreateEnum
CREATE TYPE "LifeDocRenewalState" AS ENUM ('NOT_REQUIRED', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- AlterTable
ALTER TABLE "life_docs"
  ADD COLUMN "renewal_state" "LifeDocRenewalState" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "reminder_custom_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "quiet_hours_start" TEXT,
  ADD COLUMN "quiet_hours_end" TEXT,
  ADD COLUMN "notify_shared_members" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_reminded_at" TIMESTAMP(3),
  ADD COLUMN "masked_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "masked_hide_expiry" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "alias_title" TEXT;

-- CreateTable
CREATE TABLE "life_doc_reminder_events" (
  "reminder_event_id" TEXT NOT NULL,
  "life_doc_id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "kind" "LifeDocReminderKind" NOT NULL,
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  "sent_at" TIMESTAMP(3),
  "channel" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "life_doc_reminder_events_pkey" PRIMARY KEY ("reminder_event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "life_doc_reminder_events_dedupe_key_key" ON "life_doc_reminder_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "life_doc_reminder_events_life_doc_id_scheduled_for_idx" ON "life_doc_reminder_events"("life_doc_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "life_doc_reminder_events_recipient_user_id_scheduled_for_idx" ON "life_doc_reminder_events"("recipient_user_id", "scheduled_for");

-- AddForeignKey
ALTER TABLE "life_doc_reminder_events" ADD CONSTRAINT "life_doc_reminder_events_life_doc_id_fkey" FOREIGN KEY ("life_doc_id") REFERENCES "life_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
