import * as Joi from "joi";

const JWT_EXPIRY_PATTERN = /^(\d+)([smhd])$/;
const TWILIO_ACCOUNT_SID_PATTERN = /^AC[a-zA-Z0-9]{32}$/;

const COMMON_PLACEHOLDER_SECRET_FRAGMENTS = [
  "replace-with",
  "change-me",
  "changeme",
  "placeholder",
  "example",
  "default",
  "dummy",
  "insecure",
] as const;

type EnvRecord = Record<string, unknown>;

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  TRUST_PROXY: Joi.alternatives()
    .try(
      Joi.boolean(),
      Joi.number().integer().min(1),
      Joi.string().valid("loopback", "linklocal", "uniquelocal"),
    )
    .default(false),
  DATABASE_URL: Joi.string().min(1).required(),
  JWT_SECRET: Joi.string().min(1).required(),
  JWT_EXPIRES_IN: Joi.string().pattern(JWT_EXPIRY_PATTERN).default("7d"),
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
  TWILIO_ACCOUNT_SID: Joi.alternatives()
    .try(Joi.string().length(0), Joi.string().pattern(TWILIO_ACCOUNT_SID_PATTERN))
    .default(""),
  TWILIO_AUTH_TOKEN: Joi.string().allow("").default(""),
  TWILIO_FROM_PHONE_NUMBER: Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .allow("")
    .default(""),
  QR_BASE_URL: Joi.string()
    .uri({ scheme: [/https?/] })
    .default("https://dotly.id/q"),
}).unknown(true);

export function validateEnvironment(config: EnvRecord): EnvRecord {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  const errors = error?.details.map((detail) => detail.message) ?? [];

  assertProviderConfiguration(
    value,
    [
      "MAILGUN_API_KEY",
      "MAILGUN_DOMAIN",
      "MAIL_FROM_EMAIL",
      "FRONTEND_VERIFICATION_URL_BASE",
      "FRONTEND_PASSWORD_RESET_URL_BASE",
    ],
    "Mail delivery requires Mailgun credentials plus verification and password reset frontend URLs to be configured together.",
    errors,
  );
  assertProviderConfiguration(
    value,
    [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM_PHONE_NUMBER",
    ],
    "SMS delivery requires the Twilio account SID, auth token, and sender phone number to be configured together.",
    errors,
  );

  if (value.NODE_ENV === "production") {
    if (!Object.prototype.hasOwnProperty.call(config, "TRUST_PROXY")) {
      errors.push(
        "TRUST_PROXY must be set explicitly in production so forwarded IP and HTTPS handling matches the deployment proxy chain.",
      );
    }

    assertStrongSecret(
      value.JWT_SECRET,
      "JWT_SECRET must be at least 32 characters and use a non-placeholder high-entropy value in production.",
      errors,
    );
    assertTrustedOrigins(value.CORS_ORIGINS, errors);
    assertTrustedUrl(
      value.FRONTEND_VERIFICATION_URL_BASE,
      "FRONTEND_VERIFICATION_URL_BASE",
      errors,
    );
    assertTrustedUrl(
      value.FRONTEND_PASSWORD_RESET_URL_BASE,
      "FRONTEND_PASSWORD_RESET_URL_BASE",
      errors,
    );
    assertTrustedUrl(value.QR_BASE_URL, "QR_BASE_URL", errors);

    if (!hasValue(value.MAILGUN_API_KEY)) {
      errors.push(
        "MAILGUN_API_KEY is required in production so verification and password reset email delivery cannot fail silently.",
      );
    }

    if (!hasValue(value.MAILGUN_DOMAIN)) {
      errors.push(
        "MAILGUN_DOMAIN is required in production so verification and password reset email delivery cannot fail silently.",
      );
    }

    if (!hasValue(value.MAIL_FROM_EMAIL)) {
      errors.push(
        "MAIL_FROM_EMAIL is required in production so verification and password reset email delivery cannot fail silently.",
      );
    }

    assertPlaceholderFreeSecret(
      value.MAILGUN_API_KEY,
      "MAILGUN_API_KEY cannot use a placeholder or example value in production.",
      errors,
    );
    assertPlaceholderFreeSecret(
      value.TWILIO_AUTH_TOKEN,
      "TWILIO_AUTH_TOKEN cannot use a placeholder or example value in production.",
      errors,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join("\n- ")}`);
  }

  return value;
}

function assertProviderConfiguration(
  env: EnvRecord,
  keys: string[],
  message: string,
  errors: string[],
): void {
  const configuredCount = keys.filter((key) => hasValue(env[key])).length;

  if (configuredCount > 0 && configuredCount < keys.length) {
    errors.push(message);
  }
}

function assertStrongSecret(
  value: unknown,
  message: string,
  errors: string[],
): void {
  const normalized = String(value ?? "").trim();
  const characterClassCount = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(
    (pattern) => pattern.test(normalized),
  ).length;

  if (
    normalized.length < 32 ||
    characterClassCount < 3 ||
    assertContainsPlaceholderSecret(normalized)
  ) {
    errors.push(message);
  }
}

function assertPlaceholderFreeSecret(
  value: unknown,
  message: string,
  errors: string[],
): void {
  if (hasValue(value) && assertContainsPlaceholderSecret(String(value))) {
    errors.push(message);
  }
}

function assertTrustedOrigins(value: unknown, errors: string[]): void {
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    errors.push(
      "CORS_ORIGINS must list at least one trusted HTTPS frontend origin in production.",
    );
    return;
  }

  for (const origin of origins) {
    assertTrustedUrl(origin, "CORS_ORIGINS", errors);
  }
}

function assertTrustedUrl(
  value: unknown,
  label: string,
  errors: string[],
): void {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    errors.push(`${label} must be configured with a trusted HTTPS URL in production.`);
    return;
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    errors.push(`${label} must be a valid HTTPS URL in production.`);
    return;
  }

  if (parsed.protocol !== "https:") {
    errors.push(`${label} must use HTTPS in production.`);
  }

  if (isLocalOrPlaceholderHost(parsed.hostname)) {
    errors.push(`${label} must not target localhost or a placeholder host in production.`);
  }
}

function hasValue(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

function assertContainsPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return COMMON_PLACEHOLDER_SECRET_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

function isLocalOrPlaceholderHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".internal")
  );
}
