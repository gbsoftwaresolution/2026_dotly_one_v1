import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import pino from "pino";
import { LoggerService } from "./logger/logger.service";
import express from "express";

// In development, tools/libraries can stack multiple process exit/signal listeners
// (especially under watch mode). Avoid noisy MaxListenersExceededWarning logs.
if (process.env.NODE_ENV === "development") {
  const currentMax = process.getMaxListeners();
  if (currentMax < 25) process.setMaxListeners(25);
}

async function bootstrap() {
  const bootstrapLogger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });

  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

  try {
    app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      // We need per-route raw body support for Stripe webhook signature verification.
      // Nest's default JSON parser would consume the stream and prevent Stripe verification.
      bodyParser: false,
    });

    const logger = await app.resolve(LoggerService);
    app.useLogger(logger);

    const envOrigins = (process.env.WEB_ORIGIN ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allowedOrigins =
      envOrigins.length > 0
        ? envOrigins
        : ["http://localhost:3000", "http://127.0.0.1:3000"];

    // Enable trust proxy for X-Forwarded-* headers (if behind proxy)
    if (process.env.NODE_ENV === "production") {
      // Get underlying Express instance
      const expressApp = app.getHttpAdapter().getInstance();
      expressApp.set("trust proxy", true);
    }

    // Security middleware
    // Note: This API is consumed by the web app and also exposes some public endpoints (e.g. sharing).
    // We keep a strict security header posture while avoiding breaking local development.
    app.use(
      helmet({
        // We set a CSP below explicitly. Helmet defaults may change across versions.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // Enable HSTS only in production.
        hsts:
          process.env.NODE_ENV === "production"
            ? {
                maxAge: 15552000, // 180 days
                includeSubDomains: true,
                preload: true,
              }
            : false,
        referrerPolicy: { policy: "no-referrer" },
        xssFilter: false, // deprecated; modern browsers ignore
      }),
    );

    // CSP: mostly relevant when the API is hit directly from a browser (e.g. error pages, swagger, etc.).
    // Still valuable to reduce risk on any HTML responses.
    // We use a strict default policy and allow only what we need.
    app.use(
      helmet.contentSecurityPolicy({
        useDefaults: true,
        directives: {
          // Lock down everything by default.
          defaultSrc: ["'none'"],

          // This service returns JSON; we don't intentionally serve scripts/styles.
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          fontSrc: ["'none'"],

          // Allow browser XHR/fetch to this API from the web origin.
          connectSrc: ["'self'", ...allowedOrigins],

          // No framing.
          frameAncestors: ["'none'"],

          // Block mixed content upgrades where possible.
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      }),
    );

    // CORS
    app.enableCors({
      origin: (origin, callback) => {
        // Allow non-browser clients (no Origin header).
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`), false);
      },
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Body parsing
    // - Stripe webhook requires the raw request body bytes for signature verification.
    // - All other routes should keep normal JSON parsing.
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
      "/v1/billing/stripe/webhook",
      express.raw({ type: "application/json" }),
    );

    const jsonParser = express.json({ limit: "1mb" });
    expressApp.use((req: any, res: any, next: any) => {
      // Ensure the Stripe webhook route is not JSON-parsed.
      const url: string = req?.originalUrl ?? "";
      if (
        req?.method === "POST" &&
        (url === "/v1/billing/stripe/webhook" ||
          url.startsWith("/v1/billing/stripe/webhook?"))
      ) {
        return next();
      }
      return jsonParser(req, res, next);
    });

    // Global prefix
    app.setGlobalPrefix("v1");

    // Start server
    const port = parseInt(process.env.PORT || "4000", 10);
    await app.listen(port);
    logger.log({ msg: "Booster Vault API listening", port });
  } catch (err) {
    if (app) {
      try {
        const logger = await app.resolve(LoggerService);
        logger.fatal({ msg: "Failed to start application", err });
      } catch {
        bootstrapLogger.fatal({ msg: "Failed to start application", err });
      }
    } else {
      bootstrapLogger.fatal({ msg: "Failed to start application", err });
    }

    process.exit(1);
  }
}

void bootstrap();
