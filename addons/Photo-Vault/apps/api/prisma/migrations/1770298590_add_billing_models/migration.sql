-- Add billing models: CryptoInvoice and StripeEvent

-- Create enum for crypto invoice status
CREATE TYPE "CryptoInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELED');

-- Create CryptoInvoice table
CREATE TABLE "crypto_invoices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_code" "PlanCode" NOT NULL,
    "base_amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_address" TEXT NOT NULL,
    "status" "CryptoInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_invoices_pkey" PRIMARY KEY ("id")
);

-- Create StripeEvent table for idempotency
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- Create index for CryptoInvoice: user + status + expiresAt
CREATE INDEX "crypto_invoices_user_id_status_expires_at_idx" ON "crypto_invoices"("user_id", "status", "expires_at");

-- Create unique index for StripeEvent event_id for idempotency
CREATE UNIQUE INDEX "stripe_events_event_id_key" ON "stripe_events"("event_id");

-- Add foreign key constraint for CryptoInvoice -> User
ALTER TABLE "crypto_invoices" ADD CONSTRAINT "crypto_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;