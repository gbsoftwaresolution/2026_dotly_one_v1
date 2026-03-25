import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  type CardAttachmentResponse,
  type CardModeAnalyticsResponse,
  type CardContactRevealResponse,
  type CardAttachmentKind,
  type CardContactGate,
  type CardContactRequestStatus,
  type ApproveCardContactRequestDto,
  type ApproveCardContactRequestResponse,
  type CreateCardAttachmentDto,
  type CreateCardModeDto,
  type CreateCardContactRequestDto,
  type CreateCardContactRequestResponse,
  type GetPublicCardModeResponse,
  type ListCardModeAnalyticsResponse,
  type ListCardAttachmentsResponse,
  type ListCardModesResponse,
  type ListCardContactRequestsResponse,
  type ReorderCardAttachmentsDto,
  type ReorderCardAttachmentsOrderedDto,
  type ReorderCardAttachmentsResponse,
  type ResolveUsernameResponse,
  type UpdateCardAttachmentDto,
  type UpdateCardUsernameDto,
  type UpdateCardUsernameResponse,
} from "@booster-vault/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "../config/config.service";
import { isPremium } from "../billing/is-premium";
import { makeCardGrantToken } from "./card.tokens";
import { hashCardToken } from "./card.util";

@Injectable()
export class CardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private static readonly MODE_LIMIT_FREE = 1;
  private static readonly MODE_LIMIT_PREMIUM = 3;

  private static readonly USERNAME_COOLDOWN_DAYS = 365;
  private static readonly USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
  private static readonly USERNAME_RESERVED = new Set([
    "admin",
    "api",
    "app",
    "auth",
    "billing",
    "card",
    "cards",
    "contact",
    "docs",
    "export",
    "exports",
    "faq",
    "help",
    "home",
    "login",
    "logout",
    "media",
    "me",
    "modes",
    "pricing",
    "privacy",
    "public",
    "register",
    "resolve-username",
    "settings",
    "share",
    "shared",
    "signup",
    "signin",
    "support",
    "terms",
    "u",
    "user",
    "users",
    "vault",
  ]);

  private static readonly CONTACT_REQUEST_DEDUPE_WINDOW_MS =
    24 * 60 * 60 * 1000;

  private static readonly CONTACT_GRANT_DEFAULT_EXPIRES_IN_DAYS = 30;
  private static readonly CONTACT_GRANT_MAX_EXPIRES_IN_DAYS = 365;

  private static bigIntToSafeNumber(value: bigint): number {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (value <= 0n) return 0;
    if (value > max) return Number.MAX_SAFE_INTEGER;
    return Number(value);
  }

  private async isUserPremium(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, plan: true },
    });

    if (!subscription) return false;
    return isPremium(subscription);
  }

  private static normalizeUsername(raw: string): string {
    const username = String(raw ?? "")
      .trim()
      .toLowerCase();

    if (!CardService.USERNAME_REGEX.test(username)) {
      throw new BadRequestException(
        "username must match /^[a-z0-9_]{3,24}$/",
      );
    }

    if (CardService.USERNAME_RESERVED.has(username)) {
      throw new BadRequestException("username is reserved");
    }

    return username;
  }

  private mapModeToPublicResponse(args: {
    cardPublicId: string;
    mode: {
      id: string;
      slug: string;
      name: string;
      headline: string | null;
      bio: string | null;
      contactGate: string;
      indexingEnabled: boolean;
      themeKey: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }) {
    return {
      modeId: args.mode.id,
      cardPublicId: args.cardPublicId,
      slug: args.mode.slug,
      name: args.mode.name,
      headline: args.mode.headline ?? undefined,
      bio: args.mode.bio ?? undefined,
      contactGate: args.mode.contactGate as unknown as CardContactGate,
      indexingEnabled: args.mode.indexingEnabled,
      themeKey: args.mode.themeKey ?? undefined,
      createdAt: args.mode.createdAt.toISOString(),
      updatedAt: args.mode.updatedAt.toISOString(),
    };
  }

  async listMyModes(args: { userId: string }): Promise<ListCardModesResponse> {
    const card = await this.prisma.personalCard.findUnique({
      where: { userId: args.userId },
      select: { id: true, publicId: true },
    });

    if (!card) {
      return { items: [] };
    }

    const modes = await this.prisma.cardMode.findMany({
      where: { cardId: card.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        headline: true,
        bio: true,
        contactGate: true,
        indexingEnabled: true,
        themeKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      items: modes.map((m) =>
        this.mapModeToPublicResponse({ cardPublicId: card.publicId, mode: m }),
      ),
    };
  }

  async createMode(args: {
    userId: string;
    dto: CreateCardModeDto;
  }): Promise<{ mode: ReturnType<CardService["mapModeToPublicResponse"]> }> {
    const premium = await this.isUserPremium(args.userId);
    const maxModes = premium
      ? CardService.MODE_LIMIT_PREMIUM
      : CardService.MODE_LIMIT_FREE;

    const card =
      (await this.prisma.personalCard.findUnique({
        where: { userId: args.userId },
        select: { id: true, publicId: true },
      })) ??
      (await this.prisma.personalCard.create({
        data: { userId: args.userId, publicId: randomUUID() },
        select: { id: true, publicId: true },
      }));

    const existingCount = await this.prisma.cardMode.count({
      where: { cardId: card.id },
    });

    if (existingCount >= maxModes) {
      throw new ForbiddenException({
        code: "CARD_MODE_LIMIT_REACHED",
        message: `Mode limit reached (${maxModes})`,
      });
    }

    const slug = String(args.dto.slug ?? "")
      .trim()
      .toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      throw new BadRequestException("Invalid slug");
    }

    try {
      const created = await this.prisma.cardMode.create({
        data: {
          cardId: card.id,
          name: String(args.dto.name ?? "").trim(),
          slug,
          headline: args.dto.headline ?? null,
          bio: args.dto.bio ?? null,
          contactGate: (args.dto.contactGate as any) ?? "REQUEST_REQUIRED",
          indexingEnabled: args.dto.indexingEnabled ?? false,
          themeKey: args.dto.themeKey ?? null,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          headline: true,
          bio: true,
          contactGate: true,
          indexingEnabled: true,
          themeKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        mode: this.mapModeToPublicResponse({
          cardPublicId: card.publicId,
          mode: created,
        }),
      };
    } catch (err: any) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException("Mode slug already exists");
      }
      throw err;
    }
  }

  async updateMyUsername(args: {
    userId: string;
    dto: UpdateCardUsernameDto;
  }): Promise<UpdateCardUsernameResponse> {
    const premium = await this.isUserPremium(args.userId);
    if (!premium) {
      throw new ForbiddenException({
        code: "PREMIUM_REQUIRED",
        message: "Vanity username requires premium",
      });
    }

    const desired = CardService.normalizeUsername(args.dto.username);
    const now = new Date();

    const card =
      (await this.prisma.personalCard.findUnique({
        where: { userId: args.userId },
        select: {
          id: true,
          username: true,
          usernameUpdatedAt: true,
        },
      })) ??
      (await this.prisma.personalCard.create({
        data: { userId: args.userId, publicId: randomUUID() },
        select: { id: true, username: true, usernameUpdatedAt: true },
      }));

    if (card.username === desired) {
      return { username: desired };
    }

    if (card.usernameUpdatedAt) {
      const cooldownMs =
        CardService.USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      const nextAllowedAt = new Date(card.usernameUpdatedAt.getTime() + cooldownMs);
      if (now.getTime() < nextAllowedAt.getTime()) {
        throw new ForbiddenException({
          code: "CARD_USERNAME_COOLDOWN",
          message: "Username can only be changed once per 12 months",
        });
      }
    }

    try {
      const updated = await this.prisma.personalCard.update({
        where: { id: card.id },
        data: {
          username: desired,
          usernameUpdatedAt: now,
        },
        select: { username: true },
      });

      return { username: updated.username ?? desired };
    } catch (err: any) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ConflictException({
          code: "CARD_USERNAME_TAKEN",
          message: "Username is already taken",
        });
      }
      throw err;
    }
  }

  async resolveUsername(args: { username: string }): Promise<ResolveUsernameResponse> {
    const normalized = CardService.normalizeUsername(args.username);

    const card = await this.prisma.personalCard.findFirst({
      where: {
        username: normalized,
        modes: { some: { indexingEnabled: true } },
      },
      select: { publicId: true },
    });

    if (!card) {
      throw new NotFoundException("Username not found");
    }

    return { publicId: card.publicId };
  }

  async getModeAnalytics(args: {
    userId: string;
    modeId: string;
  }): Promise<CardModeAnalyticsResponse> {
    const now = new Date();

    const mode = await this.prisma.cardMode.findUnique({
      where: { id: args.modeId },
      select: {
        id: true,
        card: { select: { userId: true } },
        analytics: {
          select: {
            viewsTotal: true,
            lastViewedAt: true,
            contactRequestsTotal: true,
            approvalsTotal: true,
            denialsTotal: true,
          },
        },
      },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    if (mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this mode");
    }

    const activeGrantsTotal = await this.prisma.cardContactGrant.count({
      where: {
        modeId: args.modeId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });

    return {
      modeId: mode.id,
      viewsTotal: CardService.bigIntToSafeNumber(mode.analytics?.viewsTotal ?? 0n),
      lastViewedAt: mode.analytics?.lastViewedAt
        ? mode.analytics.lastViewedAt.toISOString()
        : undefined,
      contactRequestsTotal: CardService.bigIntToSafeNumber(
        mode.analytics?.contactRequestsTotal ?? 0n,
      ),
      approvalsTotal: CardService.bigIntToSafeNumber(
        mode.analytics?.approvalsTotal ?? 0n,
      ),
      denialsTotal: CardService.bigIntToSafeNumber(mode.analytics?.denialsTotal ?? 0n),
      activeGrantsTotal,
    };
  }

  async listMyModeAnalytics(args: {
    userId: string;
  }): Promise<ListCardModeAnalyticsResponse> {
    const now = new Date();

    const modes = await this.prisma.cardMode.findMany({
      where: { card: { userId: args.userId } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        analytics: {
          select: {
            viewsTotal: true,
            lastViewedAt: true,
            contactRequestsTotal: true,
            approvalsTotal: true,
            denialsTotal: true,
          },
        },
      },
    });

    if (!modes.length) {
      return { items: [] };
    }

    const activeGrantCounts = await this.prisma.cardContactGrant.groupBy({
      by: ["modeId"],
      where: {
        modeId: { in: modes.map((m) => m.id) },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      _count: { _all: true },
    });

    const activeGrantsByModeId = new Map(
      activeGrantCounts.map((g) => [g.modeId, g._count._all]),
    );

    return {
      items: modes.map((m) => ({
        modeId: m.id,
        viewsTotal: CardService.bigIntToSafeNumber(m.analytics?.viewsTotal ?? 0n),
        lastViewedAt: m.analytics?.lastViewedAt
          ? m.analytics.lastViewedAt.toISOString()
          : undefined,
        contactRequestsTotal: CardService.bigIntToSafeNumber(
          m.analytics?.contactRequestsTotal ?? 0n,
        ),
        approvalsTotal: CardService.bigIntToSafeNumber(
          m.analytics?.approvalsTotal ?? 0n,
        ),
        denialsTotal: CardService.bigIntToSafeNumber(m.analytics?.denialsTotal ?? 0n),
        activeGrantsTotal: activeGrantsByModeId.get(m.id) ?? 0,
      })),
    };
  }

  async getPublicModeView(args: {
    publicId: string;
    modeSlug: string;
  }): Promise<GetPublicCardModeResponse> {
    const now = new Date();

    const card = await this.prisma.personalCard.findUnique({
      where: { publicId: args.publicId },
      select: { id: true, publicId: true, userId: true },
    });

    if (!card) {
      throw new NotFoundException("Card not found");
    }

    const mode = await this.prisma.cardMode.findUnique({
      where: {
        cardId_slug: {
          cardId: card.id,
          slug: args.modeSlug,
        },
      },
      include: {
        attachments: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    await this.prisma.cardModeAnalytics.upsert({
      where: { modeId: mode.id },
      create: { modeId: mode.id, viewsTotal: 1n, lastViewedAt: now },
      update: { viewsTotal: { increment: 1n }, lastViewedAt: now },
      select: { modeId: true },
    });

    // Defense-in-depth: even if the query is widened later, never leak revoked/expired attachments.
    const activeAttachments = (mode.attachments ?? []).filter((a) => {
      if (a.revokedAt) return false;
      if (a.expiresAt && a.expiresAt.getTime() <= now.getTime()) return false;
      return true;
    });

    const albumRefIds = Array.from(
      new Set(
        activeAttachments
          .filter((a) => a.kind === "ALBUM")
          .map((a) => a.refId)
          .filter((id) => typeof id === "string" && id.length > 0),
      ),
    );

    const activeShares = albumRefIds.length
      ? await this.prisma.sharedAlbum.findMany({
          where: {
            ownerUserId: card.userId,
            albumId: { in: albumRefIds },
            revokedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true, albumId: true, expiresAt: true },
        })
      : [];

    const shareByAlbumId = new Map(
      activeShares.map((s) => [s.albumId, { id: s.id, expiresAt: s.expiresAt }]),
    );

    const webAppUrl = this.config.webAppUrl.replace(/\/+$/, "");

    const publicAttachments: CardAttachmentResponse[] = [];
    for (const a of activeAttachments) {
      if (a.kind === "ALBUM") {
        const share = shareByAlbumId.get(a.refId);
        if (!share) {
          continue;
        }

        publicAttachments.push({
          id: a.id,
          kind: a.kind as unknown as CardAttachmentKind,
          refId: a.refId,
          label: a.label ?? undefined,
          sortOrder: a.sortOrder,
          expiresAt: a.expiresAt ? a.expiresAt.toISOString() : undefined,
          revokedAt: a.revokedAt ? a.revokedAt.toISOString() : undefined,
          resolvedLink: {
            kind: "SHARED_ALBUM",
            shareId: share.id,
            shareLink: `${webAppUrl}/shared/${share.id}`,
            expiresAt: share.expiresAt.toISOString(),
          },
        });
        continue;
      }

      publicAttachments.push({
        id: a.id,
        kind: a.kind as unknown as CardAttachmentKind,
        refId: a.refId,
        label: a.label ?? undefined,
        sortOrder: a.sortOrder,
        expiresAt: a.expiresAt ? a.expiresAt.toISOString() : undefined,
        revokedAt: a.revokedAt ? a.revokedAt.toISOString() : undefined,
      });
    }

    return {
      mode: {
        modeId: mode.id,
        cardPublicId: card.publicId,
        slug: mode.slug,

        name: mode.name,
        headline: mode.headline ?? undefined,
        bio: mode.bio ?? undefined,

        contactGate: mode.contactGate as unknown as CardContactGate,
        indexingEnabled: mode.indexingEnabled,
        themeKey: mode.themeKey ?? undefined,

        createdAt: mode.createdAt.toISOString(),
        updatedAt: mode.updatedAt.toISOString(),
      },
      attachments: publicAttachments,
    };
  }

  async createModeAttachment(args: {
    userId: string;
    modeId: string;
    dto: CreateCardAttachmentDto;
  }): Promise<CardAttachmentResponse> {
    const now = new Date();

    const mode = await this.prisma.cardMode.findUnique({
      where: { id: args.modeId },
      select: { id: true, card: { select: { userId: true } } },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    if (mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this mode");
    }

    if (args.dto.kind !== "ALBUM") {
      throw new BadRequestException("Only ALBUM attachments are supported");
    }

    const album = await this.prisma.album.findUnique({
      where: { id: args.dto.refId },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!album || album.userId !== args.userId) {
      throw new NotFoundException("Album not found");
    }

    if (album.isDeleted) {
      throw new BadRequestException("Album is deleted");
    }

    const existing = await this.prisma.cardAttachment.findFirst({
      where: {
        modeId: args.modeId,
        kind: "ALBUM",
        refId: args.dto.refId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Album already attached");
    }

    const sortOrder =
      typeof args.dto.sortOrder === "number" && Number.isFinite(args.dto.sortOrder)
        ? Math.trunc(args.dto.sortOrder)
        : await this.getNextAttachmentSortOrder(args.modeId);

    const created = await this.prisma.cardAttachment.create({
      data: {
        modeId: args.modeId,
        kind: "ALBUM",
        refId: args.dto.refId,
        label: args.dto.label ?? null,
        sortOrder,
      },
      select: {
        id: true,
        kind: true,
        refId: true,
        label: true,
        sortOrder: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    return {
      id: created.id,
      kind: created.kind as unknown as CardAttachmentKind,
      refId: created.refId,
      label: created.label ?? undefined,
      sortOrder: created.sortOrder,
      expiresAt: created.expiresAt ? created.expiresAt.toISOString() : undefined,
      revokedAt: created.revokedAt ? created.revokedAt.toISOString() : undefined,
    };
  }

  async listModeAttachments(args: {
    userId: string;
    modeId: string;
  }): Promise<ListCardAttachmentsResponse> {
    const mode = await this.prisma.cardMode.findUnique({
      where: { id: args.modeId },
      select: { id: true, card: { select: { userId: true } } },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    if (mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this mode");
    }

    const attachments = await this.prisma.cardAttachment.findMany({
      where: { modeId: args.modeId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        refId: true,
        label: true,
        sortOrder: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    return {
      attachments: attachments.map((a) => ({
        id: a.id,
        kind: a.kind as unknown as CardAttachmentKind,
        refId: a.refId,
        label: a.label ?? undefined,
        sortOrder: a.sortOrder,
        expiresAt: a.expiresAt ? a.expiresAt.toISOString() : undefined,
        revokedAt: a.revokedAt ? a.revokedAt.toISOString() : undefined,
      })),
    };
  }

  async reorderModeAttachments(args: {
    userId: string;
    modeId: string;
    dto: ReorderCardAttachmentsDto;
  }): Promise<void> {
    const mode = await this.prisma.cardMode.findUnique({
      where: { id: args.modeId },
      select: { id: true, card: { select: { userId: true } } },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    if (mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this mode");
    }

    const ids = args.dto.items.map((i) => i.attachmentId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException("Duplicate attachmentId in reorder payload");
    }

    await this.prisma.$transaction(async (tx) => {
      const found = await tx.cardAttachment.findMany({
        where: { id: { in: ids } },
        select: { id: true, modeId: true },
      });

      if (found.length !== ids.length) {
        throw new NotFoundException("Attachment not found");
      }

      for (const a of found) {
        if (a.modeId !== args.modeId) {
          throw new ForbiddenException("Attachment does not belong to mode");
        }
      }

      await Promise.all(
        args.dto.items.map((item) =>
          tx.cardAttachment.update({
            where: { id: item.attachmentId },
            data: { sortOrder: item.sortOrder },
            select: { id: true },
          }),
        ),
      );
    });
  }

  async updateAttachment(args: {
    userId: string;
    attachmentId: string;
    dto: UpdateCardAttachmentDto;
  }): Promise<CardAttachmentResponse> {
    const now = new Date();

    const attachment = await this.prisma.cardAttachment.findUnique({
      where: { id: args.attachmentId },
      select: {
        id: true,
        kind: true,
        refId: true,
        label: true,
        sortOrder: true,
        expiresAt: true,
        revokedAt: true,
        modeId: true,
        mode: { select: { card: { select: { userId: true } } } },
      },
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    if (attachment.mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this attachment");
    }

    let expiresAt: Date | null | undefined;
    if (Object.prototype.hasOwnProperty.call(args.dto, "expiresAt")) {
      if (args.dto.expiresAt === null) {
        expiresAt = null;
      } else if (typeof args.dto.expiresAt === "string") {
        const parsed = new Date(args.dto.expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException("Invalid expiresAt");
        }
        if (parsed.getTime() <= now.getTime()) {
          throw new BadRequestException("expiresAt must be in the future");
        }
        expiresAt = parsed;
      }
    }

    const updated = await this.prisma.cardAttachment.update({
      where: { id: args.attachmentId },
      data: {
        label:
          Object.prototype.hasOwnProperty.call(args.dto, "label")
            ? args.dto.label ?? null
            : undefined,
        sortOrder:
          typeof args.dto.sortOrder === "number" && Number.isFinite(args.dto.sortOrder)
            ? Math.trunc(args.dto.sortOrder)
            : undefined,
        expiresAt,
      },
      select: {
        id: true,
        kind: true,
        refId: true,
        label: true,
        sortOrder: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    return {
      id: updated.id,
      kind: updated.kind as unknown as CardAttachmentKind,
      refId: updated.refId,
      label: updated.label ?? undefined,
      sortOrder: updated.sortOrder,
      expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : undefined,
      revokedAt: updated.revokedAt ? updated.revokedAt.toISOString() : undefined,
    };
  }

  async revokeAttachment(args: {
    userId: string;
    attachmentId: string;
  }): Promise<void> {
    const now = new Date();

    const attachment = await this.prisma.cardAttachment.findUnique({
      where: { id: args.attachmentId },
      select: { id: true, revokedAt: true, mode: { select: { card: { select: { userId: true } } } } },
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    if (attachment.mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this attachment");
    }

    if (attachment.revokedAt) {
      return;
    }

    await this.prisma.cardAttachment.update({
      where: { id: args.attachmentId },
      data: { revokedAt: now },
      select: { id: true },
    });
  }

  async deleteAttachment(args: {
    userId: string;
    attachmentId: string;
  }): Promise<void> {
    const attachment = await this.prisma.cardAttachment.findUnique({
      where: { id: args.attachmentId },
      select: { id: true, mode: { select: { card: { select: { userId: true } } } } },
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    if (attachment.mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this attachment");
    }

    await this.prisma.cardAttachment.delete({ where: { id: args.attachmentId } });
  }

  async reorderModeAttachmentsOrdered(args: {
    userId: string;
    modeId: string;
    dto: ReorderCardAttachmentsOrderedDto;
  }): Promise<ReorderCardAttachmentsResponse> {
    const mode = await this.prisma.cardMode.findUnique({
      where: { id: args.modeId },
      select: { id: true, card: { select: { userId: true } } },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }
    if (mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this mode");
    }

    const ids = args.dto.attachmentIds;
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new BadRequestException("Duplicate attachmentId in reorder payload");
    }

    const attachments = await this.prisma.$transaction(async (tx) => {
      const found = await tx.cardAttachment.findMany({
        where: { id: { in: ids } },
        select: { id: true, modeId: true },
      });

      if (found.length !== ids.length) {
        throw new NotFoundException("Attachment not found");
      }
      for (const a of found) {
        if (a.modeId !== args.modeId) {
          throw new ForbiddenException("Attachment does not belong to mode");
        }
      }

      await Promise.all(
        ids.map((attachmentId, index) =>
          tx.cardAttachment.update({
            where: { id: attachmentId },
            data: { sortOrder: index },
            select: { id: true },
          }),
        ),
      );

      const updated = await tx.cardAttachment.findMany({
        where: { modeId: args.modeId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          kind: true,
          refId: true,
          label: true,
          sortOrder: true,
          expiresAt: true,
          revokedAt: true,
        },
      });

      return updated;
    });

    return {
      attachments: attachments.map((a) => ({
        id: a.id,
        kind: a.kind as unknown as CardAttachmentKind,
        refId: a.refId,
        label: a.label ?? undefined,
        sortOrder: a.sortOrder,
        expiresAt: a.expiresAt ? a.expiresAt.toISOString() : undefined,
        revokedAt: a.revokedAt ? a.revokedAt.toISOString() : undefined,
      })),
    };
  }

  private async getNextAttachmentSortOrder(modeId: string): Promise<number> {
    const max = await this.prisma.cardAttachment.findFirst({
      where: { modeId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    return (max?.sortOrder ?? -1) + 1;
  }

  async createContactRequest(args: {
    publicId: string;
    modeSlug: string;
    dto: CreateCardContactRequestDto;
  }): Promise<CreateCardContactRequestResponse> {
    const now = new Date();

    // Progressive trust (minimal): if an email has too many DENIED requests
    // recently for this mode, temporarily block to reduce spam.
    const deniedWindowMs = 7 * 24 * 60 * 60 * 1000;
    const deniedBlockMs = 24 * 60 * 60 * 1000;
    const deniedThreshold = 3;

    const card = await this.prisma.personalCard.findUnique({
      where: { publicId: args.publicId },
      select: { id: true },
    });

    if (!card) {
      // Keep consistent with existing behavior (and avoid leaking info).
      throw new NotFoundException("Card not found");
    }

    const mode = await this.prisma.cardMode.findUnique({
      where: {
        cardId_slug: {
          cardId: card.id,
          slug: args.modeSlug,
        },
      },
      select: {
        id: true,
        contactGate: true,
      },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    if (mode.contactGate === "HIDDEN") {
      // Prefer 404 to avoid confirming existence.
      throw new NotFoundException("Mode not found");
    }

    const requesterEmail = (args.dto.requesterEmail ?? "")
      .trim()
      .toLowerCase();
    const requesterName = (args.dto.requesterName ?? "").trim();

    const since = new Date(
      now.getTime() - CardService.CONTACT_REQUEST_DEDUPE_WINDOW_MS,
    );

    const recentPending = await this.prisma.cardContactRequest.findFirst({
      where: {
        modeId: mode.id,
        requesterEmail,
        status: "PENDING",
        createdAt: { gte: since },
      },
      select: { id: true },
    });

    if (recentPending) {
      throw new ConflictException("Contact request already pending");
    }

    const deniedSince = new Date(now.getTime() - deniedWindowMs);
    const deniedCount = await this.prisma.cardContactRequest.count({
      where: {
        modeId: mode.id,
        requesterEmail,
        status: "DENIED",
        createdAt: { gte: deniedSince },
      },
    });

    if (deniedCount > deniedThreshold) {
      const lastDenied = await this.prisma.cardContactRequest.findFirst({
        where: {
          modeId: mode.id,
          requesterEmail,
          status: "DENIED",
          createdAt: { gte: deniedSince },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
      });

      if (
        lastDenied &&
        lastDenied.createdAt.getTime() >= now.getTime() - deniedBlockMs
      ) {
        throw new ForbiddenException("Too many denied requests; try later");
      }
    }

    const created = await this.prisma.cardContactRequest.create({
      data: {
        modeId: mode.id,
        requesterName,
        requesterEmail,
        requesterPhone: args.dto.requesterPhone ?? null,
        message: args.dto.message ?? null,
      },
      select: { id: true, status: true, createdAt: true },
    });

    await this.prisma.cardModeAnalytics.upsert({
      where: { modeId: mode.id },
      create: { modeId: mode.id, contactRequestsTotal: 1n },
      update: { contactRequestsTotal: { increment: 1n } },
      select: { modeId: true },
    });

    return {
      requestId: created.id,
      status: created.status as unknown as CardContactRequestStatus,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async listModeContactRequests(args: {
    userId: string;
    modeId: string;
    status?: CardContactRequestStatus;
    limit?: number;
  }): Promise<ListCardContactRequestsResponse> {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 50);

    const mode = await this.prisma.cardMode.findUnique({
      where: { id: args.modeId },
      select: {
        id: true,
        card: { select: { userId: true } },
      },
    });

    if (!mode) {
      throw new NotFoundException("Mode not found");
    }

    if (mode.card.userId !== args.userId) {
      throw new ForbiddenException("Not authorized to access this mode");
    }

    const requests = await this.prisma.cardContactRequest.findMany({
      where: {
        modeId: args.modeId,
        ...(args.status ? { status: args.status as any } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        requesterName: true,
        requesterEmail: true,
        requesterPhone: true,
        message: true,
        createdAt: true,
      },
    });

    return {
      items: requests.map((r) => ({
        id: r.id,
        status: r.status as unknown as CardContactRequestStatus,
        requesterName: r.requesterName,
        requesterEmail: r.requesterEmail,
        requesterPhone: r.requesterPhone ?? undefined,
        message: r.message ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async approveContactRequest(args: {
    userId: string;
    requestId: string;
    dto: ApproveCardContactRequestDto;
  }): Promise<ApproveCardContactRequestResponse> {
    const now = new Date();

    const premium = await this.isUserPremium(args.userId);
    const expiresAt = this.resolveGrantExpiresAt(args.dto, now, premium);
    const { rawToken, tokenHash } = makeCardGrantToken();

    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.cardContactRequest.findUnique({
        where: { id: args.requestId },
        select: {
          id: true,
          modeId: true,
          status: true,
          mode: { select: { card: { select: { userId: true } } } },
        },
      });

      if (!request) {
        throw new NotFoundException("Contact request not found");
      }

      if (request.mode.card.userId !== args.userId) {
        throw new ForbiddenException("Not authorized to approve this request");
      }

      if (request.status !== "PENDING") {
        throw new ConflictException("Contact request is not pending");
      }

      const grant = await tx.cardContactGrant.create({
        data: {
          modeId: request.modeId,
          requestId: request.id,
          tokenHash,
          expiresAt,
        },
        select: { id: true, expiresAt: true },
      });

      await tx.cardContactRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
        select: { id: true },
      });

      await tx.cardModeAnalytics.upsert({
        where: { modeId: request.modeId },
        create: { modeId: request.modeId, approvalsTotal: 1n },
        update: { approvalsTotal: { increment: 1n } },
        select: { modeId: true },
      });

      return grant;
    });

    return {
      grantId: result.id,
      token: rawToken,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  async denyContactRequest(args: {
    userId: string;
    requestId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.cardContactRequest.findUnique({
        where: { id: args.requestId },
        select: {
          id: true,
          modeId: true,
          status: true,
          mode: { select: { card: { select: { userId: true } } } },
        },
      });

      if (!request) {
        throw new NotFoundException("Contact request not found");
      }

      if (request.mode.card.userId !== args.userId) {
        throw new ForbiddenException("Not authorized to deny this request");
      }

      if (request.status !== "PENDING") {
        throw new ConflictException("Contact request is not pending");
      }

      await tx.cardContactRequest.update({
        where: { id: request.id },
        data: { status: "DENIED" },
        select: { id: true },
      });

      await tx.cardModeAnalytics.upsert({
        where: { modeId: request.modeId },
        create: { modeId: request.modeId, denialsTotal: 1n },
        update: { denialsTotal: { increment: 1n } },
        select: { modeId: true },
      });
    });
  }

  async revokeContactGrant(args: {
    userId: string;
    grantId: string;
  }): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const grant = await tx.cardContactGrant.findUnique({
        where: { id: args.grantId },
        select: {
          id: true,
          revokedAt: true,
          requestId: true,
          mode: { select: { card: { select: { userId: true } } } },
        },
      });

      if (!grant) {
        throw new NotFoundException("Contact grant not found");
      }

      if (grant.mode.card.userId !== args.userId) {
        throw new ForbiddenException("Not authorized to revoke this grant");
      }

      if (!grant.revokedAt) {
        await tx.cardContactGrant.update({
          where: { id: grant.id },
          data: { revokedAt: now },
          select: { id: true },
        });
      }

      if (grant.requestId) {
        await tx.cardContactRequest.update({
          where: { id: grant.requestId },
          data: { status: "REVOKED" },
          select: { id: true },
        });
      }
    });
  }

  private resolveGrantExpiresAt(
    dto: ApproveCardContactRequestDto,
    now: Date,
    premium: boolean,
  ) {
    if (dto?.expiresAt) {
      if (!premium) {
        throw new ForbiddenException({
          code: "CARD_CUSTOM_EXPIRY_REQUIRES_PREMIUM",
          message: "Custom expiresAt requires premium",
        });
      }

      const parsed = new Date(dto.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("Invalid expiresAt");
      }
      if (parsed.getTime() <= now.getTime()) {
        throw new BadRequestException("expiresAt must be in the future");
      }

      const maxAt = new Date(now);
      maxAt.setUTCDate(maxAt.getUTCDate() + CardService.CONTACT_GRANT_MAX_EXPIRES_IN_DAYS);
      if (parsed.getTime() > maxAt.getTime()) {
        throw new BadRequestException(
          `expiresAt must be within ${CardService.CONTACT_GRANT_MAX_EXPIRES_IN_DAYS} days`,
        );
      }

      return parsed;
    }

    const daysRaw = dto?.expiresInDays;
    const days =
      typeof daysRaw === "number" && Number.isFinite(daysRaw)
        ? Math.trunc(daysRaw)
        : CardService.CONTACT_GRANT_DEFAULT_EXPIRES_IN_DAYS;

    if (!Number.isInteger(days) || days < 1) {
      throw new BadRequestException("expiresInDays must be >= 1");
    }

    if (!premium && ![7, 30].includes(days)) {
      throw new BadRequestException("expiresInDays must be 7 or 30");
    }

    if (days > CardService.CONTACT_GRANT_MAX_EXPIRES_IN_DAYS) {
      throw new BadRequestException(
        `expiresInDays must be <= ${CardService.CONTACT_GRANT_MAX_EXPIRES_IN_DAYS}`,
      );
    }

    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
    return expiresAt;
  }

  async generateVCard(args: {
    rawToken: string;
    publicId: string;
    modeSlug: string;
  }): Promise<{ filename: string; vcf: string }> {
    const { displayName, email } = await this.getActiveGrantContactForMode({
      rawToken: args.rawToken,
      publicId: args.publicId,
      modeSlug: args.modeSlug,
    });

    const fullName = displayName?.trim().length
      ? displayName.trim()
      : "Booster Vault Contact";
    const normalizedEmail = (email ?? "").trim();

    const lines: string[] = [];
    lines.push("BEGIN:VCARD");
    lines.push("VERSION:3.0");
    lines.push(`FN:${escapeVCardText(fullName)}`);
    if (normalizedEmail) {
      lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardText(normalizedEmail)}`);
    }
    lines.push("END:VCARD");

    return {
      filename: "contact.vcf",
      vcf: `${lines.join("\r\n")}\r\n`,
    };
  }

  async revealContact(args: {
    rawToken: string;
    publicId: string;
    modeSlug: string;
  }): Promise<CardContactRevealResponse> {
    const { displayName, email } = await this.getActiveGrantContactForMode(args);
    return {
      displayName: displayName?.trim().length ? displayName.trim() : undefined,
      email: email?.trim().length ? email.trim() : undefined,
    };
  }

  private async getActiveGrantContactForMode(args: {
    rawToken: string;
    publicId: string;
    modeSlug: string;
  }): Promise<{ grantId: string; displayName?: string; email?: string }> {
    const now = new Date();

    const rawToken = (args.rawToken ?? "").trim();
    if (!rawToken) {
      throw new UnauthorizedException("Missing X-Card-Token header");
    }

    const tokenHash = hashCardToken(rawToken);

    const grant = await this.prisma.cardContactGrant.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        mode: {
          select: {
            slug: true,
            card: {
              select: {
                publicId: true,
                user: {
                  select: {
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!grant) {
      throw new UnauthorizedException("Invalid or expired card token");
    }
    if (grant.revokedAt) {
      throw new UnauthorizedException("Invalid or expired card token");
    }
    if (grant.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException("Invalid or expired card token");
    }
    if (
      grant.mode.card.publicId !== args.publicId ||
      grant.mode.slug !== args.modeSlug
    ) {
      throw new UnauthorizedException("Invalid or expired card token");
    }

    return {
      grantId: grant.id,
      displayName: grant.mode.card.user.displayName ?? undefined,
      email: grant.mode.card.user.email ?? undefined,
    };
  }
}

function escapeVCardText(value: string): string {
  // vCard 3.0 escaping: backslash, semicolon, comma, newlines.
  // RFC 2426/6350-style escaping: \n for line breaks.
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
