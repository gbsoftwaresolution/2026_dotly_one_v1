-- Add full-text search column and indexes for timeline and search performance

-- 1. Add search_tsv generated column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'search_tsv'
    ) THEN
        ALTER TABLE media
        ADD COLUMN search_tsv tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
            setweight(to_tsvector('simple', coalesce(note,'')), 'B') ||
            setweight(to_tsvector('simple', coalesce("locationText",'')), 'B') ||
            setweight(to_tsvector('simple', coalesce("originalFilename",'')), 'C')
        ) STORED;
    END IF;
END $$;

-- 2. Create GIN index for full-text search if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_media_search_tsv ON media USING GIN (search_tsv);

-- 3. Create composite index for timeline queries: user + takenAt/createdAt ordering
-- This index supports queries filtering by userId, isTrashed, and ordering by takenAt/createdAt
CREATE INDEX IF NOT EXISTS idx_media_user_timeline 
ON media ("userId", "isTrashed", COALESCE("takenAt", "createdAt") DESC, "createdAt" DESC, id DESC);

-- 4. Create index for search queries with album filtering
-- This index supports search queries that filter by userId, isTrashed, and optionally albumId via join
CREATE INDEX IF NOT EXISTS idx_media_user_trashed_taken 
ON media ("userId", "isTrashed", "takenAt" DESC NULLS LAST, "createdAt" DESC, id DESC);

-- 5. Create index for album items to speed up album filtering
CREATE INDEX IF NOT EXISTS idx_album_items_user_album_media 
ON album_items ("userId", "albumId", "mediaId");

-- 6. Create index for album name search (used when searching by album name)
CREATE INDEX IF NOT EXISTS idx_albums_user_name_search 
ON albums ("userId", "isDeleted", name);

-- Note: The existing idx_media_user_taken_at and idx_media_user_trashed are kept
-- but we add more specific indexes for the timeline and search use cases.