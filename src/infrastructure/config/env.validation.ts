import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().min(1).required(),
  JWT_SECRET: Joi.string().min(1).required(),
  JWT_EXPIRES_IN: Joi.string().min(1).default("7d"),
  CORS_ORIGINS: Joi.string().allow("").default(""),
  REDIS_URL: Joi.string().min(1).default("redis://localhost:6379"),
  STORAGE_BUCKET: Joi.string().allow("").default(""),
  QR_BASE_URL: Joi.string()
    .uri({ scheme: [/https?/] })
    .default("https://dotly.id/q"),
});
