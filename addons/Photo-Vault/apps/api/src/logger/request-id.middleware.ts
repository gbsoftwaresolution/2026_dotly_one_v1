import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { LoggerService } from "./logger.service";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly loggerService: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    // Generate or use existing request ID
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    // Set request ID in request object
    (req as any).requestId = requestId;

    // Set request ID in response headers
    res.setHeader("X-Request-ID", requestId);

    // Create a child logger with request context
    const requestLogger = this.loggerService.child({
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Store logger in request for use in controllers/services
    (req as any).logger = requestLogger;

    // Log request start
    requestLogger.debug({ msg: "Request started" });

    const logCompletion = (event: "finish" | "close") => {
      const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      requestLogger.debug({
        msg: "Request completed",
        event,
        statusCode: res.statusCode,
        durationMs,
      });
    };

    res.once("finish", () => logCompletion("finish"));
    res.once("close", () => logCompletion("close"));

    next();
  }
}
