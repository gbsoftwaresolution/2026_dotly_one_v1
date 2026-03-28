import * as Joi from "joi";

const JWT_EXPIRY_PATTERN = /^(\d+)([smhd])$/;
const TWILIO_ACCOUNT_SID_PATTERN = /^AC[a-zA-Z0-9]{32}$/;
const EMAIL_ADDRESS_SCHEMA = Joi.string().email({ tlds: { allow: false } });

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
  HEALTH_ENDPOINT_TOKEN: Joi.string().allow("").default(""),
  DATABASE_URL: Joi.string().min(1).required(),
  JWT_SECRET: Joi.string().min(1).required(),
  JWT_EXPIRES_IN: Joi.string().pattern(JWT_EXPIRY_PATTERN).default("7d"),
  JWT_ISSUER: Joi.string().min(1).default("dotly-backend"),
  JWT_AUDIENCE: Joi.string().min(1).default("dotly-clients"),
  WEBAUTHN_RP_ID: Joi.string().hostname().default("localhost"),
  WEBAUTHN_RP_NAME: Joi.string().min(1).max(120).default("Dotly"),
  WEBAUTHN_ORIGINS: Joi.string().allow("").default("http://localhost:3001"),
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
    .custom((value, helpers) => {
      const normalized = String(value).trim();

      if (normalized.length === 0) {
        return "";
      }

      return isValidMailboxAddress(normalized)
        ? normalized
        : helpers.error("string.email");
    }, "mailbox validation")
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
  SUPPORT_INBOX_ALLOWED_EMAILS: Joi.string()
    .custom((value, helpers) => {
      const normalized = String(value).trim();

      if (normalized.length === 0) {
        return "";
      }

      const emailList = normalized
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (
        emailList.length === 0 ||
        emailList.some(
          (entry) => EMAIL_ADDRESS_SCHEMA.validate(entry).error !== undefined,
        )
      ) {
        return helpers.error("string.email");
      }

      return emailList.join(",");
    }, "support inbox allowlist validation")
    .allow("")
    .default(""),
  TWILIO_ACCOUNT_SID: Joi.alternatives()
    .try(
      Joi.string().length(0),
      Joi.string().pattern(TWILIO_ACCOUNT_SID_PATTERN),
    )
    .default(""),
  TWILIO_AUTH_TOKEN: Joi.string().allow("").default(""),
  TWILIO_FROM_PHONE_NUMBER: Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .allow("")
    .default(""),
  QR_BASE_URL: Joi.string()
    .uri({ scheme: [/https?/] })
    .default("https://dotly.id/q"),
  FOLLOW_UPS_PROCESSING_ENABLED: Joi.boolean()
    .truthy("true")
    .truthy("1")
    .falsy("false")
    .falsy("0")
    .default(true),
  FOLLOW_UPS_PROCESSING_CRON: Joi.string().min(1).default("* * * * *"),
  FOLLOW_UPS_PROCESSING_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100),
  FOLLOW_UPS_PASSIVE_PROCESSING_ENABLED: Joi.boolean()
    .truthy("true")
    .truthy("1")
    .falsy("false")
    .falsy("0")
    .default(true),
  FOLLOW_UPS_PASSIVE_PROCESSING_CRON: Joi.string()
    .min(1)
    .default("0 */12 * * *"),
  FOLLOW_UPS_PASSIVE_PROCESSING_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100),
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
    ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_PHONE_NUMBER"],
    "SMS delivery requires the Twilio account SID, auth token, and sender phone number to be configured together.",
    errors,
  );

  if (value.NODE_ENV === "production") {
    if (!Object.prototype.hasOwnProperty.call(config, "TRUST_PROXY")) {
      errors.push(
        "TRUST_PROXY must be set explicitly in production so forwarded IP and HTTPS handling matches the deployment proxy chain.",
      );
    }

    const trustedCorsOrigins = collectTrustedCorsOrigins(
      value.CORS_ORIGINS,
      errors,
    );
    const trustedWebAuthnOrigins = collectTrustedOrigins(
      value.WEBAUTHN_ORIGINS,
      "WEBAUTHN_ORIGINS",
      errors,
      true,
    );
    const frontendVerificationUrl = parseTrustedUrl(
      value.FRONTEND_VERIFICATION_URL_BASE,
      "FRONTEND_VERIFICATION_URL_BASE",
      errors,
    );
    const frontendPasswordResetUrl = parseTrustedUrl(
      value.FRONTEND_PASSWORD_RESET_URL_BASE,
      "FRONTEND_PASSWORD_RESET_URL_BASE",
      errors,
    );

    assertStrongSecret(
      value.JWT_SECRET,
      "JWT_SECRET must be at least 32 characters and use a non-placeholder high-entropy value in production.",
      errors,
    );
    assertStrongSecret(
      value.HEALTH_ENDPOINT_TOKEN,
      "HEALTH_ENDPOINT_TOKEN must be at least 32 characters and use a non-placeholder high-entropy value in production.",
      errors,
    );
    assertOriginAllowedByCors(
      frontendVerificationUrl,
      "FRONTEND_VERIFICATION_URL_BASE",
      trustedCorsOrigins,
      errors,
    );
    assertOriginAllowedByCors(
      frontendPasswordResetUrl,
      "FRONTEND_PASSWORD_RESET_URL_BASE",
      trustedCorsOrigins,
      errors,
    );
    assertWebAuthnProductionConfiguration(
      value.WEBAUTHN_RP_ID,
      trustedWebAuthnOrigins,
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

function collectTrustedCorsOrigins(value: unknown, errors: string[]): string[] {
  return collectTrustedOrigins(value, "CORS_ORIGINS", errors, true);
}

function collectTrustedOrigins(
  value: unknown,
  label: string,
  errors: string[],
  requireBareOrigin: boolean = false,
): string[] {
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    errors.push(
      label === "CORS_ORIGINS"
        ? "CORS_ORIGINS must list at least one trusted HTTPS frontend origin in production."
        : `${label} must list at least one trusted HTTPS origin in production.`,
    );
    return [];
  }

  const trustedOrigins: string[] = [];

  for (const origin of origins) {
    const parsedOrigin = parseTrustedUrl(origin, label, errors);

    if (!parsedOrigin) {
      continue;
    }

    if (
      requireBareOrigin &&
      ((parsedOrigin.pathname && parsedOrigin.pathname !== "/") ||
        parsedOrigin.search ||
        parsedOrigin.hash)
    ) {
      errors.push(
        `${label} entries must be bare origins without paths, query strings, or hashes in production.`,
      );
      continue;
    }

    trustedOrigins.push(parsedOrigin.origin);
  }

  return trustedOrigins;
}

function assertWebAuthnProductionConfiguration(
  rpId: unknown,
  trustedOrigins: string[],
  errors: string[],
): void {
  const normalizedRpId = String(rpId ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedRpId) {
    errors.push("WEBAUTHN_RP_ID must be configured in production.");
    return;
  }

  if (
    normalizedRpId === "localhost" ||
    normalizedRpId === "127.0.0.1" ||
    normalizedRpId === "::1" ||
    normalizedRpId.endsWith(".local") ||
    normalizedRpId.endsWith(".example") ||
    normalizedRpId.endsWith(".internal")
  ) {
    errors.push(
      "WEBAUTHN_RP_ID must not target localhost or a placeholder host in production.",
    );
  }

  if (
    trustedOrigins.length > 0 &&
    trustedOrigins.some((origin) => !originMatchesRpId(origin, normalizedRpId))
  ) {
    errors.push(
      "WEBAUTHN_ORIGINS must all match WEBAUTHN_RP_ID or its subdomains in production.",
    );
  }
}

function originMatchesRpId(origin: string, rpId: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === rpId || hostname.endsWith(`.${rpId}`);
  } catch {
    return false;
  }
}

