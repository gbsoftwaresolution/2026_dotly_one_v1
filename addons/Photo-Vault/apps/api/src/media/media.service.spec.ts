import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { MediaService } from "./media.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfigService } from "../config/config.service";
import { HttpException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { AuditEventType } from "../audit/audit-event-types";
import { ApiErrorCode } from "../shared/api-error-codes";
import { ThumbnailsQueue } from "./thumbnails.queue";

describe("MediaService (recovery enforcement)", () => {
  let service: MediaService;

  const mockPrisma: any = {
    subscription: {
      findUnique: jest.fn(),
    },
    recoveryBundle: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    media: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStorage: any = {
    createSignedUploadUrl: jest.fn(),
    supportsMultipartUpload: jest.fn(() => false),
  };

  const mockConfig: any = {
    get disableUploads() {
      return false;
    },
    get recoveryTrialGraceUploads() {
      return 10;
    },
    get multipartPartSizeBytes() {
      return 8 * 1024 * 1024;
    },
    get multipartThresholdBytes() {
      return 64 * 1024 * 1024;
    },
  };

  const mockThumbnailsQueue: any = {
    enqueueVerify: jest.fn(),
    ensureScanPendingRepeatable: jest.fn(),
  };

  const baseSubscription = {
    userId: "user-1",
    status: SubscriptionStatus.ACTIVE,
    trialEndsAt: null,
    trialMediaLimit: 50,
    user: {
      usage: {
        totalMediaCount: BigInt(0),
      },
    },
  };

  const baseDto: any = {
    type: "PHOTO",
    byteSize: 123,
    contentType: "application/octet-stream",
    encAlgo: "xchacha20poly1305",
    encMeta: { v: 1 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ThumbnailsQueue, useValue: mockThumbnailsQueue },
      ],
    }).compile();

    service = module.get(MediaService);

    mockPrisma.subscription.findUnique.mockResolvedValue(baseSubscription);

    // Default to recovery enabled unless a test overrides it.
    mockPrisma.recoveryBundle.findUnique.mockResolvedValue({ id: "rb-1" });
    mockPrisma.user.findUnique.mockResolvedValue({
      acceptedVaultRecoveryRiskAt: null,
    });

    mockStorage.createSignedUploadUrl.mockResolvedValue({
      url: "https://example.com/upload",
      headers: {},
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      method: "PUT",
    });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        media: {
          create: jest.fn().mockImplementation(async (args: any) => {
            const data = args?.data ?? {};
            return {
              id: data.id ?? "media-1",
              userId: data.userId ?? "user-1",
              type: data.type ?? "PHOTO",
              objectKey: data.objectKey ?? "ok",
              byteSize: BigInt(data.byteSize ?? 123),
              contentType: data.contentType ?? "application/octet-stream",
              encAlgo: data.encAlgo ?? "xchacha20poly1305",
              encMeta: data.encMeta ?? { v: 1 },
              thumbObjectKey: data.thumbObjectKey ?? null,
              thumbByteSize: data.thumbByteSize ?? null,
              thumbContentType: data.thumbContentType ?? null,
              thumbEncMeta: data.thumbEncMeta ?? null,
              thumbUploadedAt: data.thumbUploadedAt ?? null,
              originalFilename: data.originalFilename ?? null,
              sha256Ciphertext: data.sha256Ciphertext ?? null,
              exifTakenAt: data.exifTakenAt ?? null,
              exifLat: data.exifLat ?? null,
              exifLng: data.exifLng ?? null,
              title: data.title ?? null,
              note: data.note ?? null,
              takenAt: data.takenAt ?? null,
              locationText: data.locationText ?? null,
              uploadedAt: null,
              isTrashed: false,
              trashedAt: null,
              purgeAfter: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }),
        },
        auditEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      return fn(tx);
    });
  });

  it("blocks upload intent when recovery disabled and risk not accepted", async () => {
    mockPrisma.recoveryBundle.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      acceptedVaultRecoveryRiskAt: null,
    });

    await expect(
      service.createUploadIntent("user-1", baseDto, "req-123"),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await service.createUploadIntent("user-1", baseDto, "req-123");
    } catch (err: any) {
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse()).toEqual({
        code: ApiErrorCode.RECOVERY_REQUIRED,
        message:
          "Recovery phrase is not enabled. Enable recovery or explicitly accept the risk before uploading.",
        requestId: "req-123",
      });
    }

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: AuditEventType.UPLOAD_BLOCKED_RECOVERY_REQUIRED,
        entityType: "MEDIA",
        entityId: null,
        meta: { requestId: "req-123" },
      },
    });
  });

  it("allows upload intent when recovery is enabled", async () => {
    mockPrisma.recoveryBundle.findUnique.mockResolvedValue({ id: "rb-1" });

    const res = await service.createUploadIntent("user-1", baseDto, "req-123");
    expect(typeof res.media.id).toBe("string");
    expect(res.media.id.length).toBeGreaterThan(5);
  });

  it("allows upload intent when risk is accepted", async () => {
    mockPrisma.recoveryBundle.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      acceptedVaultRecoveryRiskAt: new Date(),
    });

    const res = await service.createUploadIntent("user-1", baseDto, "req-123");
    expect(typeof res.media.id).toBe("string");
    expect(res.media.id.length).toBeGreaterThan(5);
  });

  it("allows upload intent under TRIAL grace uploads even without recovery", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      ...baseSubscription,
      status: SubscriptionStatus.TRIAL,
      user: { usage: { totalMediaCount: BigInt(0) } },
    });

    mockPrisma.recoveryBundle.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      acceptedVaultRecoveryRiskAt: null,
    });

    const res = await service.createUploadIntent("user-1", baseDto, "req-123");
    expect(typeof res.media.id).toBe("string");
    expect(res.media.id.length).toBeGreaterThan(5);
  });

  it("allows non-Tier1 DOCUMENT uploads (Tier-2 opaque blob)", async () => {
    const dto = {
      ...baseDto,
      type: "DOCUMENT",
      contentType: "application/x-msdownload",
      originalFilename: "malware.exe",
    };

    const res = await service.createUploadIntent("user-1", dto, "req-123");
    expect(res.media.type).toBe("DOCUMENT");
  });

  it("allows Tier1 DOCUMENT uploads by filename extension even if contentType is generic", async () => {
    const dto = {
      ...baseDto,
      type: "DOCUMENT",
      contentType: "application/octet-stream",
      originalFilename: "file.pdf",
    };

    const res = await service.createUploadIntent("user-1", dto, "req-123");
    expect(res.media.type).toBe("DOCUMENT");
  });

  it("allows Tier1 DOCUMENT uploads when contentType includes parameters (e.g., charset)", async () => {
    const dto = {
      ...baseDto,
      type: "DOCUMENT",
      contentType: "text/plain; charset=utf-8",
      originalFilename: "note.txt",
    };

    const res = await service.createUploadIntent("user-1", dto, "req-123");
    expect(res.media.type).toBe("DOCUMENT");
  });
});
