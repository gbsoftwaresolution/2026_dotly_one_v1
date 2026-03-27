import { randomUUID } from "node:crypto";

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NextFunction, Request, Response } from "express";

import { AppModule } from "./app.module";
import { createHttpSecurityHeadersMiddleware } from "./common/http-security";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import {
  getClientIpAddress,
  getForwardedProtocol,
  getHeaderValue,
} from "./common/utils/request-source.util";
import { CacheService } from "./infrastructure/cache/cache.service";
import { PrismaService } from "./infrastructure/database/prisma.service";
import { AppLoggerService } from "./infrastructure/logging/logging.service";
import { OperationalMetricsService } from "./infrastructure/logging/operational-metrics.service";
import { VerificationDiagnosticsService } from "./modules/auth/verification-diagnostics.service";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:/-]{1,128}$/;
let processObserversRegistered = false;

function resolveRequestId(request: Request): string {
  const requestIdHeader = getHeaderValue(request, "x-request-id");

  if (requestIdHeader && REQUEST_ID_PATTERN.test(requestIdHeader)) {
    return requestIdHeader;
  }

  return randomUUID();
}

function serializeUnknownError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  return {
    message: "Unknown error",
  };
}

function registerProcessObservers(
  logger: AppLoggerService,
  operationalMetricsService: OperationalMetricsService,
): void {
  if (processObserversRegistered) {
    return;
  }

  processObserversRegistered = true;

  process.on("unhandledRejection", (reason) => {
    operationalMetricsService.recordUnhandledException(
      "process_unhandled_rejection",
    );
    logger.errorWithMeta(
      "Unhandled promise rejection observed",
      {
        error: serializeUnknownError(reason),
      },
      reason instanceof Error ? reason.stack : undefined,
      "Process",
    );
  });

  process.on("uncaughtExceptionMonitor", (error, origin) => {
    operationalMetricsService.recordUnhandledException(
      "process_uncaught_exception",
    );
    logger.errorWithMeta(
      "Uncaught exception observed",
      {
        origin,
        error: serializeUnknownError(error),
      },
      error.stack,
      "Process",
    );
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  const cacheService = app.get(CacheService);
  const prismaService = app.get(PrismaService);
  const operationalMetricsService = app.get(OperationalMetricsService);
  const verificationDiagnosticsService = app.get(
    VerificationDiagnosticsService,
  );
  app.useLogger(logger);
  registerProcessObservers(logger, operationalMetricsService);
  app.setGlobalPrefix("v1");
  const configService = app.get(ConfigService);
  const port = configService.get<number>("app.port", 3000);
  const corsOrigins = configService.get<string[]>("app.corsOrigins", []);
  const trustProxy = configService.get<boolean | number | string>(
    "app.trustProxy",
    false,
  );
  const nodeEnv = configService.get<string>("app.nodeEnv", "development");
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.set("trust proxy", trustProxy);
  expressApp.disable("x-powered-by");

  app.use(createHttpSecurityHeadersMiddleware({ nodeEnv }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = resolveRequestId(request);

    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);

    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      operationalMetricsService.recordHttpRequest(
        request.method,
        response.statusCode,
        durationMs,
      );

      logger.logWithMeta(
        response.statusCode >= 500 ? "warn" : "log",
        "HTTP request completed",
        {
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode: response.statusCode,
          requestId: response.getHeader("x-request-id"),
          protocol: getForwardedProtocol(request),
          clientIpPresent: Boolean(getClientIpAddress(request)),
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

  logger.logWithMeta(
    "log",
    "Starting Dotly backend",
    {
      port,
      corsOrigins,
      trustProxy,
      redisEnabled: cacheService.isEnabled(),
    },
    "Bootstrap",
  );

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        callback(null, corsOrigins.includes(origin));
      },
      credentials: false,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      exposedHeaders: ["x-request-id"],
      optionsSuccessStatus: 204,
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
