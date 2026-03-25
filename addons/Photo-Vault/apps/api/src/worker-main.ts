import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "./worker-app.module";
import pino from "pino";
import { LoggerService } from "./logger/logger.service";

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

  let app:
    | Awaited<ReturnType<typeof NestFactory.createApplicationContext>>
    | undefined;

  try {
    app = await NestFactory.createApplicationContext(WorkerAppModule, {
      bufferLogs: true,
    });
    app.enableShutdownHooks();

    const logger = await app.resolve(LoggerService);
    logger.log({ msg: "Booster Vault workers started" });
  } catch (err) {
    if (app) {
      try {
        const logger = await app.resolve(LoggerService);
        logger.fatal({ msg: "Failed to start worker application", err });
      } catch {
        bootstrapLogger.fatal({
          msg: "Failed to start worker application",
          err,
        });
      }
    } else {
      bootstrapLogger.fatal({ msg: "Failed to start worker application", err });
    }

    process.exit(1);
  }
}

void bootstrap();
