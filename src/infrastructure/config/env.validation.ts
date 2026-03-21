import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().min(1).required(),
  JWT_SECRET: Joi.string().min(1).required(),
  JWT_EXPIRES_IN: Joi.string().min(1).default("7d"),
  JWT_ISSUER: Joi.string().min(1).default("dotly-backend"),
  JWT_AUDIENCE: Joi.string().min(1).default("dotly-clients"),
  CORS_ORIGINS: Joi.string().allow("").default(""),
  REDIS_ENABLED: Joi.boolean()
    .truthy("true")
    .truthy("1")
    .falsy("false")
    .falsy("0")
    .default(true),
  REDIS_URL: Joi.string().min(1).default("redis://localhost:6379"),
  STORAGE_BUCKET: Joi.string().allow("").default(""),
  MAILGUN_API_KEY: Joi.string().allow("").default(""),
  MAILGUN_DOMAIN: Joi.string().allow("").default(""),
  MAIL_FROM_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .allow("")
    .default(""),
  FRONTEND_VERIFICATION_URL_BASE: Joi.string()
    .uri({ scheme: [/https?/] })
    .allow("")
    .default(""),
  FRONTEND_PASSWORD_RESET_URL_BASE: Joi.string()
    .uri({ scheme: [/https?/] })
    .allow("")
    .default(""),
  TWILIO_ACCOUNT_SID: Joi.string().allow("").default(""),
  TWILIO_AUTH_TOKEN: Joi.string().allow("").default(""),
  TWILIO_FROM_PHONE_NUMBER: Joi.string().allow("").default(""),
  QR_BASE_URL: Joi.string()
    .uri({ scheme: [/https?/] })
    .default("https://dotly.id/q"),
});
