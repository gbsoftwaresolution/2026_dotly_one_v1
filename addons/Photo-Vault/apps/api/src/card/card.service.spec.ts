import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { CardService } from "./card.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";

jest.mock("./card.tokens", () => ({
  makeCardGrantToken: () => ({ rawToken: "raw_token", tokenHash: "hash" }),
}));

describe("CardService", () => {
  let service: CardService;

  const mockPrisma = {
    $transaction: jest.fn(),
    personalCard: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cardMode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
    cardModeAnalytics: {
      upsert: jest.fn(),
    },
    cardContactRequest: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    cardContactGrant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
    },
    album: {
      findUnique: jest.fn(),
    },
    sharedAlbum: {
      findMany: jest.fn(),
    },
    cardAttachment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfig = {
    webAppUrl: "http://localhost:3000",
  };

  beforeEach(async () => {
    mockPrisma.cardContactRequest.count.mockResolvedValue(0);
    jest.clearAllMocks();

    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "TRIAL",
      plan: "P6M_25",
    });

    mockPrisma.cardModeAnalytics.upsert.mockResolvedValue({ modeId: "mode-1" });

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(CardService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns mode + attachments for valid publicId + slug", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      publicId: "pub_abc",
    });

    mockPrisma.sharedAlbum.findMany.mockResolvedValue([
      {
        id: "share-1",
        albumId: "album-1",
        expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);

    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      slug: "personal",
      name: "Personal",
      headline: "hi",
      bio: null,
      contactGate: "REQUEST_REQUIRED",
      indexingEnabled: false,
      themeKey: "carbon",
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      updatedAt: new Date("2026-02-21T00:00:00.000Z"),
      attachments: [
        {
          id: "att-1",
          kind: "ALBUM",
          refId: "album-1",
          label: "Family",
          sortOrder: 0,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        },
      ],
    });

    const result = await service.getPublicModeView({
      publicId: "pub_abc",
      modeSlug: "personal",
    });

    expect(mockPrisma.cardModeAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { modeId: "mode-1" } }),
    );

    expect(result.mode.modeId).toBe("mode-1");
    expect(result.mode.cardPublicId).toBe("pub_abc");
    expect(result.mode.slug).toBe("personal");
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].id).toBe("att-1");
    expect(result.attachments[0].resolvedLink).toEqual({
      kind: "SHARED_ALBUM",
      shareId: "share-1",
      shareLink: "http://localhost:3000/shared/share-1",
      expiresAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("omits ALBUM attachments without an active share", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      publicId: "pub_abc",
    });

    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      slug: "personal",
      name: "Personal",
      headline: null,
      bio: null,
      contactGate: "REQUEST_REQUIRED",
      indexingEnabled: false,
      themeKey: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      updatedAt: new Date("2026-02-21T00:00:00.000Z"),
      attachments: [
        {
          id: "att-1",
          kind: "ALBUM",
          refId: "album-1",
          label: null,
          sortOrder: 0,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        },
      ],
    });

    mockPrisma.sharedAlbum.findMany.mockResolvedValue([]);

    const result = await service.getPublicModeView({
      publicId: "pub_abc",
      modeSlug: "personal",
    });

    expect(result.attachments).toEqual([]);
  });

  it("filters revoked attachments", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      publicId: "pub_abc",
    });

    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      slug: "personal",
      name: "Personal",
      headline: null,
      bio: null,
      contactGate: "REQUEST_REQUIRED",
      indexingEnabled: false,
      themeKey: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      updatedAt: new Date("2026-02-21T00:00:00.000Z"),
      attachments: [
        {
          id: "att-ok",
          kind: "MEDIA",
          refId: "media-1",
          label: null,
          sortOrder: 0,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        },
        {
          id: "att-revoked",
          kind: "ALBUM",
          refId: "album-2",
          label: null,
          sortOrder: 1,
          expiresAt: null,
          revokedAt: new Date("2026-02-21T00:00:00.000Z"),
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        },
      ],
    });

    const result = await service.getPublicModeView({
      publicId: "pub_abc",
      modeSlug: "personal",
    });

    expect(result.attachments.map((a) => a.id)).toEqual(["att-ok"]);
  });

  it("filters expired attachments", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      publicId: "pub_abc",
    });

    mockPrisma.sharedAlbum.findMany.mockResolvedValue([
      {
        id: "share-1",
        albumId: "album-1",
        expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);

    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      slug: "personal",
      name: "Personal",
      headline: null,
      bio: null,
      contactGate: "REQUEST_REQUIRED",
      indexingEnabled: false,
      themeKey: null,
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      updatedAt: new Date("2026-02-21T00:00:00.000Z"),
      attachments: [
        {
          id: "att-expired",
          kind: "LIFE_DOC",
          refId: "life-1",
          label: null,
          sortOrder: 0,
          expiresAt: new Date("2026-02-20T23:59:59.000Z"),
          revokedAt: null,
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        },
        {
          id: "att-ok",
          kind: "ALBUM",
          refId: "album-1",
          label: null,
          sortOrder: 1,
          expiresAt: new Date("2026-02-22T00:00:00.000Z"),
          revokedAt: null,
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
        },
      ],
    });

    const result = await service.getPublicModeView({
      publicId: "pub_abc",
      modeSlug: "personal",
    });

    expect(result.attachments.map((a) => a.id)).toEqual(["att-ok"]);
  });

  it("throws NotFound when card missing", async () => {
    mockPrisma.personalCard.findUnique.mockResolvedValue(null);

    await expect(
      service.getPublicModeView({ publicId: "missing", modeSlug: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.getPublicModeView({ publicId: "missing", modeSlug: "x" }),
    ).rejects.toThrow("Card not found");
  });

  it("throws NotFound when mode missing", async () => {
    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      publicId: "pub_abc",
    });
    mockPrisma.cardMode.findUnique.mockResolvedValue(null);

    await expect(
      service.getPublicModeView({ publicId: "pub_abc", modeSlug: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.getPublicModeView({ publicId: "pub_abc", modeSlug: "missing" }),
    ).rejects.toThrow("Mode not found");
  });

  describe("mode attachments (owner)", () => {
    it("createModeAttachment rejects non-owner", async () => {
      mockPrisma.cardMode.findUnique.mockResolvedValue({
        id: "mode-1",
        card: { userId: "owner-1" },
      });

      await expect(
        service.createModeAttachment({
          userId: "owner-2",
          modeId: "mode-1",
          dto: { kind: "ALBUM", refId: "00000000-0000-0000-0000-000000000001" } as any,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("createModeAttachment rejects kind != ALBUM", async () => {
      mockPrisma.cardMode.findUnique.mockResolvedValue({
        id: "mode-1",
        card: { userId: "owner-1" },
      });

      await expect(
        service.createModeAttachment({
          userId: "owner-1",
          modeId: "mode-1",
          dto: { kind: "MEDIA", refId: "x" } as any,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("createModeAttachment rejects album not owned", async () => {
      mockPrisma.cardMode.findUnique.mockResolvedValue({
        id: "mode-1",
        card: { userId: "owner-1" },
      });

      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId: "owner-2",
        isDeleted: false,
      });

      await expect(
        service.createModeAttachment({
          userId: "owner-1",
          modeId: "mode-1",
          dto: { kind: "ALBUM", refId: "album-1" } as any,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("createModeAttachment creates attachment with next sortOrder", async () => {
      mockPrisma.cardMode.findUnique.mockResolvedValue({
        id: "mode-1",
        card: { userId: "owner-1" },
      });

      mockPrisma.album.findUnique.mockResolvedValue({
        id: "album-1",
        userId: "owner-1",
        isDeleted: false,
      });

      // first findFirst: existing check
      mockPrisma.cardAttachment.findFirst.mockResolvedValueOnce(null);
      // second findFirst: max sortOrder
      mockPrisma.cardAttachment.findFirst.mockResolvedValueOnce({ sortOrder: 4 });

      mockPrisma.cardAttachment.create.mockResolvedValue({
        id: "att-1",
        kind: "ALBUM",
        refId: "album-1",
        label: "Family",
        sortOrder: 5,
        expiresAt: null,
        revokedAt: null,
      });

      const created = await service.createModeAttachment({
        userId: "owner-1",
        modeId: "mode-1",
        dto: { kind: "ALBUM", refId: "album-1", label: "Family" } as any,
      });

      expect(created).toEqual({
        id: "att-1",
        kind: "ALBUM",
        refId: "album-1",
        label: "Family",
        sortOrder: 5,
        expiresAt: undefined,
        revokedAt: undefined,
      });
    });
  });

  describe("attachment lifecycle (owner)", () => {
    it("updateAttachment rejects non-owner", async () => {
      mockPrisma.cardAttachment.findUnique.mockResolvedValue({
        id: "att-1",
        kind: "ALBUM",
        refId: "album-1",
        label: null,
        sortOrder: 0,
        expiresAt: null,
        revokedAt: null,
        modeId: "mode-1",
        mode: { card: { userId: "owner-1" } },
      });

      await expect(
        service.updateAttachment({
          userId: "not-owner",
          attachmentId: "att-1",
          dto: { label: "x" } as any,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("updateAttachment validates expiresAt must be in the future", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

      mockPrisma.cardAttachment.findUnique.mockResolvedValue({
        id: "att-1",
        kind: "ALBUM",
        refId: "album-1",
        label: null,
        sortOrder: 0,
        expiresAt: null,
        revokedAt: null,
        modeId: "mode-1",
        mode: { card: { userId: "owner-1" } },
      });

      await expect(
        service.updateAttachment({
          userId: "owner-1",
          attachmentId: "att-1",
          dto: { expiresAt: "2026-02-20T00:00:00.000Z" } as any,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("revokeAttachment sets revokedAt", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

      mockPrisma.cardAttachment.findUnique.mockResolvedValue({
        id: "att-1",
        revokedAt: null,
        mode: { card: { userId: "owner-1" } },
      });

      mockPrisma.cardAttachment.update.mockResolvedValue({ id: "att-1" });

      await service.revokeAttachment({ userId: "owner-1", attachmentId: "att-1" });

      expect(mockPrisma.cardAttachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "att-1" },
          data: { revokedAt: new Date("2026-02-21T00:00:00.000Z") },
        }),
      );
    });

    it("revokeAttachment is idempotent when already revoked", async () => {
      mockPrisma.cardAttachment.findUnique.mockResolvedValue({
        id: "att-1",
        revokedAt: new Date("2026-02-21T00:00:00.000Z"),
        mode: { card: { userId: "owner-1" } },
      });

      await service.revokeAttachment({ userId: "owner-1", attachmentId: "att-1" });

      expect(mockPrisma.cardAttachment.update).not.toHaveBeenCalled();
    });

    it("deleteAttachment deletes when owner", async () => {
      mockPrisma.cardAttachment.findUnique.mockResolvedValue({
        id: "att-1",
        mode: { card: { userId: "owner-1" } },
      });

      mockPrisma.cardAttachment.delete.mockResolvedValue({ id: "att-1" });

      await service.deleteAttachment({ userId: "owner-1", attachmentId: "att-1" });

      expect(mockPrisma.cardAttachment.delete).toHaveBeenCalledWith({
        where: { id: "att-1" },
      });
    });

    it("reorderModeAttachmentsOrdered assigns sequential sortOrder", async () => {
      mockPrisma.cardMode.findUnique.mockResolvedValue({
        id: "mode-1",
        card: { userId: "owner-1" },
      });

      mockPrisma.cardAttachment.findMany
        .mockResolvedValueOnce([
          { id: "att-1", modeId: "mode-1" },
          { id: "att-2", modeId: "mode-1" },
        ])
        .mockResolvedValueOnce([
          {
            id: "att-1",
            kind: "ALBUM",
            refId: "album-1",
            label: null,
            sortOrder: 0,
            expiresAt: null,
            revokedAt: null,
          },
          {
            id: "att-2",
            kind: "ALBUM",
            refId: "album-2",
            label: null,
            sortOrder: 1,
            expiresAt: null,
            revokedAt: null,
          },
        ]);

      mockPrisma.cardAttachment.update.mockResolvedValue({ id: "att-x" });

      const result = await service.reorderModeAttachmentsOrdered({
        userId: "owner-1",
        modeId: "mode-1",
        dto: { attachmentIds: ["att-1", "att-2"] } as any,
      });

      expect(mockPrisma.cardAttachment.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { id: "att-1" }, data: { sortOrder: 0 } }),
      );
      expect(mockPrisma.cardAttachment.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { id: "att-2" }, data: { sortOrder: 1 } }),
      );

      expect(result.attachments.map((a) => [a.id, a.sortOrder])).toEqual([
        ["att-1", 0],
        ["att-2", 1],
      ]);
    });
  });

  it("creates a contact request (public)", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.personalCard.findUnique.mockResolvedValue({ id: "card-1" });
    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      contactGate: "REQUEST_REQUIRED",
    });
    mockPrisma.cardContactRequest.findFirst.mockResolvedValue(null);
    mockPrisma.cardContactRequest.create.mockResolvedValue({
      id: "req-1",
      status: "PENDING",
      createdAt: new Date("2026-02-21T00:00:00.000Z"),
    });

    const result = await service.createContactRequest({
      publicId: "pub_abc",
      modeSlug: "personal",
      dto: {
        requesterName: "  Alice  ",
        requesterEmail: "  Alice@Example.com  ",
        message: "Hello",
      } as any,
    });

    expect(mockPrisma.cardModeAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { modeId: "mode-1" },
        update: expect.objectContaining({
          contactRequestsTotal: expect.any(Object),
        }),
      }),
    );

    expect(mockPrisma.cardContactRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modeId: "mode-1",
          requesterName: "Alice",
          requesterEmail: "alice@example.com",
        }),
      }),
    );

    expect(result.requestId).toBe("req-1");
    expect(result.status).toBe("PENDING");
    expect(result.createdAt).toBe("2026-02-21T00:00:00.000Z");
  });

  describe("analytics (owner)", () => {
    it("getModeAnalytics enforces ownership", async () => {
      mockPrisma.cardMode.findUnique.mockResolvedValue({
        id: "mode-1",
        card: { userId: "owner-1" },
        analytics: null,
      });

      await expect(
        service.getModeAnalytics({ userId: "not-owner", modeId: "mode-1" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("listMyModeAnalytics returns items with activeGrantsTotal", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

      mockPrisma.cardMode.findMany.mockResolvedValue([
        {
          id: "mode-1",
          analytics: {
            viewsTotal: 3n,
            lastViewedAt: new Date("2026-02-21T00:00:00.000Z"),
            contactRequestsTotal: 1n,
            approvalsTotal: 1n,
            denialsTotal: 0n,
          },
        },
        {
          id: "mode-2",
          analytics: null,
        },
      ]);

      mockPrisma.cardContactGrant.groupBy.mockResolvedValue([
        { modeId: "mode-1", _count: { _all: 2 } },
      ]);

      const result = await service.listMyModeAnalytics({ userId: "owner-1" });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        modeId: "mode-1",
        viewsTotal: 3,
        lastViewedAt: "2026-02-21T00:00:00.000Z",
        contactRequestsTotal: 1,
        approvalsTotal: 1,
        denialsTotal: 0,
        activeGrantsTotal: 2,
      });

      expect(result.items[1]).toEqual({
        modeId: "mode-2",
        viewsTotal: 0,
        contactRequestsTotal: 0,
        approvalsTotal: 0,
        denialsTotal: 0,
        activeGrantsTotal: 0,
      });
    });
  });

  it("does not leak hidden mode existence when creating contact request", async () => {
    mockPrisma.personalCard.findUnique.mockResolvedValue({ id: "card-1" });
    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      contactGate: "HIDDEN",
    });

    await expect(
      service.createContactRequest({
        publicId: "pub_abc",
        modeSlug: "hidden",
        dto: {
          requesterName: "Alice",
          requesterEmail: "alice@example.com",
        } as any,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("dedupes recent pending contact requests", async () => {
    mockPrisma.personalCard.findUnique.mockResolvedValue({ id: "card-1" });
    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      contactGate: "REQUEST_REQUIRED",
    });
    mockPrisma.cardContactRequest.findFirst.mockResolvedValue({ id: "req-x" });

    await expect(
      service.createContactRequest({
        publicId: "pub_abc",
        modeSlug: "personal",
        dto: {
          requesterName: "Alice",
          requesterEmail: "alice@example.com",
        } as any,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("enforces ownership on mode contact request list", async () => {
    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      card: { userId: "owner-1" },
    });

    await expect(
      service.listModeContactRequests({
        userId: "not-owner",
        modeId: "mode-1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists contact requests for a mode", async () => {
    mockPrisma.cardMode.findUnique.mockResolvedValue({
      id: "mode-1",
      card: { userId: "owner-1" },
    });
    mockPrisma.cardContactRequest.findMany.mockResolvedValue([
      {
        id: "req-1",
        status: "PENDING",
        requesterName: "Alice",
        requesterEmail: "alice@example.com",
        requesterPhone: null,
        message: "Hello",
        createdAt: new Date("2026-02-21T00:00:00.000Z"),
      },
    ]);

    const result = await service.listModeContactRequests({
      userId: "owner-1",
      modeId: "mode-1",
      status: "PENDING" as any,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("req-1");
    expect(result.items[0].createdAt).toBe("2026-02-21T00:00:00.000Z");
  });

  it("approves a pending request and returns a raw token", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactRequest.findUnique.mockResolvedValue({
      id: "req-1",
      modeId: "mode-1",
      status: "PENDING",
      mode: { card: { userId: "owner-1" } },
    });
    mockPrisma.cardContactGrant.create.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-03-23T00:00:00.000Z"),
    });
    mockPrisma.cardContactRequest.update.mockResolvedValue({ id: "req-1" });

    const result = await service.approveContactRequest({
      userId: "owner-1",
      requestId: "req-1",
      dto: { expiresInDays: 30 },
    });

    expect(mockPrisma.cardModeAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { modeId: "mode-1" },
        update: expect.objectContaining({ approvalsTotal: expect.any(Object) }),
      }),
    );

    expect(mockPrisma.cardContactGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modeId: "mode-1",
          requestId: "req-1",
          tokenHash: "hash",
        }),
      }),
    );

    expect(result.grantId).toBe("grant-1");
    expect(result.token).toBe("raw_token");
    expect(result.expiresAt).toBe("2026-03-23T00:00:00.000Z");
  });

  it("does not approve non-pending requests", async () => {
    mockPrisma.cardContactRequest.findUnique.mockResolvedValue({
      id: "req-1",
      modeId: "mode-1",
      status: "DENIED",
      mode: { card: { userId: "owner-1" } },
    });

    await expect(
      service.approveContactRequest({
        userId: "owner-1",
        requestId: "req-1",
        dto: { expiresInDays: 30 },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("denies a pending request", async () => {
    mockPrisma.cardContactRequest.findUnique.mockResolvedValue({
      id: "req-1",
      modeId: "mode-1",
      status: "PENDING",
      mode: { card: { userId: "owner-1" } },
    });
    mockPrisma.cardContactRequest.update.mockResolvedValue({ id: "req-1" });

    await service.denyContactRequest({ userId: "owner-1", requestId: "req-1" });

    expect(mockPrisma.cardContactRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DENIED" } }),
    );

    expect(mockPrisma.cardModeAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { modeId: "mode-1" },
        update: expect.objectContaining({ denialsTotal: expect.any(Object) }),
      }),
    );
  });

  it("revokes a grant and updates request status when present", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      revokedAt: null,
      requestId: "req-1",
      mode: { card: { userId: "owner-1" } },
    });
    mockPrisma.cardContactGrant.update.mockResolvedValue({ id: "grant-1" });
    mockPrisma.cardContactRequest.update.mockResolvedValue({ id: "req-1" });

    await service.revokeContactGrant({ userId: "owner-1", grantId: "grant-1" });

    expect(mockPrisma.cardContactGrant.update).toHaveBeenCalled();
    expect(mockPrisma.cardContactRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REVOKED" } }),
    );
  });

  it("enforces ownership on approve/deny/revoke", async () => {
    mockPrisma.cardContactRequest.findUnique.mockResolvedValue({
      id: "req-1",
      modeId: "mode-1",
      status: "PENDING",
      mode: { card: { userId: "owner-1" } },
    });

    await expect(
      service.approveContactRequest({
        userId: "not-owner",
        requestId: "req-1",
        dto: { expiresInDays: 30 },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.denyContactRequest({ userId: "not-owner", requestId: "req-1" }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      revokedAt: null,
      requestId: null,
      mode: { card: { userId: "owner-1" } },
    });

    await expect(
      service.revokeContactGrant({ userId: "not-owner", grantId: "grant-1" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("generateVCard rejects invalid token", async () => {
    mockPrisma.cardContactGrant.findUnique.mockResolvedValue(null);

    await expect(
      service.generateVCard({
        rawToken: "bad",
        publicId: "pub_abc",
        modeSlug: "personal",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("generateVCard rejects expired token", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-02-20T00:00:00.000Z"),
      revokedAt: null,
      mode: {
        id: "mode-1",
        slug: "personal",
        card: {
          publicId: "pub_abc",
          user: { displayName: "Alice", email: "a@example.com" },
        },
      },
    });

    await expect(
      service.generateVCard({
        rawToken: "raw",
        publicId: "pub_abc",
        modeSlug: "personal",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("generateVCard rejects revoked token", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      revokedAt: new Date("2026-02-21T00:00:00.000Z"),
      mode: {
        id: "mode-1",
        slug: "personal",
        card: {
          publicId: "pub_abc",
          user: { displayName: "Alice", email: "a@example.com" },
        },
      },
    });

    await expect(
      service.generateVCard({
        rawToken: "raw",
        publicId: "pub_abc",
        modeSlug: "personal",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("generateVCard rejects mode mismatch", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      revokedAt: null,
      mode: {
        id: "mode-1",
        slug: "other",
        card: {
          publicId: "pub_other",
          user: { displayName: "Alice", email: "a@example.com" },
        },
      },
    });

    await expect(
      service.generateVCard({
        rawToken: "raw",
        publicId: "pub_abc",
        modeSlug: "personal",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("generateVCard returns minimal vCard for valid token", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      revokedAt: null,
      mode: {
        id: "mode-1",
        slug: "personal",
        card: {
          publicId: "pub_abc",
          user: { displayName: "Alice", email: "alice@example.com" },
        },
      },
    });

    const result = await service.generateVCard({
      rawToken: "raw",
      publicId: "pub_abc",
      modeSlug: "personal",
    });

    expect(result.filename).toBe("contact.vcf");
    expect(result.vcf).toContain("BEGIN:VCARD");
    expect(result.vcf).toContain("VERSION:3.0");
    expect(result.vcf).toContain("FN:Alice");
    expect(result.vcf).toContain("EMAIL;TYPE=INTERNET:alice@example.com");
    expect(result.vcf).toContain("END:VCARD");
  });

  it("revealContact rejects missing token", async () => {
    await expect(
      service.revealContact({
        rawToken: "",
        publicId: "pub_abc",
        modeSlug: "personal",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revealContact rejects invalid token", async () => {
    mockPrisma.cardContactGrant.findUnique.mockResolvedValue(null);

    await expect(
      service.revealContact({
        rawToken: "bad",
        publicId: "pub_abc",
        modeSlug: "personal",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revealContact returns minimal contact payload for valid token", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactGrant.findUnique.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-03-01T00:00:00.000Z"),
      revokedAt: null,
      mode: {
        slug: "personal",
        card: {
          publicId: "pub_abc",
          user: { displayName: " Alice ", email: "alice@example.com" },
        },
      },
    });

    const result = await service.revealContact({
      rawToken: "raw",
      publicId: "pub_abc",
      modeSlug: "personal",
    });

    expect(result).toEqual({
      displayName: "Alice",
      email: "alice@example.com",
    });
  });

  it("free users cannot create a 2nd mode", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "TRIAL",
      plan: "P6M_25",
    });

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      publicId: "pub_abc",
    });

    mockPrisma.cardMode.count.mockResolvedValue(1);

    await expect(
      service.createMode({
        userId: "user-1",
        dto: { name: "Personal", slug: "personal" } as any,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await service.createMode({
        userId: "user-1",
        dto: { name: "Personal", slug: "personal" } as any,
      });
    } catch (err: any) {
      expect(err.getResponse?.()).toMatchObject({
        code: "CARD_MODE_LIMIT_REACHED",
      });
    }
  });

  it("premium users can create 3 modes but not 4", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "Y1_100",
    });

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      publicId: "pub_abc",
    });

    mockPrisma.cardMode.count.mockResolvedValueOnce(2);
    mockPrisma.cardMode.create.mockResolvedValue({
      id: "mode-3",
      slug: "m3",
      name: "M3",
      headline: null,
      bio: null,
      contactGate: "REQUEST_REQUIRED",
      indexingEnabled: false,
      themeKey: null,
      createdAt: new Date("2026-02-21T00:00:00.000Z"),
      updatedAt: new Date("2026-02-21T00:00:00.000Z"),
    });

    const created = await service.createMode({
      userId: "user-1",
      dto: { name: "M3", slug: "m3" } as any,
    });
    expect(created.mode.modeId).toBe("mode-3");

    mockPrisma.cardMode.count.mockResolvedValueOnce(3);
    await expect(
      service.createMode({
        userId: "user-1",
        dto: { name: "M4", slug: "m4" } as any,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("non-premium users cannot set vanity username", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "TRIAL",
      plan: "P6M_25",
    });

    await expect(
      service.updateMyUsername({
        userId: "user-1",
        dto: { username: "alice_1" } as any,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("premium users can set vanity username and resolve only if indexingEnabled", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      plan: "Y1_100",
    });

    mockPrisma.personalCard.findUnique.mockResolvedValue({
      id: "card-1",
      username: null,
      usernameUpdatedAt: null,
    });
    mockPrisma.personalCard.update.mockResolvedValue({ username: "alice_1" });

    const updated = await service.updateMyUsername({
      userId: "user-1",
      dto: { username: " Alice_1 " } as any,
    });
    expect(updated.username).toBe("alice_1");

    mockPrisma.personalCard.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.resolveUsername({ username: "alice_1" }),
    ).rejects.toBeInstanceOf(NotFoundException);

    mockPrisma.personalCard.findFirst.mockResolvedValueOnce({ publicId: "pub_abc" });
    const resolved = await service.resolveUsername({ username: "alice_1" });
    expect(resolved.publicId).toBe("pub_abc");
  });

  it("free users cannot set custom expiresAt; premium users can", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-21T00:00:00.000Z"));

    mockPrisma.cardContactRequest.findUnique.mockResolvedValue({
      id: "req-1",
      modeId: "mode-1",
      status: "PENDING",
      mode: { card: { userId: "owner-1" } },
    });

    mockPrisma.cardContactGrant.create.mockResolvedValue({
      id: "grant-1",
      expiresAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    mockPrisma.cardContactRequest.update.mockResolvedValue({ id: "req-1" });

    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      status: "TRIAL",
      plan: "P6M_25",
    });
    await expect(
      service.approveContactRequest({
        userId: "owner-1",
        requestId: "req-1",
        dto: { expiresAt: "2026-03-01T00:00:00.000Z" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      plan: "Y1_100",
    });
    const ok = await service.approveContactRequest({
      userId: "owner-1",
      requestId: "req-1",
      dto: { expiresAt: "2026-03-01T00:00:00.000Z" },
    });
    expect(ok.grantId).toBe("grant-1");
  });
});
