import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfigService {
  get nodeEnv(): string {
    return process.env.NODE_ENV || "development";
  }

  get port(): number {
    return parseInt(process.env.PORT || "4000", 10);
  }

  get apiOrigin(): string {
    return process.env.API_ORIGIN || `http://localhost:${this.port}`;
  }

  get databaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      "postgresql://user:password@localhost:5432/booster_vault"
    );
  }

  get webOrigin(): string {
    return process.env.WEB_ORIGIN || "http://localhost:3000";
  }

  get logLevel(): string {
    return process.env.LOG_LEVEL || "info";
  }

  // Redis / BullMQ
  get redisUrl(): string {
    return process.env.REDIS_URL || "redis://localhost:6379";
  }

  get queueConcurrencyExports(): number {
    return parseInt(process.env.QUEUE_CONCURRENCY_EXPORTS || "2", 10);
  }

  get queueConcurrencyPurge(): number {
    return parseInt(process.env.QUEUE_CONCURRENCY_PURGE || "5", 10);
  }

  get queueConcurrencyThumbnails(): number {
    return parseInt(process.env.QUEUE_CONCURRENCY_THUMBNAILS || "5", 10);
  }

  // Worker heartbeat (observability)
  get workerHeartbeatIntervalSeconds(): number {
    return parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_SECONDS || "10", 10);
  }

  get workerHeartbeatStaleSeconds(): number {
    return parseInt(process.env.WORKER_HEARTBEAT_STALE_SECONDS || "60", 10);
  }

  get workerHeartbeatCleanupIntervalMinutes(): number {
    return parseInt(
      process.env.WORKER_HEARTBEAT_CLEANUP_INTERVAL_MINUTES || "60",
      10,
    );
  }

  get workerHeartbeatRetentionHours(): number {
    return parseInt(process.env.WORKER_HEARTBEAT_RETENTION_HOURS || "24", 10);
  }

  // Purge (trash) background processing
  get purgeScanIntervalMinutes(): number {
    return parseInt(process.env.PURGE_SCAN_INTERVAL_MINUTES || "5", 10);
  }

  get purgeScanBatchSize(): number {
    return parseInt(process.env.PURGE_SCAN_BATCH_SIZE || "500", 10);
  }

  // Thumbnails background processing
  get thumbnailVerifyScanIntervalMinutes(): number {
    return parseInt(
      process.env.THUMBNAIL_VERIFY_SCAN_INTERVAL_MINUTES || "10",
      10,
    );
  }

  get thumbnailVerifyScanBatchSize(): number {
    return parseInt(process.env.THUMBNAIL_VERIFY_SCAN_BATCH_SIZE || "500", 10);
  }

  // Life Docs (Phase 1)
  // Base64-encoded 32-byte key used for AES-256-GCM sealing of vault pointers and ACL payloads.
  get lifeDocsSealingKeyBase64(): string {
    return this.get(
      "LIFE_DOCS_SEALING_KEY_BASE64",
      // Development default only; MUST be overridden in production.
      Buffer.from(
        "dev-only-life-docs-sealing-key-change-me-32b",
        "utf8",
      )
        .subarray(0, 32)
        .toString("base64"),
    );
  }

  // Base64-encoded key used for HMAC(userId) indexing in access grants.
  get lifeDocsAccessHmacKeyBase64(): string {
    return this.get(
      "LIFE_DOCS_ACCESS_HMAC_KEY_BASE64",
      Buffer.from(
        "dev-only-life-docs-access-hmac-key-change-me",
        "utf8",
      )
        .subarray(0, 32)
        .toString("base64"),
    );
  }

  // How often to ensure a repeatable reminder scan job (ms).
  // The job itself runs daily; this is the repeat interval.
  get lifeDocsReminderScanIntervalHours(): number {
    return parseInt(process.env.LIFE_DOCS_REMINDER_SCAN_INTERVAL_HOURS || "24", 10);
  }

  // Generic getter for any environment variable with optional default
  get(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined || value === null) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
  }

  // Optional getter for environment variables that may not be set in development.
  getOptional(key: string): string | undefined {
    const value = process.env[key];
    return value === undefined || value === null || value === "" ? undefined : value;
  }

  // Helper methods for specific auth-related env vars
  get jwtSecret(): string {
    return this.get(
      "JWT_SECRET",
      "change-this-in-production-must-be-32-characters-minimum",
    );
  }

  get jwtAccessExpiresIn(): string {
    return this.get("JWT_ACCESS_EXPIRES_IN", "15m");
  }

  get jwtRefreshExpiresIn(): string {
    return this.get("JWT_REFRESH_EXPIRES_IN", "30d");
  }

  // Continuity Heir Portal (separate auth scope)
  get heirJwtSecret(): string {
    return this.get(
      "HEIR_JWT_SECRET",
      "dev-only-heir-jwt-secret-change-me-must-be-different-from-jwt-secret",
    );
  }

  get heirJwtExpiresIn(): string {
    return this.get("HEIR_JWT_EXPIRES_IN", "1h");
  }

  get passwordHashingAlgorithm(): string {
    return this.get("PASSWORD_HASHING_ALGORITHM", "argon2id");
  }

  get mailerProvider(): string {
    return this.get("MAILER_PROVIDER", "console");
  }

  get mailerFromEmail(): string {
    return this.get("MAILER_FROM_EMAIL", "noreply@boostervault.com");
  }

  // Mailgun configuration
  get mailgunApiKey(): string | undefined {
    return this.getOptional("MAILGUN_API_KEY");
  }

  get mailgunDomain(): string | undefined {
    return this.getOptional("MAILGUN_DOMAIN");
  }

  // Default: US endpoint. Override with e.g. https://api.eu.mailgun.net for EU.
  get mailgunBaseUrl(): string {
    return this.get("MAILGUN_BASE_URL", "https://api.mailgun.net");
  }

  get webAppUrl(): string {
    return this.get("WEB_APP_URL", "http://localhost:3000");
  }

  // Abuse resistance (CAPTCHA)
  get turnstileEnabled(): boolean {
    const raw = this.get("TURNSTILE_ENABLED", "false");
    return raw === "true" || raw === "1";
  }

  get turnstileSecretKey(): string | undefined {
    return this.getOptional("TURNSTILE_SECRET_KEY");
  }

  get turnstileVerifyUrl(): string {
    return this.get(
      "TURNSTILE_VERIFY_URL",
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
  }

  // S3 Configuration
  get s3Endpoint(): string | undefined {
    return process.env.S3_ENDPOINT;
  }

  get s3Region(): string {
    return process.env.S3_REGION || process.env.AWS_REGION || "us-east-1";
  }

  get s3Bucket(): string {
    return process.env.S3_BUCKET || "booster-vault-media";
  }

  get s3AccessKeyId(): string | undefined {
    return process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  }

  get s3SecretAccessKey(): string | undefined {
    return (
      process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  get s3ForcePathStyle(): boolean {
    const val = process.env.S3_FORCE_PATH_STYLE;
    return val === "true" || val === "1";
  }

  get signedUrlTtlSeconds(): number {
    return parseInt(process.env.SIGNED_URL_TTL_SECONDS || "900", 10);
  }

  get multipartPartSizeBytes(): number {
    // S3 requires parts >= 5MiB (except last). Default to 8MiB.
    const raw =
      process.env.MULTIPART_PART_SIZE_BYTES || String(8 * 1024 * 1024);
    const parsed = parseInt(raw, 10);
    const min = 5 * 1024 * 1024;
    const max = 100 * 1024 * 1024;
    if (!Number.isFinite(parsed)) return 8 * 1024 * 1024;
    return Math.min(max, Math.max(min, parsed));
  }

  get multipartThresholdBytes(): number {
    // Suggest multipart at 64MiB by default.
    const raw =
      process.env.MULTIPART_THRESHOLD_BYTES || String(64 * 1024 * 1024);
    const parsed = parseInt(raw, 10);
    const min = 5 * 1024 * 1024;
    if (!Number.isFinite(parsed)) return 64 * 1024 * 1024;
    return Math.max(min, parsed);
  }

  /**
   * Optional safety net: allow a small number of uploads during TRIAL before
   * enforcing recovery/risk-acceptance.
   */
  get recoveryTrialGraceUploads(): number {
    const raw = process.env.RECOVERY_TRIAL_GRACE_UPLOADS || "10";
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
  }

  // Storage driver configuration
  // - "s3": force S3 (requires credentials)
  // - "local": store objects on local disk (development only)
  // - "auto": use S3 when configured, else local in development
  get storageDriver(): "auto" | "s3" | "local" {
    const raw = (process.env.STORAGE_DRIVER || "auto").toLowerCase();
    if (raw === "s3" || raw === "local") return raw;
    return "auto";
  }

  get storageLocalDir(): string {
    return process.env.STORAGE_LOCAL_DIR || ".local-storage";
  }

  get shareTokenTtlSeconds(): number {
    return parseInt(process.env.SHARE_TOKEN_TTL_SECONDS || "900", 10); // 15 minutes default
  }

  // Check if S3 is configured
  get isS3Configured(): boolean {
    return !!this.s3AccessKeyId && !!this.s3SecretAccessKey && !!this.s3Bucket;
  }

  // Export configuration
  get exportTtlDays(): number {
    return parseInt(process.env.EXPORT_TTL_DAYS || "7", 10);
  }

  get exportDownloadUrlTtlSeconds(): number {
    return parseInt(process.env.EXPORT_DOWNLOAD_URL_TTL_SECONDS || "900", 10);
  }

  get exportWorkerIntervalSeconds(): number {
    return parseInt(process.env.EXPORT_WORKER_INTERVAL_SECONDS || "10", 10);
  }

  get exportCleanupIntervalHours(): number {
    return parseInt(process.env.EXPORT_CLEANUP_INTERVAL_HOURS || "24", 10);
  }

  get exportWatchdogIntervalMinutes(): number {
    return parseInt(process.env.EXPORT_WATCHDOG_INTERVAL_MINUTES || "30", 10);
  }

  get exportMaxActiveJobsPerUser(): number {
    return parseInt(process.env.EXPORT_MAX_ACTIVE_JOBS_PER_USER || "2", 10);
  }

  // Billing configuration
  get cryptoPaymentAddress(): string {
    return this.get("CRYPTO_PAYMENT_ADDRESS");
  }

  get cryptoWebhookSecret(): string {
    return this.get("CRYPTO_WEBHOOK_SECRET");
  }

  get stripeSecretKey(): string {
    return this.get("STRIPE_SECRET_KEY");
  }

  get stripeWebhookSecret(): string {
    return this.get("STRIPE_WEBHOOK_SECRET");
  }

  get cardProcessingFeePercent(): number {
    return parseInt(process.env.CARD_PROCESSING_FEE_PERCENT || "4", 10);
  }

  get billingCurrency(): string {
    return process.env.BILLING_CURRENCY || "USD";
  }

  get isStripeConfigured(): boolean {
    return !!this.stripeSecretKey && !!this.stripeWebhookSecret;
  }

  get isCryptoConfigured(): boolean {
    return !!this.cryptoPaymentAddress && !!this.cryptoWebhookSecret;
  }

  // Rate limiting configuration
  get rateLimitTtl(): number {
    return parseInt(process.env.RATE_LIMIT_TTL || "60", 10);
  }

  get rateLimitMax(): number {
    return parseInt(process.env.RATE_LIMIT_MAX || "10", 10);
  }

  get rateLimitAuthTtl(): number {
    return parseInt(process.env.RATE_LIMIT_AUTH_TTL || "300", 10);
  }

  get rateLimitAuthMax(): number {
    return parseInt(process.env.RATE_LIMIT_AUTH_MAX || "20", 10);
  }

  get rateLimitUploadTtl(): number {
    return parseInt(process.env.RATE_LIMIT_UPLOAD_TTL || "300", 10);
  }

  get rateLimitUploadMax(): number {
    return parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || "5", 10);
  }

  // Sharing (public endpoints) rate limiting
  get rateLimitSharePublicTtl(): number {
    return parseInt(process.env.RATE_LIMIT_SHARE_PUBLIC_TTL || "60", 10);
  }

  get rateLimitSharePublicMax(): number {
    return parseInt(process.env.RATE_LIMIT_SHARE_PUBLIC_MAX || "30", 10);
  }

  // Card (public endpoints) rate limiting
  get rateLimitCardPublicTtl(): number {
    return parseInt(process.env.RATE_LIMIT_CARD_PUBLIC_TTL || "60", 10);
  }

  get rateLimitCardPublicMax(): number {
    return parseInt(process.env.RATE_LIMIT_CARD_PUBLIC_MAX || "30", 10);
  }

  // Card (public contact requests) rate limiting
  get rateLimitCardContactPublicTtl(): number {
    return parseInt(process.env.RATE_LIMIT_CARD_CONTACT_PUBLIC_TTL || "300", 10);
  }

  get rateLimitCardContactPublicMax(): number {
    return parseInt(process.env.RATE_LIMIT_CARD_CONTACT_PUBLIC_MAX || "5", 10);
  }

  // Card (public token endpoints: vCard + contact reveal)
  get rateLimitCardTokenPublicTtl(): number {
    return parseInt(process.env.RATE_LIMIT_CARD_TOKEN_PUBLIC_TTL || "300", 10);
  }

  get rateLimitCardTokenPublicMax(): number {
    return parseInt(process.env.RATE_LIMIT_CARD_TOKEN_PUBLIC_MAX || "20", 10);
  }

  get rateLimitBillingWebhookTtl(): number {
    return parseInt(process.env.RATE_LIMIT_BILLING_WEBHOOK_TTL || "60", 10);
  }

  get rateLimitBillingWebhookMax(): number {
    return parseInt(process.env.RATE_LIMIT_BILLING_WEBHOOK_MAX || "100", 10);
  }

  // Operational kill switches
  get disableUploads(): boolean {
    return process.env.DISABLE_UPLOADS === "true";
  }

  get disableBilling(): boolean {
    return process.env.DISABLE_BILLING === "true";
  }

  get disableExports(): boolean {
    return process.env.DISABLE_EXPORTS === "true";
  }

  // Timeout configurations (seconds)
  get s3OperationTimeout(): number {
    return parseInt(process.env.S3_OPERATION_TIMEOUT || "30", 10);
  }

  get exportDownloadTimeout(): number {
    return parseInt(process.env.EXPORT_DOWNLOAD_TIMEOUT || "300", 10);
  }

  get exportWorkerStuckThresholdMinutes(): number {
    return parseInt(
      process.env.EXPORT_WORKER_STUCK_THRESHOLD_MINUTES || "30",
      10,
    );
  }
}
