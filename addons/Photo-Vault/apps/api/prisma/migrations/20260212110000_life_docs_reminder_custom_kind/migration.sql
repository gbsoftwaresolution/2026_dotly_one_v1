-- Phase 2 follow-up: support custom reminder offsets (metadata-only)

-- 1) Extend enum for reminder kind.
ALTER TYPE "LifeDocReminderKind" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- 2) Add optional days_before_expiry field to reminder events.
ALTER TABLE "life_doc_reminder_events"
  ADD COLUMN IF NOT EXISTS "days_before_expiry" INTEGER;

-- 3) Helpful index for querying custom offsets.
CREATE INDEX IF NOT EXISTS "idx_life_doc_reminder_events_custom"
  ON "life_doc_reminder_events" ("life_doc_id", "kind", "days_before_expiry");
