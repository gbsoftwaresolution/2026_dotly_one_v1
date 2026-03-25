-- Share analytics: track successful client-side views (best-effort).

ALTER TABLE "shared_albums"
  ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastViewedAt" TIMESTAMP(3);

CREATE INDEX "shared_albums_lastViewedAt_idx" ON "shared_albums"("lastViewedAt");
