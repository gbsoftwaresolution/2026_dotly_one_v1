import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { LoggerService } from "../logger/logger.service";
import {
  ExportScopeType,
  ExportStatus,
  ExportResponse,
  PaginatedExportsResponse,
  ExportManifest,
  ExportManifestItem,
  ExportDownloadUrlResponse,
} from "@booster-vault/shared";
import { CreateExportDto } from "@booster-vault/shared";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { ExportsQueue } from "./exports.queue";

@Injectable()
export class ExportsService {
  private readonly exportTtlDays: number;
  private readonly maxActiveJobsPerUser: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly logger: LoggerService,
    private readonly exportsQueue: ExportsQueue,
  ) {
    this.exportTtlDays = this.configService.exportTtlDays;
    this.maxActiveJobsPerUser = this.configService.exportMaxActiveJobsPerUser;
  }

  /**
   * List exports for a user with pagination
   */
  async listExports(
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
    },
  ): Promise<PaginatedExportsResponse> {
    const { limit = 50, cursor } = options;

    const where: any = {
      userId,
      ...(cursor && { id: { lt: cursor } }), // cursor pagination by id
    };

    const exports = await this.prisma.export.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit + 1, // Fetch one extra to check if there's more
    });

    const hasMore = exports.length > limit;
    const items = hasMore ? exports.slice(0, limit) : exports;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return {
      items: items.map((exp) => this.mapExportToResponse(exp)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get a single export
   */
  async getExport(userId: string, exportId: string): Promise<ExportResponse> {
    const exp = await this.prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exp) {
      throw new NotFoundException("Export not found");
    }

    if (exp.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this export");
    }

    return this.mapExportToResponse(exp);
  }

  /**
   * Delete (cancel) an export job.
   * If the export has already produced an output object, we attempt to delete it.
   */
  async deleteExport(userId: string, exportId: string): Promise<void> {
    const exp = await this.prisma.export.findUnique({
      where: { id: exportId },
      select: {
        id: true,
        userId: true,
        status: true,
        outputObjectKey: true,
      },
    });

    if (!exp) {
      throw new NotFoundException("Export not found");
    }

    if (exp.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this export");
    }

    if (exp.outputObjectKey) {
      try {
        await this.storageService.deleteObject(exp.outputObjectKey);
      } catch (err: any) {
        this.logger.warn(
          `Failed to delete storage object for export ${exportId}: ${String(err?.message || err)}`,
        );
      }
    }

    await this.prisma.export.delete({
      where: { id: exportId },
    });

    // Best-effort audit: don't fail deletion if audit insert fails.
    try {
      await this.prisma.auditEvent.create({
        data: {
          userId,
          eventType: "EXPORT_DELETED",
          entityType: "EXPORT",
          entityId: exportId,
          meta: {
            previousStatus: exp.status,
          },
        },
      });
    } catch {
      // ignore
    }
  }

  /**
   * Create a new export job
   */
  async createExport(
    userId: string,
    dto: CreateExportDto,
    requestId?: string,
  ): Promise<ExportResponse> {
    // Check if exports are disabled via kill switch
    if (this.configService.disableExports) {
      throw new ForbiddenException(
        "Export operations are temporarily disabled for maintenance",
      );
    }

    // Validate constraints
    await this.validateExportCreation(userId, dto);

    // Calculate expiresAt based on TTL (when export will be auto-deleted)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.exportTtlDays);

    const exportJob = await this.prisma.$transaction(async (tx) => {
      // Check active job limit (QUEUED + RUNNING).
      // Important: jobs can get stuck if the worker is down/crashed. We treat
      // long-stale active jobs as FAILED so they don't block new exports forever.
      const stuckThresholdMinutes =
        this.configService.exportWorkerStuckThresholdMinutes;
      const staleBefore = new Date(
        Date.now() - stuckThresholdMinutes * 60 * 1000,
      );

      const staleActive =
        (await tx.export.findMany({
        where: {
          userId,
          status: { in: [ExportStatus.QUEUED, ExportStatus.RUNNING] },
          updatedAt: { lt: staleBefore },
        },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
        orderBy: [{ updatedAt: "asc" }],
        take: 25,
        })) ?? [];

      if (staleActive.length > 0) {
        await tx.export.updateMany({
          where: {
            userId,
            id: { in: staleActive.map((e) => e.id) },
          },
          data: {
            status: ExportStatus.FAILED,
            errorMessage: `Marked as stale after ${stuckThresholdMinutes} minutes without progress.`,
          },
        });

        // Best-effort audit: don't block export creation if audit insert fails.
        try {
          await tx.auditEvent.createMany({
            data: staleActive.map((e) => ({
              userId,
              eventType: "EXPORT_MARKED_STALE",
              entityType: "EXPORT",
              entityId: e.id,
              meta: {
                previousStatus: e.status,
                staleBefore,
                stuckThresholdMinutes,
              },
            })),
          });
        } catch {
          // ignore
        }
      }

      const activeJobs =
        (await tx.export.findMany({
        where: {
          userId,
          status: { in: [ExportStatus.QUEUED, ExportStatus.RUNNING] },
          // Only count jobs that have been updated recently enough to plausibly be active.
          updatedAt: { gte: staleBefore },
        },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
        orderBy: [{ createdAt: "desc" }],
        take: this.maxActiveJobsPerUser + 5,
        })) ?? [];

      if (activeJobs.length >= this.maxActiveJobsPerUser) {
        throw new ConflictException({
          message: `Maximum ${this.maxActiveJobsPerUser} active export jobs allowed per user. Please wait for existing jobs to complete.`,
          maxActiveJobsPerUser: this.maxActiveJobsPerUser,
          activeJobs,
        });
      }

      // Create export record
      const exp = await tx.export.create({
        data: {
          userId,
          scopeType: dto.scopeType,
          scopeAlbumId: dto.scopeAlbumId,
          scopeFrom: dto.scopeFrom,
          scopeTo: dto.scopeTo,
          status: ExportStatus.QUEUED,
          expiresAt,
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          userId,
          eventType: "EXPORT_CREATED",
          entityType: "EXPORT",
          entityId: exp.id,
          meta: {
            scopeType: dto.scopeType,
            scopeAlbumId: dto.scopeAlbumId,
            scopeFrom: dto.scopeFrom,
            scopeTo: dto.scopeTo,
          },
        },
      });

      return exp;
    });

    // Enqueue asynchronous processing (idempotent jobId=exportId)
    await this.exportsQueue.enqueueRun({
      exportId: exportJob.id,
      userId,
      requestId,
    });

    return this.mapExportToResponse(exportJob);
  }

  /**
   * BullMQ entrypoint: process a specific export idempotently.
   */
  async processExportJobQueued(args: {
    exportId: string;
    userId: string;
    requestId?: string;
    attempt?: number;
  }): Promise<void> {
    const log = this.logger.child({
      component: "exports-service",
      requestId: args.requestId,
      exportId: args.exportId,
      userId: args.userId,
    });

    const exp = await this.prisma.export.findUnique({
      where: { id: args.exportId },
    });
    if (!exp) {
      // Nothing to do; treat as idempotent success.
      log.warn("Export not found; skipping");
      return;
    }

    if (exp.userId !== args.userId) {
      // Defensive: never process another user's export.
      log.error({ ownerUserId: exp.userId }, "Export ownership mismatch");
      await this.markExportFailed(args.exportId, "Export ownership mismatch");
      return;
    }

    if (exp.status === ExportStatus.READY) {
      log.log("Export already READY; skipping");
      return;
    }

    if (exp.status === ExportStatus.EXPIRED) {
      log.log("Export already EXPIRED; skipping");
      return;
    }

    // Lease/claim: allow retry takeover if RUNNING is stale.
    const stuckThresholdMinutes =
      this.configService.exportWorkerStuckThresholdMinutes;
    const staleBefore = new Date(
      Date.now() - stuckThresholdMinutes * 60 * 1000,
    );

    const attempt =
      typeof args.attempt === "number" && Number.isFinite(args.attempt)
        ? args.attempt
        : 1;

    const claimResult = await this.prisma.export.updateMany({
      where: {
        id: args.exportId,
        userId: args.userId,
        OR: [
          { status: ExportStatus.QUEUED },
          { status: ExportStatus.FAILED },
          // If BullMQ retries a job that previously got stuck mid-flight, allow reprocessing.
          // Also allow takeover if the RUNNING lease is stale.
          ...(attempt > 1
            ? [{ status: ExportStatus.RUNNING }]
            : [
                {
                  status: ExportStatus.RUNNING,
                  updatedAt: { lt: staleBefore },
                },
              ]),
        ],
      },
      data: {
        status: ExportStatus.RUNNING,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    if (claimResult.count === 0) {
      // Another worker is likely running it, or it has already completed/expired.
      // Treat as idempotent success so we don't burn retries.
      log.warn({ status: exp.status }, "Export not claimable; skipping");
      return;
    }

    await this.processExportJob(args.exportId);
  }

  /**
   * Generate a signed download URL for a READY export
   */
  async createDownloadUrl(
    userId: string,
    exportId: string,
  ): Promise<ExportDownloadUrlResponse> {
    const exp = await this.prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exp) {
      throw new NotFoundException("Export not found");
    }

    if (exp.userId !== userId) {
      throw new ForbiddenException("Not authorized to access this export");
    }

    if (exp.status !== ExportStatus.READY) {
      throw new BadRequestException(
        `Export is not ready for download. Current status: ${exp.status}`,
      );
    }

    if (!exp.outputObjectKey) {
      throw new BadRequestException("Export has no output file");
    }

    const createdAt = exp.createdAt instanceof Date ? exp.createdAt : new Date();
    const ts = createdAt
      .toISOString()
      .replace(/\..+Z$/, "Z")
      .replace("T", "_")
      .replace(/:/g, "-");

    const scopeLabel =
      exp.scopeType === ExportScopeType.ALBUM
        ? "album"
        : exp.scopeType === ExportScopeType.DATE_RANGE
          ? "date-range"
          : "vault";

    const filename = `booster-vault-export-${scopeLabel}-${ts}.zip`;

    // Check if export is expired
    if (exp.expiresAt && exp.expiresAt < new Date()) {
      // Update status to EXPIRED
      await this.prisma.export.update({
        where: { id: exportId },
        data: { status: ExportStatus.EXPIRED },
      });
      throw new BadRequestException("Export has expired");
    }

    const downloadUrl = await this.storageService.createSignedDownloadUrl(
      exp.outputObjectKey,
      {
        filename,
        contentType: "application/zip",
        disposition: "attachment",
      },
    );

    return {
      url: downloadUrl.url,
      headers: downloadUrl.headers,
      expiresAt: downloadUrl.expiresAt,
      method: "GET",
    };
  }

  /**
   * Get media items for an export scope
   */
  async getExportMediaItems(userId: string, exportId: string): Promise<any[]> {
    const exp = await this.prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exp || exp.userId !== userId) {
      throw new NotFoundException("Export not found");
    }

    const where: any = {
      userId,
      isTrashed: false,
      uploadedAt: { not: null },
    };

    switch (exp.scopeType) {
      case ExportScopeType.ALBUM:
        if (!exp.scopeAlbumId) {
          throw new BadRequestException(
            "Missing scopeAlbumId for ALBUM export",
          );
        }
        // Get media items via AlbumItem join
        return await this.prisma.media.findMany({
          where: {
            userId,
            isTrashed: false,
            uploadedAt: { not: null },
            albumItems: {
              some: {
                albumId: exp.scopeAlbumId,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

      case ExportScopeType.DATE_RANGE:
        if (!exp.scopeFrom || !exp.scopeTo) {
          throw new BadRequestException(
            "Missing date range for DATE_RANGE export",
          );
        }
        where.OR = [
          { takenAt: { gte: exp.scopeFrom, lt: exp.scopeTo } },
          {
            takenAt: null,
            createdAt: { gte: exp.scopeFrom, lt: exp.scopeTo },
          },
        ];
        break;

      case ExportScopeType.VAULT:
      default:
        // All non-trashed media
        break;
    }

    return await this.prisma.media.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Generate manifest for an export
   */
  async generateManifest(
    userId: string,
    exportId: string,
  ): Promise<ExportManifest> {
    const exp = await this.prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exp || exp.userId !== userId) {
      throw new NotFoundException("Export not found");
    }

    const mediaItems = await this.getExportMediaItems(userId, exportId);

    const manifestItems: ExportManifestItem[] = mediaItems.map((media) => ({
      mediaId: media.id,
      objectKey: media.objectKey,
      originalFilename: media.originalFilename || undefined,
      contentType: media.contentType,
      byteSize: Number(media.byteSize),
      encAlgo: media.encAlgo || undefined,
      encMeta: (media as any).encMeta ?? undefined,
      takenAt: media.takenAt || undefined,
      locationText: media.locationText || undefined,
      title: media.title || undefined,
      note: media.note || undefined,
    }));

    const manifest: ExportManifest = {
      exportId: exp.id,
      ownerUserId: exp.userId,
      createdAt: exp.createdAt,
      items: manifestItems,
    };

    // Include album info if scope is ALBUM
    if (exp.scopeType === ExportScopeType.ALBUM && exp.scopeAlbumId) {
      const album = await this.prisma.album.findUnique({
        where: { id: exp.scopeAlbumId },
      });
      if (album) {
        manifest.albums = [
          {
            albumId: album.id,
            name: album.name,
            description: album.description || undefined,
          },
        ];
      }
    }

    return manifest;
  }

  /**
   * Create ZIP archive for an export
   */
  private async createExportZip(
    _userId: string,
    exportId: string,
    mediaItems: any[],
    manifest: ExportManifest,
    outputObjectKey: string,
  ): Promise<number> {
    // Stream ZIP creation and upload (ciphertext-only; no decryption)
    const archive = archiver("zip", { zlib: { level: 6 } });
    const out = new PassThrough();

    archive.on("error", (err) => {
      this.logger.error(`Archive error for export ${exportId}: ${err.message}`);
      out.destroy(err);
    });

    archive.pipe(out);

    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    });

    for (const media of mediaItems) {
      const filePath = `ciphertext/${media.id}.bin`;
      this.logger.debug(
        `Adding ciphertext stream for media ${media.id} to export ${exportId}`,
      );
      const ciphertextStream = await this.storageService.getObjectStream(
        media.objectKey,
      );
      archive.append(ciphertextStream as unknown as Readable, {
        name: filePath,
      });
    }

    // Finalize after appending all entries
    const finalizePromise = archive.finalize();
    const uploadResult = await this.storageService.putObjectStream({
      objectKey: outputObjectKey,
      contentType: "application/zip",
      body: out,
    });

    await finalizePromise;
    this.logger.debug(
      `Uploaded export ${exportId} ZIP to ${outputObjectKey} (${uploadResult.byteSize} bytes)`,
    );
    return uploadResult.byteSize;
  }

  /**
   * Process a single export job (called by worker)
   */
  async processExportJob(exportId: string): Promise<void> {
    let exportRecord = await this.prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      this.logger.error(`Export job ${exportId} not found`);
      return;
    }

    // Create child logger with export context
    const exportLogger = this.logger.child({
      exportId,
      userId: exportRecord.userId,
      component: "export-run",
    });
    exportLogger.log(
      `Processing export ${exportId} for user ${exportRecord.userId}`,
    );

    // Wrap the entire export processing with a timeout
    const timeoutMs = this.configService.exportDownloadTimeout * 1000;
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `Export processing timed out after ${this.configService.exportDownloadTimeout} seconds`,
          ),
        );
      }, timeoutMs);
    });

    try {
      // Get media items for this export
      const mediaItems = await this.getExportMediaItems(
        exportRecord.userId,
        exportId,
      );

      if (mediaItems.length === 0) {
        this.logger.warn(`Export ${exportId} has no media items to export`);
        // Still create a ZIP with just manifest
      }

      // Generate manifest
      const manifest = await this.generateManifest(
        exportRecord.userId,
        exportId,
      );

      // Generate output object key
      const outputObjectKey = `u/${exportRecord.userId}/exports/${exportId}.zip`;

      // Create ZIP and upload to storage with timeout
      const outputByteSize = await Promise.race([
        this.createExportZip(
          exportRecord.userId,
          exportId,
          mediaItems,
          manifest,
          outputObjectKey,
        ),
        timeoutPromise,
      ]);

      // Timer cleared in finally.

      // Update as READY (only if still RUNNING) so a later failed retry can't overwrite READY.
      const updated = await this.prisma.export.updateMany({
        where: { id: exportId, status: ExportStatus.RUNNING },
        data: {
          status: ExportStatus.READY,
          outputObjectKey,
          outputByteSize,
          readyAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const current = await this.prisma.export.findUnique({
          where: { id: exportId },
          select: { status: true },
        });
        exportLogger.warn(
          { status: current?.status },
          "Export marked READY skipped (status changed)",
        );
        return;
      }

      this.logger.log(
        `Export ${exportId} completed successfully (${mediaItems.length} items, ${outputByteSize} bytes)`,
      );
    } catch (error: any) {
      this.logger.error(
        `Export ${exportId} failed: ${error.message}`,
        error.stack,
      );
      // Mark FAILED only if still RUNNING so we don't overwrite READY.
      await this.prisma.export.updateMany({
        where: { id: exportId, status: ExportStatus.RUNNING },
        data: {
          status: ExportStatus.FAILED,
          errorMessage: String(error?.message || "Export failed").substring(
            0,
            500,
          ),
          updatedAt: new Date(),
        },
      });
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async markExportFailed(
    exportId: string,
    message: string,
  ): Promise<void> {
    try {
      await this.prisma.export.updateMany({
        where: {
          id: exportId,
          status: { notIn: [ExportStatus.READY, ExportStatus.EXPIRED] },
        },
        data: {
          status: ExportStatus.FAILED,
          errorMessage: (message || "Export failed").substring(0, 500),
          updatedAt: new Date(),
        },
      });
    } catch {
      // ignore secondary failure
    }
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const expiredExports = await this.prisma.export.findMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { not: ExportStatus.EXPIRED },
      },
      select: { id: true, outputObjectKey: true },
    });

    let cleanedCount = 0;
    for (const exp of expiredExports) {
      try {
        // Mark as EXPIRED
        await this.prisma.export.update({
          where: { id: exp.id },
          data: { status: ExportStatus.EXPIRED },
        });

        // Optionally delete storage object
        if (exp.outputObjectKey) {
          try {
            await this.storageService.deleteObject(exp.outputObjectKey);
          } catch (storageError) {
            this.logger.warn(
              `Failed to delete storage object for expired export ${exp.id}: ${storageError.message}`,
            );
          }
        }

        cleanedCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to cleanup export ${exp.id}: ${error.message}`,
        );
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired exports`);
    }

    return cleanedCount;
  }

  /**
   * Clean up stuck export jobs (RUNNING for too long)
   */
  async cleanupStuckExports(): Promise<number> {
    const stuckThresholdMinutes =
      this.configService.exportWorkerStuckThresholdMinutes;
    const stuckThresholdDate = new Date();
    stuckThresholdDate.setMinutes(
      stuckThresholdDate.getMinutes() - stuckThresholdMinutes,
    );

    const stuckExports = await this.prisma.export.findMany({
      where: {
        status: ExportStatus.RUNNING,
        updatedAt: { lt: stuckThresholdDate },
      },
      select: { id: true, userId: true, updatedAt: true },
    });

    let cleanedCount = 0;
    for (const exp of stuckExports) {
      try {
        // Mark as FAILED with appropriate error message
        await this.prisma.export.update({
          where: { id: exp.id },
          data: {
            status: ExportStatus.FAILED,
            errorMessage: `Job stuck in RUNNING state for more than ${stuckThresholdMinutes} minutes. Marked as failed by watchdog.`,
            updatedAt: new Date(),
          },
        });

        // Create audit event
        await this.prisma.auditEvent.create({
          data: {
            userId: exp.userId,
            eventType: "EXPORT_STUCK",
            entityType: "EXPORT",
            entityId: exp.id,
            meta: {
              stuckThresholdMinutes,
              lastUpdatedAt: exp.updatedAt,
            },
          },
        });

        this.logger.warn(
          `Marked stuck export ${exp.id} as FAILED (last updated: ${exp.updatedAt})`,
        );
        cleanedCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to cleanup stuck export ${exp.id}: ${error.message}`,
        );
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} stuck exports`);
    }

    return cleanedCount;
  }

  /**
   * Validate export creation parameters
   */
  private async validateExportCreation(
    userId: string,
    dto: CreateExportDto,
  ): Promise<void> {
    // Validate album ownership if ALBUM scope
    if (dto.scopeType === ExportScopeType.ALBUM && dto.scopeAlbumId) {
      const album = await this.prisma.album.findUnique({
        where: { id: dto.scopeAlbumId },
      });

      if (!album) {
        throw new NotFoundException("Album not found");
      }

      if (album.userId !== userId) {
        throw new ForbiddenException("Album does not belong to you");
      }

      if (album.isDeleted) {
        throw new BadRequestException("Cannot export a deleted album");
      }
    }

    // Validate date range if DATE_RANGE scope
    if (dto.scopeType === ExportScopeType.DATE_RANGE) {
      if (!dto.scopeFrom || !dto.scopeTo) {
        throw new BadRequestException(
          "Date range requires both from and to dates",
        );
      }

      if (dto.scopeFrom >= dto.scopeTo) {
        throw new BadRequestException("Date range from must be before to");
      }

      // Optional: limit max range (e.g., 1 year)
      const maxRangeDays = 365;
      const maxRangeMs = maxRangeDays * 24 * 60 * 60 * 1000;
      if (dto.scopeTo.getTime() - dto.scopeFrom.getTime() > maxRangeMs) {
        throw new BadRequestException(
          `Date range cannot exceed ${maxRangeDays} days`,
        );
      }
    }
  }

  /**
   * Map Prisma Export to API response
   */
  private mapExportToResponse(exp: any): ExportResponse {
    return {
      id: exp.id,
      userId: exp.userId,
      scopeType: exp.scopeType as ExportScopeType,
      scopeAlbumId: exp.scopeAlbumId || undefined,
      scopeFrom: exp.scopeFrom || undefined,
      scopeTo: exp.scopeTo || undefined,
      status: exp.status as ExportStatus,
      errorMessage: exp.errorMessage || undefined,
      outputObjectKey: exp.outputObjectKey || undefined,
      outputByteSize: exp.outputByteSize
        ? Number(exp.outputByteSize)
        : undefined,
      readyAt: exp.readyAt || undefined,
      expiresAt: exp.expiresAt || undefined,
      createdAt: exp.createdAt,
      updatedAt: exp.updatedAt,
    };
  }
}
