import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { MediaService } from "./media.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfigService } from "../config/config.service";
import { ThumbnailsQueue } from "./thumbnails.queue";

describe("MediaService (albumId filter)", () => {
  let service: MediaService;

  const mockPrisma: any = {
    album: {
      findUnique: jest.fn(),
    },
    albumItem: {
      findMany: jest.fn(),
    },
    media: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockStorage: any = {
    supportsMultipartUpload: jest.fn(() => false),
  };

  const mockConfig: any = {};

  const mockThumbnailsQueue: any = {
    enqueueVerify: jest.fn(),
    ensureScanPendingRepeatable: jest.fn(),
  };

  const makeMedia = (overrides: Partial<any> = {}) => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    return {
      id: overrides.id ?? "media-1",
      userId: overrides.userId ?? "user-1",
      type: overrides.type ?? "PHOTO",
      objectKey: overrides.objectKey ?? "obj-1",
      byteSize: overrides.byteSize ?? BigInt(123),
      contentType: overrides.contentType ?? "application/octet-stream",
      encAlgo: overrides.encAlgo ?? "xchacha20poly1305",
      encMeta: overrides.encMeta ?? { v: 1 },
      thumbObjectKey: null,
      thumbByteSize: null,
      thumbContentType: null,
      thumbEncMeta: null,
      thumbUploadedAt: null,
      originalFilename: null,
      sha256Ciphertext: null,
      exifTakenAt: null,
      exifLat: null,
      exifLng: null,
      title: null,
      note: null,
      takenAt: overrides.takenAt ?? null,
      locationText: null,
      isTrashed: overrides.isTrashed ?? false,
      trashedAt: null,
      purgeAfter: null,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
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
  });

  it("returns album media ordered by position with cursor pagination", async () => {
    mockPrisma.album.findUnique.mockResolvedValue({
      id: "album-1",
      userId: "user-1",
    });

    mockPrisma.albumItem.findMany.mockResolvedValue([
      {
        albumId: "album-1",
        userId: "user-1",
        mediaId: "m1",
        position: BigInt(10),
        addedAt: new Date("2024-01-01T00:00:00.000Z"),
        media: makeMedia({ id: "m1" }),
      },
      {
        albumId: "album-1",
        userId: "user-1",
        mediaId: "m2",
        position: BigInt(20),
        addedAt: new Date("2024-01-01T00:00:00.000Z"),
        media: makeMedia({ id: "m2" }),
      },
      {
        albumId: "album-1",
        userId: "user-1",
        mediaId: "m3",
        position: BigInt(30),
        addedAt: new Date("2024-01-01T00:00:00.000Z"),
        media: makeMedia({ id: "m3" }),
      },
    ]);

    const res = await service.listMedia("user-1", {
      albumId: "album-1",
      limit: 2,
    });

    expect(res.items.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(res.hasMore).toBe(true);
    expect(res.nextCursor).toBe("20,m2");

    expect(mockPrisma.albumItem.findMany).toHaveBeenCalledTimes(1);
    const args = mockPrisma.albumItem.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ position: "asc" }, { mediaId: "asc" }]);
    expect(args.take).toBe(3);
  });

  it("enforces album ownership (404 if missing, 403 if not owned)", async () => {
    mockPrisma.album.findUnique.mockResolvedValue(null);

    await expect(
      service.listMedia("user-1", { albumId: "album-missing" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    mockPrisma.album.findUnique.mockResolvedValue({
      id: "album-2",
      userId: "someone-else",
    });

    await expect(
      service.listMedia("user-1", { albumId: "album-2" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("applies includeTrashed and from/to filters in the Prisma query", async () => {
    mockPrisma.album.findUnique.mockResolvedValue({
      id: "album-1",
      userId: "user-1",
    });

    mockPrisma.albumItem.findMany.mockResolvedValue([]);

    const from = new Date("2020-01-01T00:00:00.000Z");
    const to = new Date("2020-02-01T00:00:00.000Z");

    await service.listMedia("user-1", {
      albumId: "album-1",
      includeTrashed: false,
      from,
      to,
    });

    let args = mockPrisma.albumItem.findMany.mock.calls[0][0];
    expect(args.where.media.isTrashed).toBe(false);
    expect(args.where.media.takenAt).toEqual({ gte: from, lte: to });

    mockPrisma.albumItem.findMany.mockClear();

    await service.listMedia("user-1", {
      albumId: "album-1",
      includeTrashed: true,
      from,
      to,
    });

    args = mockPrisma.albumItem.findMany.mock.calls[0][0];
    expect(args.where.media.isTrashed).toBeUndefined();
    expect(args.where.media.takenAt).toEqual({ gte: from, lte: to });
  });

  it("rejects invalid album cursor", async () => {
    mockPrisma.album.findUnique.mockResolvedValue({
      id: "album-1",
      userId: "user-1",
    });

    await expect(
      service.listMedia("user-1", {
        albumId: "album-1",
        cursor: "not-a-valid-cursor",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.listMedia("user-1", {
        albumId: "album-1",
        cursor: "not-a-number,media-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
