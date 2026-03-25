import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ExportsService } from "./exports.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { StorageService } from "../storage/storage.service";
import { LoggerService } from "../logger/logger.service";
import { ExportsQueue } from "./exports.queue";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import type { CreateExportDto } from "@booster-vault/shared";
import { ExportScopeType, ExportStatus } from "@booster-vault/shared";

// Mock archiver to avoid real zip creation in tests
jest.mock("archiver", () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    append: jest.fn(),
    finalize: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  }));
});

describe("ExportsService", () => {
  let service: ExportsService;
  let prisma: PrismaService;
  let config: ConfigService;
  let storage: StorageService;

  const mockPrisma = {
    export: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    album: {
      findUnique: jest.fn(),
    },
    media: {
      findMany: jest.fn(),
    },
    albumItem: {
      findMany: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
    $queryRaw: jest.fn(),
  };

  const mockConfig = {
    exportTtlDays: 7,
    exportMaxActiveJobsPerUser: 2,
    exportDownloadUrlTtlSeconds: 900,
    exportWorkerStuckThresholdMinutes: 30,
    disableExports: false,
  };

  const mockStorage = {
    createSignedDownloadUrl: jest.fn(),
    createSignedUploadUrl: jest.fn(),
    deleteObject: jest.fn(),
  };

  const mockLogger = {
    child: jest.fn().mockReturnThis(),
    setContext: jest.fn(),
    getContext: jest.fn().mockReturnValue({}),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };

  const mockExportsQueue = {
    enqueueRun: jest.fn(),
    ensureCleanupExpiredRepeatable: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: StorageService, useValue: mockStorage },
        { provide: LoggerService, useValue: mockLogger },
        { provide: ExportsQueue, useValue: mockExportsQueue },
      ],
    }).compile();

    service = module.get<ExportsService>(ExportsService);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);
    storage = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createExport", () => {
    const userId = "user-123";
    const baseDto: CreateExportDto = {
      scopeType: ExportScopeType.VAULT,
    };

    it("should create a vault export successfully", async () => {
      const dto = { ...baseDto };
      const mockExport = {
        id: "export-123",
        userId,
        scopeType: ExportScopeType.VAULT,
        scopeAlbumId: null,
        scopeFrom: null,
        scopeTo: null,
        status: ExportStatus.QUEUED,
        errorMessage: null,
        outputObjectKey: null,
        outputByteSize: null,
        readyAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1) staleActive check 2) activeJobs check
      mockPrisma.export.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.export.create.mockResolvedValue(mockExport);
      mockPrisma.auditEvent.create.mockResolvedValue({});

      const result = await service.createExport(userId, dto);

      expect(mockExportsQueue.enqueueRun).toHaveBeenCalledWith({
        exportId: mockExport.id,
        userId,
        requestId: undefined,
      });

      expect(mockPrisma.export.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.export.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: { in: [ExportStatus.QUEUED, ExportStatus.RUNNING] },
            updatedAt: { lt: expect.any(Date) },
          }),
        }),
      );
      expect(mockPrisma.export.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: { in: [ExportStatus.QUEUED, ExportStatus.RUNNING] },
            updatedAt: { gte: expect.any(Date) },
          }),
        }),
      );
      expect(mockPrisma.export.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          scopeType: ExportScopeType.VAULT,
          status: ExportStatus.QUEUED,
        }),
      });
      expect(result.id).toBe("export-123");
    });

    it("should create an album export with validation", async () => {
      const dto: CreateExportDto = {
        scopeType: ExportScopeType.ALBUM,
        scopeAlbumId: "album-123",
      };
      const mockExport = {
        id: "export-123",
        userId,
        scopeType: ExportScopeType.ALBUM,
        scopeAlbumId: "album-123",
        scopeFrom: null,
        scopeTo: null,
        status: ExportStatus.QUEUED,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-123",
        userId,
        isDeleted: false,
      });
      mockPrisma.export.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.export.create.mockResolvedValue(mockExport);
      mockPrisma.auditEvent.create.mockResolvedValue({});

      const result = await service.createExport(userId, dto);

      expect(mockPrisma.album.findUnique).toHaveBeenCalledWith({
        where: { id: "album-123" },
      });
      expect(mockPrisma.export.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopeType: ExportScopeType.ALBUM,
          scopeAlbumId: "album-123",
        }),
      });
      expect(result.scopeAlbumId).toBe("album-123");
    });

    it("should reject album export if album not found", async () => {
      const dto: CreateExportDto = {
        scopeType: ExportScopeType.ALBUM,
        scopeAlbumId: "album-123",
      };

      mockPrisma.album.findUnique.mockResolvedValue(null);

      await expect(service.createExport(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should reject album export if album belongs to another user", async () => {
      const dto: CreateExportDto = {
        scopeType: ExportScopeType.ALBUM,
        scopeAlbumId: "album-123",
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-123",
        userId: "other-user",
        isDeleted: false,
      });

      await expect(service.createExport(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should reject album export if album is deleted", async () => {
      const dto: CreateExportDto = {
        scopeType: ExportScopeType.ALBUM,
        scopeAlbumId: "album-123",
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-123",
        userId,
        isDeleted: true,
      });

      await expect(service.createExport(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create a date range export with validation", async () => {
      const scopeFrom = new Date("2024-01-01");
      const scopeTo = new Date("2024-01-31");
      const dto: CreateExportDto = {
        scopeType: ExportScopeType.DATE_RANGE,
        scopeFrom,
        scopeTo,
      };
      const mockExport = {
        id: "export-123",
        userId,
        scopeType: ExportScopeType.DATE_RANGE,
        scopeAlbumId: null,
        scopeFrom,
        scopeTo,
        status: ExportStatus.QUEUED,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.export.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.export.create.mockResolvedValue(mockExport);
      mockPrisma.auditEvent.create.mockResolvedValue({});

      const result = await service.createExport(userId, dto);

      expect(mockPrisma.export.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopeType: ExportScopeType.DATE_RANGE,
          scopeFrom,
          scopeTo,
        }),
      });
      expect(result.scopeType).toBe(ExportScopeType.DATE_RANGE);
    });

    it("should reject date range export with invalid range", async () => {
      const scopeFrom = new Date("2024-01-31");
      const scopeTo = new Date("2024-01-01");
      const dto: CreateExportDto = {
        scopeType: ExportScopeType.DATE_RANGE,
        scopeFrom,
        scopeTo,
      };

      await expect(service.createExport(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject when user has too many active jobs", async () => {
      const dto = { ...baseDto };

      mockPrisma.export.findMany
        .mockResolvedValueOnce([]) // staleActive
        .mockResolvedValueOnce([
          {
            id: "export-a",
            status: ExportStatus.QUEUED,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "export-b",
            status: ExportStatus.RUNNING,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]); // activeJobs at limit

      await expect(service.createExport(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("getExport", () => {
    const userId = "user-123";
    const exportId = "export-123";

    it("should return export if found and belongs to user", async () => {
      const mockExport = {
        id: exportId,
        userId,
        scopeType: ExportScopeType.VAULT,
        status: ExportStatus.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);

      const result = await service.getExport(userId, exportId);

      expect(mockPrisma.export.findUnique).toHaveBeenCalledWith({
        where: { id: exportId },
      });
      expect(result.id).toBe(exportId);
    });

    it("should throw NotFound if export not found", async () => {
      mockPrisma.export.findUnique.mockResolvedValue(null);

      await expect(service.getExport(userId, exportId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw Forbidden if export belongs to another user", async () => {
      const mockExport = {
        id: exportId,
        userId: "other-user",
        scopeType: ExportScopeType.VAULT,
        status: ExportStatus.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);

      await expect(service.getExport(userId, exportId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("listExports", () => {
    const userId = "user-123";

    it("should list exports with pagination", async () => {
      const mockExports = [
        {
          id: "export-1",
          userId,
          scopeType: ExportScopeType.VAULT,
          status: ExportStatus.QUEUED,
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "export-2",
          userId,
          scopeType: ExportScopeType.ALBUM,
          status: ExportStatus.READY,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      mockPrisma.export.findMany.mockResolvedValue(mockExports);

      const result = await service.listExports(userId, { limit: 50 });

      expect(mockPrisma.export.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: [{ createdAt: "desc" }],
          take: 51,
        }),
      );
      expect(result.items.length).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should handle cursor pagination", async () => {
      const cursor = "export-2";
      const mockExports = [
        {
          id: "export-1",
          userId,
          scopeType: ExportScopeType.VAULT,
          status: ExportStatus.QUEUED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.export.findMany.mockResolvedValue(mockExports);

      await service.listExports(userId, { cursor, limit: 1 });

      expect(mockPrisma.export.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            id: { lt: cursor },
          },
        }),
      );
    });
  });

  describe("createDownloadUrl", () => {
    const userId = "user-123";
    const exportId = "export-123";

    it("should generate signed URL for READY export", async () => {
      const mockExport = {
        id: exportId,
        userId,
        createdAt: new Date("2026-02-11T12:34:56.000Z"),
        scopeType: ExportScopeType.VAULT,
        status: ExportStatus.READY,
        outputObjectKey: "u/user-123/exports/export-123.zip",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // future
      };
      const mockSignedUrl = {
        url: "https://storage.example.com/presigned-url",
        headers: {},
        expiresAt: new Date(),
        method: "GET" as const,
      };

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);
      mockPrisma.export.update.mockResolvedValue({});
      mockStorage.createSignedDownloadUrl.mockResolvedValue(mockSignedUrl);

      const result = await service.createDownloadUrl(userId, exportId);

      expect(mockPrisma.export.findUnique).toHaveBeenCalledWith({
        where: { id: exportId },
      });
      expect(mockStorage.createSignedDownloadUrl).toHaveBeenCalledWith(
        "u/user-123/exports/export-123.zip",
        expect.objectContaining({
          filename: expect.stringMatching(/^booster-vault-export-vault-/),
          contentType: "application/zip",
          disposition: "attachment",
        }),
      );
      expect(result.url).toBe(mockSignedUrl.url);
    });

    it("should reject if export not READY", async () => {
      const mockExport = {
        id: exportId,
        userId,
        status: ExportStatus.QUEUED,
        outputObjectKey: null,
      };

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);

      await expect(service.createDownloadUrl(userId, exportId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject if export expired", async () => {
      const mockExport = {
        id: exportId,
        userId,
        status: ExportStatus.READY,
        outputObjectKey: "u/user-123/exports/export-123.zip",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // past
      };

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);
      mockPrisma.export.update.mockResolvedValue({});

      await expect(service.createDownloadUrl(userId, exportId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.export.update).toHaveBeenCalledWith({
        where: { id: exportId },
        data: { status: ExportStatus.EXPIRED },
      });
    });
  });

  describe("getExportMediaItems", () => {
    const userId = "user-123";
    const exportId = "export-123";

    it("should get media items for VAULT scope", async () => {
      const mockExport = {
        id: exportId,
        userId,
        scopeType: ExportScopeType.VAULT,
      };
      const mockMedia = [
        { id: "media-1", userId, isTrashed: false },
        { id: "media-2", userId, isTrashed: false },
      ];

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);
      mockPrisma.media.findMany.mockResolvedValue(mockMedia);

      const result = await service.getExportMediaItems(userId, exportId);

      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            isTrashed: false,
            uploadedAt: { not: null },
          },
        }),
      );
      expect(result.length).toBe(2);
    });

    it("should get media items for ALBUM scope", async () => {
      const mockExport = {
        id: exportId,
        userId,
        scopeType: ExportScopeType.ALBUM,
        scopeAlbumId: "album-123",
      };
      const mockMedia = [{ id: "media-1", userId, isTrashed: false }];

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);
      mockPrisma.media.findMany.mockResolvedValue(mockMedia);

      const result = await service.getExportMediaItems(userId, exportId);

      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            isTrashed: false,
            uploadedAt: { not: null },
            albumItems: {
              some: {
                albumId: "album-123",
              },
            },
          },
        }),
      );
    });

    it("should get media items for DATE_RANGE scope", async () => {
      const scopeFrom = new Date("2024-01-01");
      const scopeTo = new Date("2024-01-31");
      const mockExport = {
        id: exportId,
        userId,
        scopeType: ExportScopeType.DATE_RANGE,
        scopeFrom,
        scopeTo,
      };
      const mockMedia = [
        {
          id: "media-1",
          userId,
          isTrashed: false,
          takenAt: new Date("2024-01-15"),
        },
      ];

      mockPrisma.export.findUnique.mockResolvedValue(mockExport);
      mockPrisma.media.findMany.mockResolvedValue(mockMedia);

      const result = await service.getExportMediaItems(userId, exportId);

      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            isTrashed: false,
            uploadedAt: { not: null },
            OR: [
              { takenAt: { gte: scopeFrom, lt: scopeTo } },
              { takenAt: null, createdAt: { gte: scopeFrom, lt: scopeTo } },
            ],
          },
        }),
      );
    });
  });

  describe("cleanupExpiredExports", () => {
    it("should cleanup expired exports", async () => {
      const mockExports = [
        { id: "export-1", outputObjectKey: "key-1" },
        { id: "export-2", outputObjectKey: null },
      ];

      mockPrisma.export.findMany.mockResolvedValue(mockExports);
      mockPrisma.export.update.mockResolvedValue({});
      mockStorage.deleteObject.mockResolvedValue(undefined);

      const result = await service.cleanupExpiredExports();

      expect(mockPrisma.export.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          status: { not: ExportStatus.EXPIRED },
        },
        select: { id: true, outputObjectKey: true },
      });
      expect(mockPrisma.export.update).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });

    it("should handle storage deletion errors gracefully", async () => {
      const mockExports = [{ id: "export-1", outputObjectKey: "key-1" }];

      mockPrisma.export.findMany.mockResolvedValue(mockExports);
      mockPrisma.export.update.mockResolvedValue({});
      mockStorage.deleteObject.mockRejectedValue(new Error("Storage error"));

      const result = await service.cleanupExpiredExports();

      // Should still count as cleaned
      expect(result).toBe(1);
    });
  });
});
