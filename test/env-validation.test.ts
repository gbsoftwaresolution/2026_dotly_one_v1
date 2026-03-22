import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { validateEnvironment } from "../src/infrastructure/config/env.validation";

describe("validateEnvironment", () => {
  it("rejects insecure production posture", () => {
    assert.throws(
      () =>
        validateEnvironment({
          NODE_ENV: "production",
          PORT: 3000,
          TRUST_PROXY: true,
          DATABASE_URL: "postgresql://prod-user:prod-pass@db.dotly.one/dotly",
          JWT_SECRET: "replace-with-a-long-random-secret",
          JWT_EXPIRES_IN: "7d",
          JWT_ISSUER: "dotly-backend",
          JWT_AUDIENCE: "dotly-clients",
          CORS_ORIGINS: "http://localhost:3001",
          REDIS_ENABLED: true,
          REDIS_URL: "redis://cache.dotly.one:6379",
          STORAGE_BUCKET: "dotly-prod",
          MAILGUN_API_KEY: "",
          MAILGUN_DOMAIN: "",
          MAIL_FROM_EMAIL: "",
          FRONTEND_VERIFICATION_URL_BASE: "http://localhost:3001/verify-email",
          FRONTEND_PASSWORD_RESET_URL_BASE: "http://localhost:3001/reset-password",
          TWILIO_ACCOUNT_SID: "",
          TWILIO_AUTH_TOKEN: "",
          TWILIO_FROM_PHONE_NUMBER: "",
          QR_BASE_URL: "http://localhost:3001/q",
        }),
      (error: unknown) => {
        assert.match(String(error), /JWT_SECRET must be at least 32 characters/i);

    it("requires TRUST_PROXY to be set explicitly in production", () => {
      assert.throws(
        () =>
          validateEnvironment({
            NODE_ENV: "production",
            PORT: 3000,
            DATABASE_URL: "postgresql://prod-user:prod-pass@db.dotly.one/dotly",
            JWT_SECRET: "ThisIsAStrongProductionSecret123!",
            JWT_EXPIRES_IN: "7d",
            JWT_ISSUER: "dotly-backend",
            JWT_AUDIENCE: "dotly-clients",
            CORS_ORIGINS: "https://app.dotly.one",
            REDIS_ENABLED: true,
            REDIS_URL: "redis://cache.dotly.one:6379",
            STORAGE_BUCKET: "dotly-prod",
            MAILGUN_API_KEY: "key-live-mailgun-secret-value",
            MAILGUN_DOMAIN: "mg.dotly.one",
            MAIL_FROM_EMAIL: "noreply@dotly.one",
            FRONTEND_VERIFICATION_URL_BASE: "https://app.dotly.one/verify-email",
            FRONTEND_PASSWORD_RESET_URL_BASE: "https://app.dotly.one/reset-password",
            TWILIO_ACCOUNT_SID: "",
            TWILIO_AUTH_TOKEN: "",
            TWILIO_FROM_PHONE_NUMBER: "",
            QR_BASE_URL: "https://app.dotly.one/q",
          }),
        /TRUST_PROXY must be set explicitly in production/i,
      );
    });
        assert.match(String(error), /CORS_ORIGINS must list at least one trusted HTTPS frontend origin|CORS_ORIGINS must use HTTPS/i);
        assert.match(String(error), /MAILGUN_API_KEY is required in production/i);
        assert.match(String(error), /FRONTEND_VERIFICATION_URL_BASE must use HTTPS in production/i);
        return true;
      },
    );
  });

  it("rejects partial provider configuration in non-production environments", () => {
    assert.throws(
      () =>
        validateEnvironment({
          NODE_ENV: "development",
          PORT: 3000,
          DATABASE_URL: "postgresql://localhost/dotly",
          JWT_SECRET: "development-secret-value",
          JWT_EXPIRES_IN: "7d",
          JWT_ISSUER: "dotly-backend",
          JWT_AUDIENCE: "dotly-clients",
          CORS_ORIGINS: "http://localhost:3001",
          REDIS_ENABLED: true,
          REDIS_URL: "redis://localhost:6379",
          STORAGE_BUCKET: "dotly-local",
          MAILGUN_API_KEY: "",
          MAILGUN_DOMAIN: "",
          MAIL_FROM_EMAIL: "",
          FRONTEND_VERIFICATION_URL_BASE: "",
          FRONTEND_PASSWORD_RESET_URL_BASE: "",
          TWILIO_ACCOUNT_SID: "AC1234567890123456789012345678901-invalid",
          TWILIO_AUTH_TOKEN: "",
          TWILIO_FROM_PHONE_NUMBER: "",
          QR_BASE_URL: "https://dotly.id/q",
        }),
      /SMS delivery requires the Twilio account SID, auth token, and sender phone number to be configured together/i,
    );
  });
});