import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AlbumsController } from "./albums.controller";
import { AlbumsService } from "./albums.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type {
  CreateAlbumDto,
  UpdateAlbumDto,
  AddItemsDto,
  ReorderItemsDto,
} from "@booster-vault/shared";

describe("AlbumsController", () => {
  let controller: AlbumsController;

  const mockPrismaService = {
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
    $transaction: jest.fn((fn) => fn(mockPrismaService)),
  };

  const mockAlbumsService = {
    listAlbums: jest.fn(),
    createAlbum: jest.fn(),
    getAlbum: jest.fn(),
    updateAlbum: jest.fn(),
    deleteAlbum: jest.fn(),
    listAlbumItems: jest.fn(),
    addItemsToAlbum: jest.fn(),
    removeItemFromAlbum: jest.fn(),
    reorderAlbumItems: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [
        { provide: AlbumsService, useValue: mockAlbumsService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlbumsController>(AlbumsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("listAlbums", () => {
    it("should call albumsService.listAlbums with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const mockResponse = {
        items: [],
        nextCursor: undefined,
        hasMore: false,
      };
      mockAlbumsService.listAlbums.mockResolvedValue(mockResponse);

      const result = await controller.listAlbums(
        req as any,
        "false",
        "50",
        "cursor-123",
      );

      expect(mockAlbumsService.listAlbums).toHaveBeenCalledWith("user-123", {
        includeDeleted: false,
        limit: 50,
        cursor: "cursor-123",
      });
      expect(result).toEqual({ albums: mockResponse });
    });
  });

  describe("createAlbum", () => {
    it("should call albumsService.createAlbum with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const createAlbumDto: CreateAlbumDto = {
        name: "Test Album",
        description: "Test description",
      };
      const mockAlbum = {
        id: "album-123",
        name: "Test Album",
        description: "Test description",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAlbumsService.createAlbum.mockResolvedValue(mockAlbum);

      const result = await controller.createAlbum(req as any, createAlbumDto);

      expect(mockAlbumsService.createAlbum).toHaveBeenCalledWith(
        "user-123",
        createAlbumDto,
      );
      expect(result).toEqual({ album: mockAlbum });
    });
  });

  describe("getAlbum", () => {
    it("should call albumsService.getAlbum with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const mockAlbum = {
        id: albumId,
        name: "Test Album",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAlbumsService.getAlbum.mockResolvedValue(mockAlbum);

      const result = await controller.getAlbum(req as any, albumId);

      expect(mockAlbumsService.getAlbum).toHaveBeenCalledWith(
        "user-123",
        albumId,
      );
      expect(result).toEqual({ album: mockAlbum });
    });
  });

  describe("updateAlbum", () => {
    it("should call albumsService.updateAlbum with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const updateAlbumDto: UpdateAlbumDto = {
        name: "Updated Album",
        description: "Updated description",
      };
      const mockAlbum = {
        id: albumId,
        name: "Updated Album",
        description: "Updated description",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAlbumsService.updateAlbum.mockResolvedValue(mockAlbum);

      const result = await controller.updateAlbum(
        req as any,
        albumId,
        updateAlbumDto,
      );

      expect(mockAlbumsService.updateAlbum).toHaveBeenCalledWith(
        "user-123",
        albumId,
        updateAlbumDto,
      );
      expect(result).toEqual({ album: mockAlbum });
    });
  });

  describe("deleteAlbum", () => {
    it("should call albumsService.deleteAlbum with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const mockAlbum = {
        id: albumId,
        name: "Test Album",
        isDeleted: true,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAlbumsService.deleteAlbum.mockResolvedValue(mockAlbum);

      const result = await controller.deleteAlbum(req as any, albumId);

      expect(mockAlbumsService.deleteAlbum).toHaveBeenCalledWith(
        "user-123",
        albumId,
      );
      expect(result).toEqual({ album: mockAlbum });
    });
  });

  describe("listAlbumItems", () => {
    it("should call albumsService.listAlbumItems with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const mockResponse = {
        items: [],
        nextCursor: undefined,
        hasMore: false,
      };
      mockAlbumsService.listAlbumItems.mockResolvedValue(mockResponse);

      const result = await controller.listAlbumItems(
        req as any,
        albumId,
        "false",
        "50",
        "cursor-123",
      );

      expect(mockAlbumsService.listAlbumItems).toHaveBeenCalledWith(
        "user-123",
        albumId,
        {
          includeTrashed: false,
          limit: 50,
          cursor: "cursor-123",
        },
      );
      expect(result).toEqual({ items: mockResponse });
    });
  });

  describe("addItemsToAlbum", () => {
    it("should call albumsService.addItemsToAlbum with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const addItemsDto: AddItemsDto = {
        mediaIds: ["media-1", "media-2"],
      };
      mockAlbumsService.addItemsToAlbum.mockResolvedValue(undefined);

      await controller.addItemsToAlbum(req as any, albumId, addItemsDto);

      expect(mockAlbumsService.addItemsToAlbum).toHaveBeenCalledWith(
        "user-123",
        albumId,
        addItemsDto,
      );
    });
  });

  describe("removeItemFromAlbum", () => {
    it("should call albumsService.removeItemFromAlbum with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const mediaId = "media-456";
      mockAlbumsService.removeItemFromAlbum.mockResolvedValue(undefined);

      await controller.removeItemFromAlbum(req as any, albumId, mediaId);

      expect(mockAlbumsService.removeItemFromAlbum).toHaveBeenCalledWith(
        "user-123",
        albumId,
        mediaId,
      );
    });
  });

  describe("reorderAlbumItems", () => {
    it("should call albumsService.reorderAlbumItems with correct parameters", async () => {
      const req = { user: { sub: "user-123" } };
      const albumId = "album-123";
      const reorderItemsDto: ReorderItemsDto = {
        items: [
          { mediaId: "media-1", position: 1000 },
          { mediaId: "media-2", position: 2000 },
        ],
      };
      mockAlbumsService.reorderAlbumItems.mockResolvedValue(undefined);

      await controller.reorderAlbumItems(req as any, albumId, reorderItemsDto);

      expect(mockAlbumsService.reorderAlbumItems).toHaveBeenCalledWith(
        "user-123",
        albumId,
        reorderItemsDto,
      );
    });
  });
});
