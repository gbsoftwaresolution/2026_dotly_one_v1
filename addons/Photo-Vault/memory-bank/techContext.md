# Tech Context

## Technologies Used
### Backend Stack
- **Language**: Node.js (TypeScript)
- **Framework**: **NestJS**
- **Database**: PostgreSQL 14+
- **ORM**: **Prisma**
- **Queues/Workers**: **BullMQ + Redis**
- **Object Storage**: S3-compatible (AWS S3 / DigitalOcean Spaces / MinIO) via presigned URLs; plus a local dev driver
- **Payment Processing**: Stripe + internal “crypto invoice” flow
- **Authentication**: JWT access + refresh sessions; password hashing via argon2id/bcrypt (configurable)
- **Validation**: class-validator / class-transformer via Nest ValidationPipe; Zod used for some internal validation
- **Logging**: pino (via custom LoggerService)
- **Testing**: Jest + Supertest
- **Documentation**: OpenAPI 3.0 spec exists at `api/openapi.yaml` (not always kept perfectly in-sync)

### Frontend Stack
- **Framework**: React 18
- **Language**: TypeScript
- **Routing**: react-router
- **Build Tool**: Vite
- **Crypto**: Web Crypto API (AES-256-GCM) + IndexedDB for local key storage
- **Testing**: Vitest

### DevOps & Infrastructure
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes (optional for production)
- **CI/CD**: GitHub Actions, GitLab CI, or Jenkins
- **Monitoring**: Prometheus, Grafana, ELK stack
- **Error Tracking**: Sentry or Rollbar

## Development Setup
### Prerequisites
- Node.js 18+ and pnpm (workspace uses `pnpm-workspace.yaml`)
- PostgreSQL 14+ running locally or via Docker
- Object storage (S3 compatible) for media storage
- Stripe account for payment processing

### Local Development Environment
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Prisma generate + migrate
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate:dev

# Start API + web
cd ../..
pnpm dev

# In another terminal: start workers
pnpm worker
```

### Environment Variables
Key environment variables needed:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/booster_vault

# JWT
JWT_SECRET=change-this-in-production-must-be-32-characters-minimum
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Object Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=booster-vault-media
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=4000
NODE_ENV=development
```

## Technical Constraints
### Zero-Knowledge Architecture Constraints
- Client must handle all encryption/decryption
- Server cannot have access to encryption keys
- Must use authenticated encryption (currently AES-256-GCM via Web Crypto)
- Key management must be client-side responsibility

### Performance Constraints
- Media upload/download must use direct-to-object-storage signed URLs
- Database queries must be optimized for pagination (cursor-based)
- Full-text search must be performant with PostgreSQL tsvector
- Usage counters must be updated transactionally

### Scalability Constraints
- Object storage must scale horizontally
- Database must handle increasing user count and media metadata
- API must be stateless for horizontal scaling
- Background jobs for exports must be queue-based

### Security Constraints
- Passwords must be hashed with strong algorithm (argon2id or bcrypt)
- JWT tokens must have reasonable expiration
- Refresh token rotation if session management implemented
- Rate limiting on authentication endpoints
- Input validation on all API endpoints
- SQL injection prevention via parameterized queries
- CORS configuration for web client

## Dependencies
### Backend Dependencies (Actual / Key)
- `@nestjs/*` (NestJS framework)
- `@prisma/client` + `prisma`
- `bullmq` + `@nestjs/bullmq` + `ioredis`
- `@aws-sdk/*` (S3)
- `stripe`
- `argon2` + `bcrypt` (configurable)
- `class-validator` / `class-transformer`
- `helmet`
- `pino`

### Development Dependencies
- `typescript` - type checking
- `jest` - testing
- `supertest` - HTTP testing
- `eslint` - code linting
- `prettier` - code formatting

### Workspace Tooling
- Package manager: pnpm workspaces (`pnpm-workspace.yaml`)
- E2E: Playwright (`playwright.config.ts`, `e2e/*`)

## Tool Usage Patterns
### Database Migrations
- Use Prisma Migrate or Knex migration files
- Version-controlled migration scripts
- Rollback capability for failed migrations

### API Development
- OpenAPI-first development: define spec first, implement second
- Swagger UI via `@nestjs/swagger` (if enabled in the app)
- Request/response validation against OpenAPI schema

### Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Mock external services (Stripe, S3)

### Code Quality
- TypeScript for type safety
- ESLint with strict rules
- Prettier for consistent formatting
- Git hooks for pre-commit checks

### Deployment
- Docker containers for consistent environments
- Environment-specific configuration
- Database migrations as part of deployment
- Health checks and readiness probes