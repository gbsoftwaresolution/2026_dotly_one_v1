export const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number.parseInt(process.env.PORT ?? "3000", 10),
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
  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    twilioFromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER ?? "",
  },
  qr: {
    baseUrl: process.env.QR_BASE_URL ?? "https://dotly.id/q",
  },
});
