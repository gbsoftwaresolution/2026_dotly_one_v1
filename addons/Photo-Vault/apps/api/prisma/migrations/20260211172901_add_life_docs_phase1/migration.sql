-- CreateEnum
CREATE TYPE "LifeDocCategory" AS ENUM ('IDENTITY_LEGAL', 'MEDICAL', 'EDUCATION_CAREER', 'FINANCIAL_ASSET');

-- CreateEnum
CREATE TYPE "LifeDocSubcategory" AS ENUM ('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'VISA', 'RESIDENCY_PERMIT', 'BIRTH_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'DIVORCE_DECREE', 'MEDICAL_REPORTS', 'PRESCRIPTIONS', 'VACCINATION_RECORDS', 'INSURANCE_CARDS', 'DISABILITY_DOCUMENTS', 'DEGREES', 'CERTIFICATES', 'TRANSCRIPTS', 'PROFESSIONAL_LICENSES', 'EMPLOYMENT_CONTRACTS', 'INSURANCE_POLICIES', 'PROPERTY_DEEDS', 'RENTAL_AGREEMENTS', 'LOAN_AGREEMENTS', 'WILLS', 'POWER_OF_ATTORNEY');

-- CreateEnum
CREATE TYPE "LifeDocReminderSetting" AS ENUM ('OFF', 'EXPIRY_DEFAULT', 'EXPIRY_DEFAULT_AND_MONTHLY_POST');

-- CreateEnum
CREATE TYPE "LifeDocVisibility" AS ENUM ('PRIVATE', 'SHARED_WITH_MEMBERS', 'GUARDIAN_ACCESSIBLE');

-- CreateEnum
CREATE TYPE "LifeDocAccessRole" AS ENUM ('VIEWER', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "LifeDocStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'ARCHIVED', 'REPLACED');

-- CreateEnum
CREATE TYPE "LifeDocReminderKind" AS ENUM ('D90', 'D30', 'D7', 'ON_EXPIRY', 'POST_EXPIRY_MONTHLY');

-- CreateEnum
CREATE TYPE "LifeDocAccessGrantKind" AS ENUM ('SHARED', 'GUARDIAN');

-- CreateTable
CREATE TABLE "life_docs" (
    "id" TEXT NOT NULL,
    "vault_object_id" JSONB NOT NULL,
    "owner_id" TEXT NOT NULL,
    "category" "LifeDocCategory" NOT NULL,
    "subcategory" "LifeDocSubcategory" NOT NULL,
    "title" TEXT NOT NULL,
    "issuing_authority" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "renewal_required" BOOLEAN NOT NULL DEFAULT false,
    "reminder_setting" "LifeDocReminderSetting" NOT NULL DEFAULT 'EXPIRY_DEFAULT',
    "visibility" "LifeDocVisibility" NOT NULL DEFAULT 'PRIVATE',
    "access_roles" JSONB NOT NULL DEFAULT '{}',
    "status" "LifeDocStatus" NOT NULL DEFAULT 'ACTIVE',
    "version_group_id" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "upload_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_doc_access_grants" (
    "lifeDocId" TEXT NOT NULL,
    "kind" "LifeDocAccessGrantKind" NOT NULL,
    "grantee_hash" TEXT NOT NULL,
    "role" "LifeDocAccessRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "life_doc_access_grants_pkey" PRIMARY KEY ("lifeDocId","kind","grantee_hash")
);

-- CreateTable
CREATE TABLE "life_doc_reminders_sent" (
    "id" TEXT NOT NULL,
    "life_doc_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "kind" "LifeDocReminderKind" NOT NULL,
    "scheduled_for" TEXT NOT NULL,
    "notification_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "life_doc_reminders_sent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "life_docs_owner_id_created_at_idx" ON "life_docs"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "life_docs_owner_id_category_idx" ON "life_docs"("owner_id", "category");

-- CreateIndex
CREATE INDEX "life_docs_expiry_date_idx" ON "life_docs"("expiry_date");

-- CreateIndex
CREATE INDEX "life_docs_version_group_id_upload_timestamp_idx" ON "life_docs"("version_group_id", "upload_timestamp");

-- CreateIndex
CREATE INDEX "life_doc_access_grants_grantee_hash_idx" ON "life_doc_access_grants"("grantee_hash");

-- CreateIndex
CREATE INDEX "life_doc_reminders_sent_recipient_user_id_created_at_idx" ON "life_doc_reminders_sent"("recipient_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "life_doc_reminders_sent_life_doc_id_recipient_user_id_kind__key" ON "life_doc_reminders_sent"("life_doc_id", "recipient_user_id", "kind", "scheduled_for");

-- CreateIndex
CREATE INDEX "notification_events_user_id_created_at_idx" ON "notification_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "life_docs" ADD CONSTRAINT "life_docs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_doc_access_grants" ADD CONSTRAINT "life_doc_access_grants_lifeDocId_fkey" FOREIGN KEY ("lifeDocId") REFERENCES "life_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_doc_reminders_sent" ADD CONSTRAINT "life_doc_reminders_sent_life_doc_id_fkey" FOREIGN KEY ("life_doc_id") REFERENCES "life_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