function assertTrustedUrl(
  value: unknown,
  label: string,
  errors: string[],
): void {
  parseTrustedUrl(value, label, errors);
}

function parseTrustedUrl(
  value: unknown,
  label: string,
  errors: string[],
): URL | null {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    errors.push(
      `${label} must be configured with a trusted HTTPS URL in production.`,
    );
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    errors.push(`${label} must be a valid HTTPS URL in production.`);
    return null;
  }

  if (parsed.protocol !== "https:") {
    errors.push(`${label} must use HTTPS in production.`);
  }

  if (isLocalOrPlaceholderHost(parsed.hostname)) {
    errors.push(
      `${label} must not target localhost or a placeholder host in production.`,
    );
  }

  return parsed;
}

function assertOriginAllowedByCors(
  value: URL | null,
  label: string,
  corsOrigins: string[],
  errors: string[],
): void {
  if (!value || corsOrigins.length === 0) {
    return;
  }

  if (!corsOrigins.includes(value.origin)) {
    errors.push(
      `${label} must use a frontend origin that is also present in CORS_ORIGINS in production.`,
    );
  }
}

function hasValue(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

function isValidMailboxAddress(value: string): boolean {
  const trimmedValue = value.trim();
  const mailboxMatch = trimmedValue.match(/^([^<>]+)\s*<([^<>]+)>$/);
  const emailCandidate = mailboxMatch
    ? (mailboxMatch[2]?.trim() ?? "")
    : trimmedValue;

  if (mailboxMatch && mailboxMatch[1]?.trim().length === 0) {
    return false;
  }

  return EMAIL_ADDRESS_SCHEMA.validate(emailCandidate).error === undefined;
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
