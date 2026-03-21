import { randomUUID } from "node:crypto";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NextFunction, Request, Response } from "express";

import { AppModule } from "./app.module";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import { CacheService } from "./infrastructure/cache/cache.service";
import { PrismaService } from "./infrastructure/database/prisma.service";
import { AppLoggerService } from "./infrastructure/logging/logging.service";
import { VerificationDiagnosticsService } from "./modules/auth/verification-diagnostics.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  const cacheService = app.get(CacheService);
  const prismaService = app.get(PrismaService);
  const verificationDiagnosticsService = app.get(VerificationDiagnosticsService);
  app.useLogger(logger);
  app.setGlobalPrefix("v1");
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestIdHeader = request.headers["x-request-id"];
    const requestId =
      typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
        ? requestIdHeader
        : randomUUID();

    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.logWithMeta(
        response.statusCode >= 500 ? "warn" : "log",
        "HTTP request completed",
        {
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode: response.statusCode,
          requestId: response.getHeader("x-request-id"),
          durationMs: Number(durationMs.toFixed(2)),
        },
        "HttpRequest",
      );
    });

    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>("app.port", 3000);
  const corsOrigins = configService.get<string[]>("app.corsOrigins", []);

  logger.logWithMeta(
    "log",
    "Starting Dotly backend",
    {
      port,
      corsOrigins,
      redisUrl: cacheService.getRedisUrl(),
    },
    "Bootstrap",
  );

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      exposedHeaders: ["x-request-id"],
    });
  }

  await prismaService.connect();
  try {
    const diagnostics =
      await verificationDiagnosticsService.getRuntimeDiagnostics();
    logger.logWithMeta(
      diagnostics.status === "ok" ? "log" : "warn",
      "Email verification runtime status",
      diagnostics,
      "Bootstrap",
    );
  } catch (error) {
    logger.errorWithMeta(
      "Unable to inspect email verification startup status",
      {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: "Unknown startup diagnostic error" },
      },
      error instanceof Error ? error.stack : undefined,
      "Bootstrap",
    );
  }
  await app.listen(port);
  void cacheService.ensureConnection();
  logger.logWithMeta(
    "log",
    "Dotly backend listening",
    {
      port,
      apiPrefix: "/v1",
    },
    "Bootstrap",
  );
}

void bootstrap();
