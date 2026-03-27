function parseTrustProxy(value: string | undefined): boolean | number | string {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized || normalized === "false") {
    return false;
  }

  if (normalized === "true") {
    return true;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return normalized;
}

export const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number.parseInt(process.env.PORT ?? "3000", 10),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    healthEndpointToken: process.env.HEALTH_ENDPOINT_TOKEN ?? "",
    corsOrigins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? "",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    issuer: process.env.JWT_ISSUER ?? "dotly-backend",
    audience: process.env.JWT_AUDIENCE ?? "dotly-clients",
  },
  webauthn: {
    rpId: process.env.WEBAUTHN_RP_ID ?? "localhost",
    rpName: process.env.WEBAUTHN_RP_NAME ?? "Dotly",
    origins: (process.env.WEBAUTHN_ORIGINS ?? "http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    enabled: process.env.REDIS_ENABLED !== "false",
  },
  storage: {
    bucket: process.env.STORAGE_BUCKET ?? "",
  },
  mail: {
    mailgunApiKey: process.env.MAILGUN_API_KEY ?? "",
    mailgunDomain: process.env.MAILGUN_DOMAIN ?? "",
    fromEmail: process.env.MAIL_FROM_EMAIL ?? "",
    frontendVerificationUrlBase:
      process.env.FRONTEND_VERIFICATION_URL_BASE ?? "",
    frontendPasswordResetUrlBase:
      process.env.FRONTEND_PASSWORD_RESET_URL_BASE ?? "",
  },
  support: {
    inboxAllowedEmails: process.env.SUPPORT_INBOX_ALLOWED_EMAILS ?? "",
  },
  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    twilioFromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER ?? "",
  },
  qr: {
    baseUrl: process.env.QR_BASE_URL ?? "https://dotly.id/q",
  },
  followUps: {
    processing: {
      enabled: process.env.FOLLOW_UPS_PROCESSING_ENABLED !== "false",
      cron: process.env.FOLLOW_UPS_PROCESSING_CRON ?? "* * * * *",
      batchSize: Number.parseInt(
        process.env.FOLLOW_UPS_PROCESSING_BATCH_SIZE ?? "100",
        10,
      ),
    },
    passiveProcessing: {
      enabled: process.env.FOLLOW_UPS_PASSIVE_PROCESSING_ENABLED !== "false",
      cron: process.env.FOLLOW_UPS_PASSIVE_PROCESSING_CRON ?? "0 */12 * * *",
      batchSize: Number.parseInt(
        process.env.FOLLOW_UPS_PASSIVE_PROCESSING_BATCH_SIZE ?? "100",
        10,
      ),
    },
  },
});
