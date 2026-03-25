import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { SharingService } from "./sharing.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { StorageService } from "../storage/storage.service";
import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "crypto";

describe("SharingService", () => {
  let service: SharingService;

  const mockPrisma = {
    sharedAlbum: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    shareAccessToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    media: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    album: {
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  };

  const mockConfig = {
    shareTokenTtlSeconds: 900,
  };

  const mockStorage = {
    createSignedDownloadUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get(SharingService);
  });

  describe("unlockShare", () => {
    it("returns bundle when encryptedMediaKeys is Prisma Json array", async () => {
      const shareId = "share-123";
      const now = Date.now();

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        albumId: "album-1",
        encryptedAlbumKey: Buffer.from("abc"),
        encryptedMediaKeys: [
          { mediaId: "media-1", encryptedKey: "k", iv: "iv" },
          { mediaId: "media-2", encryptedKey: "k2", iv: "iv2" },
        ],
        iv: Buffer.from("iv"),
        kdfParams: { iterations: 200000, saltB64: "salt" },
        expiresAt: new Date(now + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.create.mockResolvedValue({});

      const result = await service.unlockShare(shareId, { passphrase: "x" });

      expect(result.shareId).toBe(shareId);
      expect(result.encryptedMediaKeys).toHaveLength(2);
      expect(typeof result.shareAccessToken).toBe("string");
      expect(mockPrisma.shareAccessToken.create).toHaveBeenCalledTimes(1);
    });

    it("throws ConflictException when encryptedMediaKeys is invalid", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        encryptedAlbumKey: Buffer.from("abc"),
        encryptedMediaKeys: { not: "an array" },
        iv: Buffer.from("iv"),
        kdfParams: {},
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.create.mockResolvedValue({});

      await expect(
        service.unlockShare("share-1", { passphrase: "x" }),
      ).rejects.toThrow(ConflictException);
    });

    it("throws GoneException when share expired", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        encryptedAlbumKey: Buffer.from("abc"),
        encryptedMediaKeys: [],
        iv: Buffer.from("iv"),
        kdfParams: {},
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(
        service.unlockShare("share-1", { passphrase: "x" }),
      ).rejects.toThrow(GoneException);
    });

    it("throws ConflictException when share bundle not uploaded yet", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        encryptedAlbumKey: null,
        encryptedMediaKeys: null,
        iv: null,
        kdfParams: null,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      await expect(
        service.unlockShare("share-1", { passphrase: "x" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("getSharedMediaDownloadUrl", () => {
    it("returns signed url when token and media are valid (encryptedMediaKeys is Json array)", async () => {
      const shareId = "share-123";
      const mediaId = "media-1";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: [{ mediaId, encryptedKey: "k", iv: "iv" }],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      mockPrisma.media.findUnique.mockResolvedValue({
        id: mediaId,
        userId: "user-1",
        isTrashed: false,
        objectKey: "u/user-1/media/media-1.bin",
        thumbObjectKey: "u/user-1/m/media-1.thumb.bin",
        type: "PHOTO",
        byteSize: BigInt(123),
        thumbByteSize: BigInt(10),
        contentType: "image/jpeg",
        thumbContentType: "image/jpeg",
        encMeta: { ivB64: "iv" },
        thumbEncMeta: { ivB64: "tiv" },
        thumbUploadedAt: new Date(),
        originalFilename: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStorage.createSignedDownloadUrl.mockResolvedValue({
        url: "https://example.com/signed",
        expiresAt: new Date(),
        method: "GET",
        headers: {},
      });

      const result = await service.getSharedMediaDownloadUrl(
        shareId,
        mediaId,
        rawToken,
      );

      expect(result.url).toBe("https://example.com/signed");
      expect(result.media.id).toBe(mediaId);
      expect(mockStorage.createSignedDownloadUrl).toHaveBeenCalledWith(
        "u/user-1/media/media-1.bin",
      );
    });

    it("signs thumb object when variant=thumb", async () => {
      const shareId = "share-123";
      const mediaId = "media-1";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: [{ mediaId, encryptedKey: "k", iv: "iv" }],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      mockPrisma.media.findUnique.mockResolvedValue({
        id: mediaId,
        userId: "user-1",
        isTrashed: false,
        objectKey: "u/user-1/media/media-1.bin",
        thumbObjectKey: "u/user-1/m/media-1.thumb.bin",
        type: "PHOTO",
        byteSize: BigInt(123),
        thumbByteSize: BigInt(10),
        contentType: "image/jpeg",
        thumbContentType: "image/jpeg",
        encMeta: { ivB64: "iv" },
        thumbEncMeta: { ivB64: "tiv" },
        thumbUploadedAt: new Date(),
        originalFilename: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStorage.createSignedDownloadUrl.mockResolvedValue({
        url: "https://example.com/signed-thumb",
        expiresAt: new Date(),
        method: "GET",
        headers: {},
      });

      const result = await service.getSharedMediaDownloadUrl(
        shareId,
        mediaId,
        rawToken,
        "thumb",
      );

      expect(result.url).toBe("https://example.com/signed-thumb");
      expect(mockStorage.createSignedDownloadUrl).toHaveBeenCalledWith(
        "u/user-1/m/media-1.thumb.bin",
      );
    });

    it("throws BadRequestException when variant=thumb but thumbnail missing", async () => {
      const shareId = "share-123";
      const mediaId = "media-1";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: [{ mediaId, encryptedKey: "k", iv: "iv" }],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      mockPrisma.media.findUnique.mockResolvedValue({
        id: mediaId,
        userId: "user-1",
        isTrashed: false,
        objectKey: "u/user-1/media/media-1.bin",
        thumbObjectKey: null,
        type: "PHOTO",
        byteSize: BigInt(123),
        thumbByteSize: null,
        contentType: "image/jpeg",
        thumbContentType: null,
        encMeta: { ivB64: "iv" },
        thumbEncMeta: null,
        thumbUploadedAt: null,
        originalFilename: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getSharedMediaDownloadUrl(shareId, mediaId, rawToken, "thumb"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ConflictException when share bundle not uploaded yet", async () => {
      const shareId = "share-123";
      const mediaId = "media-1";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: null,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      await expect(
        service.getSharedMediaDownloadUrl(shareId, mediaId, rawToken),
      ).rejects.toThrow(ConflictException);
    });

    it("throws UnauthorizedException when token invalid", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        ownerUserId: "user-1",
        encryptedMediaKeys: [
          { mediaId: "media-1", encryptedKey: "k", iv: "iv" },
        ],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });
      mockPrisma.shareAccessToken.findUnique.mockResolvedValue(null);

      await expect(
        service.getSharedMediaDownloadUrl("share-1", "media-1", "bad"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws NotFoundException when media not in share snapshot", async () => {
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        ownerUserId: "user-1",
        encryptedMediaKeys: [
          { mediaId: "media-1", encryptedKey: "k", iv: "iv" },
        ],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId: "share-1",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: "share-1",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      await expect(
        service.getSharedMediaDownloadUrl("share-1", "media-2", rawToken),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("listSharedMediaMetadata", () => {
    it("returns ordered items and nextCursor", async () => {
      const shareId = "share-123";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: [
          { mediaId: "m1", encryptedKey: "k", iv: "iv" },
          { mediaId: "m2", encryptedKey: "k", iv: "iv" },
          { mediaId: "m3", encryptedKey: "k", iv: "iv" },
        ],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      // Return rows out of order to verify snapshot ordering is preserved.
      mockPrisma.media.findMany.mockResolvedValue([
        {
          id: "m2",
          type: "VIDEO",
          byteSize: BigInt(200),
          contentType: "video/mp4",
          encMeta: { ivB64: "iv" },
          thumbByteSize: BigInt(20),
          thumbContentType: "image/jpeg",
          thumbEncMeta: { ivB64: "tiv" },
          thumbUploadedAt: new Date(),
          originalFilename: "b.mp4",
          exifTakenAt: null,
          takenAt: null,
          isTrashed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "m1",
          type: "PHOTO",
          byteSize: BigInt(100),
          contentType: "image/jpeg",
          encMeta: { ivB64: "iv" },
          thumbByteSize: null,
          thumbContentType: null,
          thumbEncMeta: null,
          thumbUploadedAt: null,
          originalFilename: "a.jpg",
          exifTakenAt: null,
          takenAt: null,
          isTrashed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listSharedMediaMetadata(
        shareId,
        rawToken,
        0,
        2,
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("m1");
      expect(result.items[1].id).toBe("m2");
      expect(result.nextCursor).toBe(2);
    });

    it("filters trashed items", async () => {
      const shareId = "share-123";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: [
          { mediaId: "m1", encryptedKey: "k", iv: "iv" },
          { mediaId: "m2", encryptedKey: "k", iv: "iv" },
        ],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      mockPrisma.media.findMany.mockResolvedValue([
        {
          id: "m1",
          type: "PHOTO",
          byteSize: BigInt(100),
          contentType: "image/jpeg",
          encMeta: { ivB64: "iv" },
          thumbByteSize: null,
          thumbContentType: null,
          thumbEncMeta: null,
          thumbUploadedAt: null,
          originalFilename: null,
          exifTakenAt: null,
          takenAt: null,
          isTrashed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "m2",
          type: "PHOTO",
          byteSize: BigInt(101),
          contentType: "image/jpeg",
          encMeta: { ivB64: "iv" },
          thumbByteSize: null,
          thumbContentType: null,
          thumbEncMeta: null,
          thumbUploadedAt: null,
          originalFilename: null,
          exifTakenAt: null,
          takenAt: null,
          isTrashed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listSharedMediaMetadata(shareId, rawToken);
      expect(result.items.map((i) => i.id)).toEqual(["m2"]);
    });

    it("throws UnauthorizedException when token invalid", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        ownerUserId: "user-1",
        encryptedMediaKeys: [{ mediaId: "m1", encryptedKey: "k", iv: "iv" }],
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue(null);

      await expect(
        service.listSharedMediaMetadata("share-1", "bad"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws ConflictException when share bundle not uploaded yet", async () => {
      const shareId = "share-1";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId: "user-1",
        encryptedMediaKeys: null,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      await expect(
        service.listSharedMediaMetadata(shareId, rawToken),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("trackShareView", () => {
    it("increments viewCount when token is valid", async () => {
      const shareId = "share-123";
      const rawToken = "token-raw";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue({
        id: "t-1",
        shareId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        share: {
          id: shareId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
        },
      });

      mockPrisma.sharedAlbum.update.mockResolvedValue({});

      await service.trackShareView(shareId, rawToken);

      expect(mockPrisma.sharedAlbum.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.sharedAlbum.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: shareId },
          data: expect.objectContaining({
            viewCount: { increment: 1 },
          }),
        }),
      );
    });

    it("throws UnauthorizedException when token invalid", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      mockPrisma.shareAccessToken.findUnique.mockResolvedValue(null);

      await expect(service.trackShareView("share-1", "bad")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("getShareAnalytics", () => {
    it("returns viewCount and lastViewedAt for owner", async () => {
      const shareId = "share-123";
      const ownerUserId = "user-1";
      const lastViewedAt = new Date();

      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: shareId,
        ownerUserId,
        viewCount: 42,
        lastViewedAt,
      });

      const result = await service.getShareAnalytics(ownerUserId, shareId);

      expect(result).toEqual({
        shareId,
        viewCount: 42,
        lastViewedAt,
      });
    });

    it("throws NotFoundException when share does not belong to owner", async () => {
      mockPrisma.sharedAlbum.findUnique.mockResolvedValue({
        id: "share-1",
        ownerUserId: "other",
        viewCount: 0,
        lastViewedAt: null,
      });

      await expect(
        service.getShareAnalytics("user-1", "share-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
