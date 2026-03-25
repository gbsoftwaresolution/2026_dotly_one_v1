-- db/schema.sql
-- Booster Vault (Non-AI MVP) – Data Model (Postgres)
-- Notes:
-- 1) Media blobs are encrypted client-side; server stores only encrypted bytes + metadata.
-- 2) Server NEVER stores user decryption keys. It may store an *encrypted key bundle* (optional) for user convenience.
-- 3) Search is non-AI: Postgres full-text on title/note/location/album name.

-- =========================
-- Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email

-- =========================
-- Enums
-- =========================
DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('PHOTO', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE export_status AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_code AS ENUM ('P6M_25', 'Y1_100', 'Y1_199', 'Y5_500');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- Core: users
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,

  display_name      TEXT,
  locale            TEXT NOT NULL DEFAULT 'en', -- future: 'ar-QA' etc.
  timezone          TEXT NOT NULL DEFAULT 'Asia/Kolkata',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- =========================
-- Auth sessions (optional; JWT-only is also OK)
-- =========================
CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent      TEXT,
  ip_address      INET,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);

-- =========================
-- Optional: encrypted key bundle (server stores only ciphertext)
-- Use this ONLY if you want cross-device convenience without compromising zero-knowledge:
-- - Client encrypts the "Vault Master Key" with a key derived from user's password (or recovery phrase)
-- - Server stores ciphertext + KDF params for client to decrypt later
-- =========================
CREATE TABLE IF NOT EXISTS user_key_bundles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bundle_ciphertext BYTEA NOT NULL,
  kdf_algo          TEXT NOT NULL DEFAULT 'argon2id',
  kdf_params        JSONB NOT NULL,  -- e.g. { "memory_kib": 65536, "iterations": 3, "parallelism": 1, "salt_b64": "..." }
  bundle_version    INT NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Billing: subscriptions (Stripe)
-- =========================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  status                 subscription_status NOT NULL DEFAULT 'TRIAL',
  plan                   plan_code NOT NULL DEFAULT 'P6M_25',

  -- Trial control: stop uploads after whichever comes first:
  trial_started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at          TIMESTAMPTZ, -- set when trial starts (now + 14 days)
  trial_media_limit      INT NOT NULL DEFAULT 50,

  -- Stripe mapping
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);

-- =========================
-- Usage counters (fast plan enforcement; avoid counting large tables repeatedly)
-- Keep this updated transactionally when media is created/deleted/restored.
-- =========================
CREATE TABLE IF NOT EXISTS user_usage (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  total_media_count    BIGINT NOT NULL DEFAULT 0,
  total_photo_count    BIGINT NOT NULL DEFAULT 0,
  total_video_count    BIGINT NOT NULL DEFAULT 0,

  trashed_media_count  BIGINT NOT NULL DEFAULT 0,

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- Albums
-- =========================
CREATE TABLE IF NOT EXISTS albums (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name        TEXT NOT NULL,
  description TEXT,

  cover_media_id UUID, -- nullable; validated in app-layer (must belong to same user)
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_albums_user_active ON albums(user_id, is_deleted);

-- =========================
-- Media (encrypted blobs + human metadata)
-- =========================
CREATE TABLE IF NOT EXISTS media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type          media_type NOT NULL,
  -- Object storage pointer
  object_key    TEXT NOT NULL UNIQUE,     -- e.g. "u/<userId>/m/<mediaId>.bin"
  byte_size     BIGINT NOT NULL,
  content_type  TEXT NOT NULL,            -- e.g. image/jpeg, video/mp4

  -- Client-side encryption metadata (server stores only what client sends; no secrets)
  enc_algo      TEXT NOT NULL DEFAULT 'xchacha20poly1305',
  enc_meta      JSONB NOT NULL,           -- e.g. { "nonce_b64": "...", "salt_b64": "...", "chunk_size": 524288, "version": 1 }

  -- Original filename (non-sensitive)
  original_filename TEXT,
  sha256_ciphertext BYTEA,                -- optional integrity for ciphertext

  -- EXIF-derived fields (optional; extracted on client, sent as metadata)
  exif_taken_at  TIMESTAMPTZ,
  exif_lat       DOUBLE PRECISION,
  exif_lng       DOUBLE PRECISION,

  -- User-facing editable fields
  title          TEXT,
  note           TEXT,
  taken_at       TIMESTAMPTZ,             -- user-editable "memory date"; defaults to exif_taken_at or upload time
  location_text  TEXT,                    -- user-editable, non-AI

  -- Trash
  is_trashed     BOOLEAN NOT NULL DEFAULT FALSE,
  trashed_at     TIMESTAMPTZ,
  purge_after    TIMESTAMPTZ,             -- set = trashed_at + interval '30 days'

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_user_taken_at ON media(user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_user_trashed ON media(user_id, is_trashed, purge_after);

-- Full-text search (non-AI)
-- We keep a generated tsvector over title/note/location_text/original_filename for fast search.
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(note,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(location_text,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(original_filename,'')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_media_search_tsv ON media USING GIN (search_tsv);

-- =========================
-- Album items (ordering)
-- Supports: a media item can be in multiple albums
-- =========================
CREATE TABLE IF NOT EXISTS album_items (
  album_id     UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  media_id     UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- denormalized for quick enforcement

  position     BIGINT NOT NULL,   -- for manual ordering; app assigns increasing values
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (album_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_album_items_album_pos ON album_items(album_id, position);
CREATE INDEX IF NOT EXISTS idx_album_items_user_id ON album_items(user_id);

-- =========================
-- Exports
-- =========================
CREATE TABLE IF NOT EXISTS exports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Scope definition:
  scope_type    TEXT NOT NULL,    -- 'VAULT' | 'ALBUM' | 'DATE_RANGE'
  scope_album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
  scope_from    TIMESTAMPTZ,
  scope_to      TIMESTAMPTZ,

  status        export_status NOT NULL DEFAULT 'QUEUED',
  error_message TEXT,

  -- Output object (ZIP), encrypted at rest server-side; optionally client-encrypted later
  output_object_key TEXT,
  output_byte_size  BIGINT,
  ready_at       TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,     -- expiring download link cutoff

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exports_user_created ON exports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);

-- =========================
-- Lightweight audit trail (optional but useful)
-- =========================
CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,  -- 'MEDIA_UPLOADED', 'MEDIA_TRASHED', 'MEDIA_RESTORED', 'EXPORT_CREATED', etc.
  entity_type TEXT,
  entity_id   UUID,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_events(user_id, created_at DESC);
