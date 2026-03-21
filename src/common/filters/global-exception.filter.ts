import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

import { AppLoggerService } from "../../infrastructure/logging/logging.service";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const headers = request?.headers ?? {};
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const requestId = this.getHeaderValue(headers["x-request-id"]);
    const userAgent = this.getHeaderValue(headers["user-agent"]);

    if (typeof this.logger.errorWithMeta === "function") {
      this.logger.errorWithMeta(
        "Unhandled request exception",
        {
          method: request?.method,
          path: request?.url,
          status,
          requestId,
          userAgent,
          message,
        },
        stack,
        "GlobalExceptionFilter",
      );
    } else {
      this.logger.error(
        `Unhandled exception on ${request?.method ?? "UNKNOWN"} ${request?.url ?? "UNKNOWN"}`,
        stack,
        "GlobalExceptionFilter",
      );
    }

    response.status(status).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url,
      requestId,
    });
  }

  private getHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }

  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return response;
      }

      if (
        typeof response === "object" &&
        response !== null &&
        "message" in response
      ) {
        const message = (response as { message?: string | string[] }).message;

        if (message) {
          return message;
        }
      }
    }

    return "Internal server error";
  }
}
