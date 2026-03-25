-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "kind" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("kind","instanceId")
);

-- CreateIndex
CREATE INDEX "worker_heartbeats_kind_lastSeenAt_idx" ON "worker_heartbeats"("kind", "lastSeenAt");
