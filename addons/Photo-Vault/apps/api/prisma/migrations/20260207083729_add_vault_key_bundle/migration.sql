-- Rename user_key_bundles to vault_key_bundles and update schema
-- 1. Rename table
ALTER TABLE "user_key_bundles" RENAME TO "vault_key_bundles";

-- 2. Rename column: bundleCiphertext -> encryptedMasterKey
ALTER TABLE "vault_key_bundles" RENAME COLUMN "bundleCiphertext" TO "encryptedMasterKey";

-- 3. Add iv column (required for AES-GCM)
ALTER TABLE "vault_key_bundles" ADD COLUMN "iv" BYTEA;

-- 4. Update kdfAlgo default from 'argon2id' to 'pbkdf2'
--    For existing rows, we keep whatever they have; new rows default to 'pbkdf2'
ALTER TABLE "vault_key_bundles" ALTER COLUMN "kdfAlgo" SET DEFAULT 'pbkdf2';

-- 5. If any rows have NULL iv, we'll handle it by setting a default (table should be empty)
--    Remove the gen_random_bytes call since pgcrypto might not be enabled
--    For empty table, we can just make iv NOT NULL directly
ALTER TABLE "vault_key_bundles" ALTER COLUMN "iv" SET NOT NULL;

-- Note: recovery_bundles table already exists from previous migrations, so we don't need to create it again.
