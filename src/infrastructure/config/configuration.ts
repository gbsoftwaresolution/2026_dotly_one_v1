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
  },
  storage: {
    bucket: process.env.STORAGE_BUCKET ?? "",
  },
  qr: {
    baseUrl: process.env.QR_BASE_URL ?? "https://dotly.id/q",
  },
});
