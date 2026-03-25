# Booster Vault - Database Migration Guide

## Initial Setup

The Booster Vault data model has been implemented using Prisma + PostgreSQL. The following steps guide you through setting up the database and running migrations.

## Prerequisites

- PostgreSQL 14+ (local or Docker)
- Node.js 18+ and pnpm 8+
- Environment variables configured (see `.env.example`)

## Database Setup

### Option 1: Using Docker (Recommended for Development)

```bash
# Start PostgreSQL container
docker run -d \
  --name booster-vault-db \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=booster_vault \
  -p 5432:5432 \
  postgres:14-alpine

# Verify it's running
docker ps | grep booster-vault-db
```

### Option 2: Local PostgreSQL Installation

```bash
# Create database (if PostgreSQL is already installed)
sudo -u postgres psql -c "CREATE DATABASE booster_vault;"
sudo -u postgres psql -c "CREATE USER booster_vault_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE booster_vault TO booster_vault_user;"
```

## Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your database connection:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/booster_vault
   ```

   Adjust the URL based on your setup:
   - Docker: `postgresql://user:password@localhost:5432/booster_vault`
   - Local: `postgresql://booster_vault_user:secure_password@localhost:5432/booster_vault`

## Running Migrations

### Generate Prisma Client

First, generate the Prisma client (TypeScript types) based on the schema:

```bash
cd apps/api
pnpm prisma:generate
```

This should output: "Generated Prisma Client (v5.22.0) to ..."

### Create and Apply Migrations

#### For Development (creates migration and applies it)

```bash
cd apps/api
pnpm prisma:migrate:dev --name "your_migration_name"
```

**Note**: The initial migration `1770184330_init_booster_vault_schema` has already been created. If you need to create a new migration after schema changes, use the command above.

#### For Production (applies pending migrations)

```bash
cd apps/api
pnpm prisma:migrate:deploy
```

### Manual Migration (if needed)

If you need to manually inspect or run the migration SQL:

```bash
cd apps/api
# View the generated SQL
cat prisma/migrations/1770184330_init_booster_vault_schema/migration.sql

# Apply using psql (alternative to prisma migrate deploy)
psql $DATABASE_URL -f prisma/migrations/1770184330_init_booster_vault_schema/migration.sql
```

## Schema Overview

The data model includes the following tables:

1. **users** - User accounts with authentication details
2. **user_sessions** - Optional session management
3. **user_key_bundles** - Encrypted key bundle storage (zero-knowledge architecture)
4. **subscriptions** - User subscription and trial management
5. **user_usage** - Aggregated usage counters for plan enforcement
6. **albums** - Photo/video album metadata
7. **media** - Encrypted media metadata and storage references
8. **album_items** - Many-to-many relationship between albums and media with ordering
9. **exports** - Export job tracking
10. **audit_events** - Lightweight audit trail

### Key Constraints

- `users.email` is unique (case-sensitive; consider normalization in application layer)
- `subscriptions.userId` is unique (one subscription per user)
- `media.objectKey` is unique (object storage key)
- `album_items` has composite unique constraint on `(albumId, mediaId)`
- Foreign key constraints with `ON DELETE CASCADE` for data integrity

### Indexes for Performance

- Media: `(userId, takenAt DESC)`, `(userId, isTrashed, purgeAfter)`
- Albums: `(userId, isDeleted)`
- AlbumItems: `(albumId, position)`
- Exports: `(userId, createdAt DESC)`, `(status)`
- Sessions: `(userId)`, `(expiresAt)`

## Development Workflow

### Making Schema Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Generate migration:
   ```bash
   cd apps/api
   pnpm prisma:migrate:dev --name "describe_change"
   ```
3. Verify the generated SQL in the migration file
4. The migration will be applied automatically to your development database

### Prisma Studio (GUI)

For inspecting data during development:

```bash
cd apps/api
pnpm prisma:studio
```

Open http://localhost:5555 in your browser.

## Production Considerations

1. **Backup**: Always backup your database before running migrations in production
2. **Downtime**: Consider downtime for large migrations
3. **Rollback**: Prisma doesn't support automatic rollbacks; have a rollback plan
4. **Testing**: Test migrations in staging environment first
5. **Monitoring**: Monitor application after migration deployment

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

Ensure `.env` file exists in the root directory and contains the `DATABASE_URL` variable.

### "Database connection failed"

1. Verify PostgreSQL is running:
   ```bash
   # For Docker
   docker ps | grep postgres
   
   # For systemd
   sudo systemctl status postgresql
   ```

2. Check connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. Verify credentials in `.env`

### Migration conflicts

If you have conflicting migrations, you can reset the database (development only):

```bash
cd apps/api
pnpm prisma:migrate:reset
```

**Warning**: This will drop all data in the database.

### Prisma client out of sync

If you change the schema but don't regenerate the client:

```bash
cd apps/api
pnpm prisma:generate
pnpm build
```

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Booster Vault API Documentation](api/openapi.yaml)
- [Database Schema](db/schema.sql) (original SQL schema)