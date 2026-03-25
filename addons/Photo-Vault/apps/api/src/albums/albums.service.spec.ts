import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AlbumsService } from "./albums.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  CreateAlbumDto,
  AddItemsDto,
  ReorderItemsDto,
} from "@booster-vault/shared";
import { UpdateAlbumDto } from "@booster-vault/shared";

describe("AlbumsService", () => {
  let service: AlbumsService;
  let prisma: PrismaService;

  const mockPrisma = {
    album: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    albumItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    media: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    userUsage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AlbumsService>(AlbumsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createAlbum", () => {
    it("should create an album successfully", async () => {
      const userId = "user-123";
      const dto: CreateAlbumDto = {
        name: "Test Album",
        description: "Test description",
      };
      const mockAlbum = {
        id: "album-123",
        userId,
        name: dto.name,
        description: dto.description,
        coverMediaId: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const tx = mockPrisma;
        return fn(tx);
      });
      mockPrisma.album.create.mockResolvedValue(mockAlbum);
      mockPrisma.auditEvent.create.mockResolvedValue({});

      const result = await service.createAlbum(userId, dto);

      expect(mockPrisma.album.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: dto.name,
          description: dto.description,
          coverMediaId: undefined,
        },
      });
      expect(result.id).toBe("album-123");
      expect(result.name).toBe("Test Album");
    });

    it("should validate cover media ownership", async () => {
      const userId = "user-123";
      const dto: CreateAlbumDto = {
        name: "Test Album",
        coverMediaId: "media-456",
      };

      mockPrisma.media.findUnique.mockResolvedValue({
        id: "media-456",
        userId: "different-user",
        isTrashed: false,
      });

      await expect(service.createAlbum(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should reject trashed cover media", async () => {
      const userId = "user-123";
      const dto: CreateAlbumDto = {
        name: "Test Album",
        coverMediaId: "media-456",
      };

      mockPrisma.media.findUnique.mockResolvedValue({
        id: "media-456",
        userId,
        isTrashed: true,
      });

      await expect(service.createAlbum(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("addItemsToAlbum", () => {
    it("should add items with incremental positions", async () => {
      const userId = "user-123";
      const albumId = "album-123";
      const dto: AddItemsDto = {
        mediaIds: ["media-1", "media-2"],
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: false,
      });

      mockPrisma.media.findMany.mockResolvedValue([
        { id: "media-1", userId, isTrashed: false },
        { id: "media-2", userId, isTrashed: false },
      ]);

      mockPrisma.albumItem.aggregate.mockResolvedValue({
        _max: { position: BigInt(5000) },
      });

      mockPrisma.albumItem.findMany.mockResolvedValue([]); // No existing items
      mockPrisma.albumItem.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.auditEvent.create.mockResolvedValue({});

      await service.addItemsToAlbum(userId, albumId, dto);

      expect(mockPrisma.albumItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            albumId,
            mediaId: "media-1",
            userId,
            position: BigInt(6000), // 5000 + 1000
          },
          {
            albumId,
            mediaId: "media-2",
            userId,
            position: BigInt(7000), // 5000 + 2000
          },
        ],
        skipDuplicates: true,
      });
    });

    it("should reject trashed media", async () => {
      const userId = "user-123";
      const albumId = "album-123";
      const dto: AddItemsDto = {
        mediaIds: ["media-1", "media-2"],
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: false,
      });

      mockPrisma.media.findMany.mockResolvedValue([
        { id: "media-1", userId, isTrashed: false },
        { id: "media-2", userId, isTrashed: true },
      ]);

      await expect(
        service.addItemsToAlbum(userId, albumId, dto),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("should ignore duplicates", async () => {
      const userId = "user-123";
      const albumId = "album-123";
      const dto: AddItemsDto = {
        mediaIds: ["media-1", "media-2"],
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: false,
      });

      mockPrisma.media.findMany.mockResolvedValue([
        { id: "media-1", userId, isTrashed: false },
        { id: "media-2", userId, isTrashed: false },
      ]);

      mockPrisma.albumItem.aggregate.mockResolvedValue({
        _max: { position: BigInt(1000) },
      });

      mockPrisma.albumItem.findMany.mockResolvedValue([{ mediaId: "media-1" }]);

      mockPrisma.albumItem.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.auditEvent.create.mockResolvedValue({});

      await service.addItemsToAlbum(userId, albumId, dto);

      // Should only create media-2
      expect(mockPrisma.albumItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            albumId,
            mediaId: "media-2",
            userId,
            position: BigInt(2000), // 1000 + 1000
          },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe("listAlbumItems", () => {
    it("should exclude trashed media by default", async () => {
      const userId = "user-123";
      const albumId = "album-123";

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
      });

      mockPrisma.albumItem.findMany.mockResolvedValue([]);

      await service.listAlbumItems(userId, albumId, {
        includeTrashed: false,
        limit: 50,
      });

      expect(mockPrisma.albumItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            albumId,
            userId,
            media: {
              isTrashed: false,
            },
          }),
        }),
      );
    });

    it("should include trashed media when requested", async () => {
      const userId = "user-123";
      const albumId = "album-123";

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
      });

      mockPrisma.albumItem.findMany.mockResolvedValue([]);

      await service.listAlbumItems(userId, albumId, {
        includeTrashed: true,
        limit: 50,
      });

      expect(mockPrisma.albumItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            albumId,
            userId,
          }),
        }),
      );
      // Should NOT have the media.isTrashed filter
      const whereArg = mockPrisma.albumItem.findMany.mock.calls[0][0].where;
      expect(whereArg.media).toBeUndefined();
    });
  });

  describe("deleteAlbum", () => {
    it("should soft delete album", async () => {
      const userId = "user-123";
      const albumId = "album-123";

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: false,
      });

      const deletedAt = new Date();
      mockPrisma.album.update.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: true,
        deletedAt,
        updatedAt: deletedAt,
      });

      mockPrisma.auditEvent.create.mockResolvedValue({});

      const result = await service.deleteAlbum(userId, albumId);

      expect(mockPrisma.album.update).toHaveBeenCalledWith({
        where: { id: albumId },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
      expect(result.isDeleted).toBe(true);
    });

    it("should reject deleting already deleted album", async () => {
      const userId = "user-123";
      const albumId = "album-123";

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: true,
      });

      await expect(service.deleteAlbum(userId, albumId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("reorderAlbumItems", () => {
    it("should reorder items in transaction", async () => {
      const userId = "user-123";
      const albumId = "album-123";
      const dto: ReorderItemsDto = {
        items: [
          { mediaId: "media-1", position: 1000 },
          { mediaId: "media-2", position: 2000 },
        ],
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: false,
      });

      mockPrisma.albumItem.findMany.mockResolvedValue([
        { mediaId: "media-1" },
        { mediaId: "media-2" },
      ]);

      mockPrisma.albumItem.update.mockResolvedValue({});
      mockPrisma.auditEvent.create.mockResolvedValue({});

      await service.reorderAlbumItems(userId, albumId, dto);

      expect(mockPrisma.albumItem.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.albumItem.update).toHaveBeenCalledWith({
        where: {
          albumId_mediaId: {
            albumId,
            mediaId: "media-1",
          },
        },
        data: {
          position: BigInt(1000),
        },
      });
    });

    it("should reject if media not in album", async () => {
      const userId = "user-123";
      const albumId = "album-123";
      const dto: ReorderItemsDto = {
        items: [
          { mediaId: "media-1", position: 1000 },
          { mediaId: "media-unknown", position: 2000 },
        ],
      };

      mockPrisma.album.findUnique.mockResolvedValue({
        id: albumId,
        userId,
        isDeleted: false,
      });

      mockPrisma.albumItem.findMany.mockResolvedValue([{ mediaId: "media-1" }]);

      await expect(
        service.reorderAlbumItems(userId, albumId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
