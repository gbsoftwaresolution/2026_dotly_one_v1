# System Patterns

## System Architecture
### High-Level Components
1. **Client Application** (web/mobile)
   - Handles media encryption/decryption
   - Manages user interface and interactions
   - Communicates with API via REST

2. **API Server** (Backend)
   - RESTful API defined in OpenAPI specification
   - Handles authentication, authorization, business logic
   - Manages database operations
   - Integrates with object storage and Stripe

3. **Database** (PostgreSQL)
   - Stores user accounts, metadata, relationships
   - Maintains usage counters, subscriptions, albums
   - Full-text search capabilities via tsvector

4. **Object Storage** (e.g., S3, GCS, MinIO)
   - Stores encrypted media blobs
   - Provides signed URLs for direct upload/download

5. **Stripe** (Payment Processing)
   - Handles subscription payments
   - Webhooks for payment events

## Key Technical Decisions
### Zero-Knowledge Architecture
- **Client-side encryption**: All media encrypted before upload using Web Crypto **AES-256-GCM**
- **Large file mode**: Optional chunked AES-256-GCM scheme (per-chunk tags) to support multipart/ranged downloads
- **Server-blind**: Server never receives decryption keys
- **Encrypted key bundle**: Optional feature for cross-device sync; key bundle encrypted with user's password-derived key

### Data Model Patterns
- **Soft deletion**: Media and albums use `is_trashed`/`is_deleted` flags with purge timelines
- **Denormalized counters**: `user_usage` table maintains aggregated counts for performance
- **Position-based ordering**: Album items use `position` column for manual ordering
- **Full-text search**: PostgreSQL tsvector on title, note, location, filename

### API Design Patterns
- **RESTful conventions**: Resources map to entities (users, media, albums, exports)
- **Signed URLs**: Direct object storage upload/download to avoid bandwidth bottlenecks
- **Pagination cursor-based**: All list endpoints use cursor pagination for consistency
- **Error standardization**: Consistent error response format across all endpoints

### Security Patterns
- **JWT authentication**: Bearer tokens for API access
- **Refresh token rotation**: Optional session management
- **Plan enforcement**: Server-side validation of trial limits and subscription status
- **Input validation**: Comprehensive validation at API boundaries

## Component Relationships
### Core Entities
```
User → has many → Media
User → has many → Albums  
User → has one → Subscription
User → has one → Usage counters
Album → has many → Media (through AlbumItems)
Media → can belong to many → Albums
User → has many → Exports
```

### Data Flow: Upload Process
1. Client encrypts file → ciphertext bytes
2. POST `/v1/media/upload-intents` with metadata + encryption metadata
3. Server validates plan limits, creates media record, returns signed PUT URL
4. Client uploads ciphertext directly to object storage via signed URL
5. POST `/v1/media/{id}/complete-upload` to finalize
6. Server updates usage counters

### Data Flow: Download Process
1. POST `/v1/media/{id}/download-url` to get signed GET URL
2. Client downloads ciphertext from object storage
3. Client decrypts locally using stored keys

## Critical Implementation Paths
### 1. Authentication & Authorization
- JWT verification middleware
- User context injection into request handlers
- Permission checks (user owns resource)

### 1.1 Vault master key (“VaultKeyBundle”) bootstrapping
- Random vault master key generated once per user (not derived from password)
- Password-derived KEK (PBKDF2) only wraps/unwraps the vault master key
- Password change re-wraps the same vault master key (does not re-encrypt media)
- Client stores per-media wrapped keys in IndexedDB

### 2. Plan Enforcement
- Check subscription status on upload intent creation
- Validate trial period and media count limits
- Block uploads when limits exceeded (viewing still allowed)

### 3. Media Lifecycle Management
- Upload → Library → Trash (30-day grace) → Permanent deletion
- Restore from trash functionality
- Purge scheduling for expired trash items

### 4. Album Management
- Create/update/delete (soft) albums
- Add/remove/reorder media items
- Cover image selection

### 4.1 Read-only sharing model
- Album shares are public links that require passphrase unlock
- Passphrase is never sent to server; it’s used client-side to decrypt a bundle
- Public endpoints use a short-lived **share access token** (`X-Share-Token`) for share-scoped operations

### 5. Export System
- Create export job with scope definition
- Background processing to collect media, create ZIP
- Signed URL for download with expiration
- Cleanup of expired exports

### 5.1 Encrypted thumbnails (thumbnail-first UX)
- Client generates image/video thumbnails, encrypts them with the per-media key, uploads alongside the main ciphertext
- UI prefers `variant=thumb` when `thumbUploadedAt` exists; full-res only loaded when viewing

### 6. Billing Integration
- Stripe checkout session creation
- Webhook handling for subscription events
- Sync subscription status to local database

## Database Schema Patterns
### Extension Usage
- `pgcrypto` for UUID generation
- `citext` for case-insensitive email

### Enum Types
- `media_type`: PHOTO, VIDEO
- `export_status`: QUEUED, RUNNING, READY, FAILED, EXPIRED
- `subscription_status`: TRIAL, ACTIVE, PAST_DUE, CANCELED, EXPIRED
- `plan_code`: P6M_25, Y1_100, Y1_199, Y5_500

### Index Strategy
- Foreign key indexes for joins
- Composite indexes for common query patterns (user_id + created_at)
- Specialized indexes for search (tsvector GIN)
- Partial indexes for active records (is_trashed = false)

### Generated Columns
- `search_tsv`: Auto-updated tsvector for full-text search

## Error Handling Patterns
- Consistent error response format with code, message, details
- HTTP status codes aligned with REST semantics
- Validation errors include field-level details
- Idempotency considerations for retryable operations