-- Add device management columns to user_sessions table

-- Add deviceName column (nullable)
ALTER TABLE "user_sessions" ADD COLUMN "deviceName" TEXT;

-- Add revokedAt column (nullable)
ALTER TABLE "user_sessions" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- Create composite index for filtering active sessions per user
CREATE INDEX "user_sessions_userId_revokedAt_expiresAt_idx" ON "user_sessions"("userId", "revokedAt", "expiresAt");

-- Create index for ordering by lastSeenAt per user
CREATE INDEX "user_sessions_userId_lastSeenAt_idx" ON "user_sessions"("userId", "lastSeenAt");