import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { Request as ExpressRequest } from "express";
import { Observable, of, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";

export interface IdempotencyConfig {
  /**
   * TTL in seconds for idempotency keys (default: 24 hours)
   */
  ttlSeconds: number;

  /**
   * Whether to allow concurrent requests with same key to proceed
   * (vs returning 409 Conflict).
   */
  allowConcurrent?: boolean;

  /**
   * Headers to include in request hash calculation
   */
  hashHeaders?: string[];
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * Normalizes request for consistent hashing.
 * We hash the combination of:
 * - HTTP method
 * - URL path (including route params)
 * - Sorted query parameters (if any)
 * - Request body (JSON stringified in deterministic order)
 */
function computeRequestHash(
  req: ExpressRequest,
  userId: string,
  endpoint: string,
  body: any,
): string {
  const hash = createHash("sha256");

  // Include method + endpoint (already includes path template)
  hash.update(`${req.method}:${endpoint}:${userId}`);

  // Include sorted query parameters if any
  const query = req.query;
  if (Object.keys(query).length > 0) {
    const sortedKeys = Object.keys(query).sort();
    for (const key of sortedKeys) {
      const value = query[key];
      hash.update(
        `${key}=${Array.isArray(value) ? value.sort().join(",") : value}`,
      );
    }
  }

  // Include request body (if present)
  if (body && Object.keys(body).length > 0) {
    // Stringify deterministically (sorted keys)
    const deterministicBody = JSON.stringify(body, Object.keys(body).sort());
    hash.update(deterministicBody);
  }

  return hash.digest("hex");
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly config: IdempotencyConfig;

  constructor(
    private readonly prisma: PrismaService,
    _configService: ConfigService,
  ) {
    this.config = {
      ttlSeconds:
        parseInt(process.env.IDEMPOTENCY_KEY_TTL_SECONDS || "", 10) ||
        DEFAULT_TTL_SECONDS,
      allowConcurrent: process.env.IDEMPOTENCY_ALLOW_CONCURRENT === "true",
      hashHeaders: [],
    };
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    const userId = (req as any).user?.sub;
    const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as
      | string
      | undefined;

    // If no idempotency key, proceed normally
    if (!idempotencyKey) {
      return next.handle();
    }

    // Must have authenticated user
    if (!userId) {
      this.logger.warn(
        `Idempotency-Key present but no user authenticated for ${req.method} ${req.path}`,
      );
      return next.handle();
    }

    const endpoint = this.buildEndpointTemplate(req);
    const requestHash = computeRequestHash(req, userId, endpoint, req.body);
    const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1000);

    try {
      // Attempt to create or retrieve existing key
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          userId_key_endpoint: {
            userId,
            key: idempotencyKey,
            endpoint,
          },
        },
      });

      if (existing) {
        // Check if request hash matches
        if (existing.requestHash !== requestHash) {
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message:
              "Idempotency key already used with different request parameters",
            existingRequestHash: existing.requestHash,
            providedRequestHash: requestHash,
          });
        }

        // Check status
        if (existing.status === "COMPLETED") {
          // Return stored response
          if (existing.responseCode && existing.responseBody) {
            const response = context.switchToHttp().getResponse();
            response.status(existing.responseCode);
            return of(existing.responseBody);
          } else {
            // Should not happen, but fallback
            this.logger.warn(
              `Idempotency key ${idempotencyKey} marked COMPLETED but missing response data`,
            );
          }
        } else if (existing.status === "IN_PROGRESS") {
          // Already in progress
          if (this.config.allowConcurrent) {
            // Allow concurrent execution (with caution)
            this.logger.debug(
              `Idempotency key ${idempotencyKey} already IN_PROGRESS, allowing concurrent execution`,
            );
          } else {
            throw new ServiceUnavailableException({
              code: "IDEMPOTENCY_KEY_IN_PROGRESS",
              message:
                "A previous request with this idempotency key is still processing",
              retryAfter: 5, // seconds
            });
          }
        }
      }

      // Create or update idempotency key as IN_PROGRESS
      await this.prisma.idempotencyKey.upsert({
        where: {
          userId_key_endpoint: {
            userId,
            key: idempotencyKey,
            endpoint,
          },
        },
        update: {
          status: "IN_PROGRESS",
          expiresAt,
        },
        create: {
          userId,
          key: idempotencyKey,
          endpoint,
          requestHash,
          status: "IN_PROGRESS",
          expiresAt,
        },
      });
    } catch (error) {
      // If it's a ConflictException or ServiceUnavailableException, rethrow
      if (
        error instanceof ConflictException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      // For other errors (e.g., DB issues), log and proceed without idempotency
      this.logger.error(
        `Idempotency key processing failed for ${idempotencyKey}: ${error.message}`,
        error.stack,
      );
      return next.handle();
    }

    // Process request and capture response
    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          await this.storeSuccessfulResponse(
            userId,
            idempotencyKey,
            endpoint,
            context,
            responseBody,
          );
        },
        error: async (error) => {
          await this.handleRequestError(
            userId,
            idempotencyKey,
            endpoint,
            error,
          );
        },
      }),
      catchError((error) => {
        // Rethrow the error after handling
        return throwError(() => error);
      }),
    );
  }

  /**
   * Build endpoint template from request (method + route path)
   * Example: "POST /v1/media/upload-intents"
   */
  private buildEndpointTemplate(req: ExpressRequest): string {
    return `${req.method} ${req.route?.path || req.path}`;
  }

  private async storeSuccessfulResponse(
    userId: string,
    key: string,
    endpoint: string,
    context: ExecutionContext,
    responseBody: any,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode;

    try {
      await this.prisma.idempotencyKey.update({
        where: {
          userId_key_endpoint: {
            userId,
            key,
            endpoint,
          },
        },
        data: {
          status: "COMPLETED",
          responseCode: statusCode,
          responseBody,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to store successful response for idempotency key ${key}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleRequestError(
    userId: string,
    key: string,
    endpoint: string,
    error: any,
  ): Promise<void> {
    // Decision: On handler error, we delete the idempotency key
    // so the client can retry with the same key.
    // Alternative: keep as IN_PROGRESS with error metadata.
    try {
      await this.prisma.idempotencyKey.delete({
        where: {
          userId_key_endpoint: {
            userId,
            key,
            endpoint,
          },
        },
      });
      this.logger.debug(
        `Deleted idempotency key ${key} due to handler error: ${error.message}`,
      );
    } catch (deleteError) {
      this.logger.error(
        `Failed to delete idempotency key ${key} after error: ${deleteError.message}`,
        deleteError.stack,
      );
    }
  }
}
