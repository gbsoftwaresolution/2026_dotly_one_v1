# Phase 4.3: Read-only Album Sharing via Secure Links - Implementation Summary

## Overview
Completed end-to-end implementation of read-only album sharing with zero-knowledge encryption. Share owners can generate secure links with passphrases, and viewers can access albums without authentication using the passphrase.

## Core Principles Maintained
- **Zero-knowledge preserved**: Server stores only ciphertext bundle, never sees passphrase or decrypted keys
- **Read-only access**: Viewers cannot download, edit, or reshare media
- **End-to-end encryption**: All cryptographic operations performed client-side
- **Server minimal trust**: Server validates share status but never validates passphrase

## Architecture

### Backend (NestJS API)
**Existing Endpoints Enhanced:**
- `POST /v1/share/albums/:albumId` - Create share with encrypted bundle
- `GET /v1/share/:shareId` - Get share metadata (public)
- `POST /v1/share/:shareId/unlock` - Return encrypted bundle (public)
- `POST /v1/share/:shareId/revoke` - Revoke share (owner only)
- `GET /v1/share/albums/active` - List user's active shares

**Database Schema:**
- `SharedAlbum` model stores encrypted bundle:
  - `encryptedAlbumKey` (Bytes) - Album share key wrapped with passphrase-derived KEK
  - `encryptedMediaKeys` (JSON) - Array of media keys wrapped with album share key
  - `iv` (Bytes) - Initialization vector
  - `kdfParams` (JSON) - PBKDF2 parameters for passphrase derivation
  - `expiresAt` (DateTime) - Share expiration
  - `revokedAt` (DateTime) - Optional revocation timestamp

### Frontend (React)
**New Components:**
1. `ShareAlbumModal.tsx` - Owner flow for creating shares
   - Vault unlock check
   - Passphrase generation
   - Media key re-wrapping
   - Bundle upload

2. `PublicSharedAlbumPage.tsx` - Viewer flow for accessing shared albums
   - Public route `/shared/:shareId`
   - Passphrase entry
   - Client-side decryption
   - Read-only media viewer

3. Enhanced `MediaViewer.tsx` - Added `disableDownload` and `disableTrash` props for shared view

**Crypto Utilities (`src/crypto/sharing.ts`):**
- `generatePassphrase()` - 4-word human-readable passphrase
- `deriveShareKek()` - PBKDF2-based key derivation
- `wrapAlbumShareKey()/unwrapAlbumShareKey()` - AES-GCM key wrapping
- `wrapMediaKeyWithAlbumKey()/unwrapMediaKeyWithAlbumKey()` - Media key re-wrapping
- `prepareShareBundle()` - Bundle preparation for upload
- `unlockShareBundle()` - Client-side unlock flow

**Routing:**
- Added public route `/shared/:shareId` to `router.tsx`

**UI Integration:**
- Added "Share" button to `AlbumDetail.tsx`
- Modal guides user through share creation process

## Cryptographic Flow

### Owner Share Creation:
1. Vault unlocked (required for accessing media keys)
2. Generate random passphrase (client-side)
3. Generate random album share key (256-bit AES-GCM)
4. Derive KEK from passphrase using PBKDF2
5. Wrap album share key with KEK
6. For each media in album:
   - Unwrap media key from vault master key
   - Rewrap with album share key
7. Upload bundle (encryptedAlbumKey, encryptedMediaKeys, iv, kdfParams)

### Viewer Access:
1. GET `/v1/share/:shareId` - Verify share active, not expired/revoked
2. Enter passphrase (client-side)
3. POST `/v1/share/:shareId/unlock` - Retrieve encrypted bundle
4. Derive KEK from passphrase using stored kdfParams
5. Unwrap album share key
6. Unwrap media keys with album share key
7. Request share-scoped media download URLs (`/v1/share/:shareId/media/:mediaId/download-url` with `X-Share-Token`)
8. Fetch, decrypt, and display media (read-only)

## Files Modified/Added

### Backend (`apps/api/`)
- `src/sharing/sharing.controller.ts` - Updated imports (removed unused BadRequestException)
- `src/sharing/sharing.service.ts` - Complete implementation
- `prisma/migrations/1770470256_add_shared_album_model/migration.sql` - Database schema

### Frontend (`apps/web/`)
- `src/app/router.tsx` - Added `/shared/:shareId` route
- `src/pages/AlbumDetail.tsx` - Added ShareAlbumModal integration
- `src/components/ShareAlbumModal.tsx` - New component
- `src/components/MediaViewer.tsx` - Enhanced with disableDownload/disableTrash
- `src/pages/PublicSharedAlbumPage.tsx` - New component
- `src/crypto/sharing.ts` - New crypto utilities
- `src/api/sharing.ts` - API client methods

### Shared Package (`packages/shared/`)
- `src/sharing/sharing.types.ts` - Type definitions
- `src/sharing/dto/create-share-request.dto.ts` - DTO for share creation
- `src/sharing/dto/upload-share-bundle.dto.ts` - DTO for bundle upload
- `src/sharing/dto/share-access-token.dto.ts` - DTO for access token

## Manual Test Checklist

### Owner Flow:
- [ ] Create album with 3+ media items
- [ ] Navigate to album detail
- [ ] Click "Share" button
- [ ] Review warning, set expiration
- [ ] Generate passphrase (save it)
- [ ] Create share link
- [ ] Verify link and passphrase displayed
- [ ] Copy both to secure location

### Viewer Flow (Incognito):
- [ ] Open shared link `/shared/:shareId`
- [ ] See album metadata (name, description, expiration)
- [ ] Enter correct passphrase
- [ ] See media grid
- [ ] Click photo - opens in read-only viewer
- [ ] Verify no download/trash buttons
- [ ] Try right-click save - should be disabled

### Security Tests:
- [ ] Wrong passphrase - should fail with error
- [ ] Expired share - should show "expired" message
- [ ] Revoked share - should show "revoked" message
- [ ] Vault locked during share creation - should prompt unlock
- [ ] Network inspection - verify passphrase never sent (only to /unlock)

### Edge Cases:
- [ ] Empty album - share creation should fail
- [ ] Album with trashed media - should exclude or handle gracefully
- [ ] Multiple shares for same album - should be prevented
- [ ] Very long album name/description - should display properly

## Known Limitations

- Public shared album viewer is read-only; downloading/editing/sharing are intentionally disabled in the UI.
- Very large shared albums may still take time to fully prepare keys; the viewer uses lazy + batched key preparation to stay responsive.

## Completed (Former TODOs)

- Two-step share creation (create stub → upload bundle)
- Public shared album metadata hydration
- Large-album performance improvements (lazy/batched key unwrapping + progress UI)
- Share management UI + share usage analytics

## Build Status
- ✅ API builds successfully
- ✅ Web frontend builds successfully
- ✅ Shared package builds successfully

## Next Steps (Optional)
1. If desired, add an explicit “Download” action to the public shared viewer UI (endpoint already exists).

## Security Notes
- Passphrase never stored server-side
- Server cannot validate passphrase (zero-knowledge)
- All encryption uses WebCrypto API (browser-native)
- PBKDF2 iterations: 200,000 (configurable)
- AES-GCM with 256-bit keys for all wrapping operations
- Random IVs for each encryption operation