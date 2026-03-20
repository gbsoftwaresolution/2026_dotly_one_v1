-- Phase 4 expands contact notes capacity for the contacts backend.

-- AlterTable
ALTER TABLE "ContactMemory"
ALTER COLUMN "note" TYPE TEXT;
