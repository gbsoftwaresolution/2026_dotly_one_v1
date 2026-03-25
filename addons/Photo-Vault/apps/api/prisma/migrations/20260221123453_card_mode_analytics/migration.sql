-- CreateTable
CREATE TABLE "card_mode_analytics" (
    "mode_id" TEXT NOT NULL,
    "views_total" BIGINT NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "contact_requests_total" BIGINT NOT NULL DEFAULT 0,
    "approvals_total" BIGINT NOT NULL DEFAULT 0,
    "denials_total" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_mode_analytics_pkey" PRIMARY KEY ("mode_id")
);

-- AddForeignKey
ALTER TABLE "card_mode_analytics" ADD CONSTRAINT "card_mode_analytics_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "card_modes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
