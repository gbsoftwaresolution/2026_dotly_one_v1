import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
} from "@prisma/client";
import { randomBytes } from "crypto";

import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PersonasService } from "../personas/personas.service";
import { RelationshipsService } from "../relationships/relationships.service";

import { ConnectQuickConnectQrDto } from "./dto/connect-quick-connect-qr.dto";
import { CreateQuickConnectQrDto } from "./dto/create-quick-connect-qr.dto";
import {
  qrResolutionSelect,
  toQrLink,
  toQrResolutionView,
} from "./qr.presenter";

const noopNotificationsService: Pick<NotificationsService, "createSafe"> = {
  createSafe: async () => undefined,
};

@Injectable()
export class QrService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly personasService: PersonasService,
    private readonly blocksService: BlocksService,
    private readonly relationshipsService: RelationshipsService,
    private readonly contactMemoryService: ContactMemoryService,
    private readonly notificationsService: Pick<
      NotificationsService,
      "createSafe"
    > = noopNotificationsService,
  ) {}

  async createProfileQr(userId: string, personaId: string) {
    const persona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      personaId,
    );
    const existingToken = await this.prismaService.qRAccessToken.findFirst({
      where: {
        personaId: persona.id,
        type: PrismaQrType.profile,
        status: PrismaQrStatus.active,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        code: true,
        type: true,
      },
    });

    if (existingToken) {
      return {
        id: existingToken.id,
        code: existingToken.code,
        type: existingToken.type,
        url: this.buildQrUrl(existingToken.code),
      };
    }

    const token = await this.prismaService.qRAccessToken.create({
      data: {
        personaId: persona.id,
        type: PrismaQrType.profile,
        code: await this.generateUniqueCode(),
        rules: {},
        status: PrismaQrStatus.active,
      },
      select: {
        id: true,
        code: true,
        type: true,
      },
    });

    return {
      id: token.id,
      code: token.code,
      type: token.type,
      url: this.buildQrUrl(token.code),
    };
  }

  async createQuickConnectQr(
    userId: string,
    personaId: string,
    createQuickConnectQrDto: CreateQuickConnectQrDto,
  ) {
    const persona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      personaId,
    );
    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() +
        createQuickConnectQrDto.durationHours * 60 * 60 * 1000,
    );

    const token = await this.prismaService.qRAccessToken.create({
      data: {
        personaId: persona.id,
        type: PrismaQrType.quick_connect,
        code: await this.generateUniqueCode(),
        rules: {
          durationHours: createQuickConnectQrDto.durationHours,
        },
        startsAt,
        endsAt,
        maxUses: createQuickConnectQrDto.maxUses ?? null,
        status: PrismaQrStatus.active,
      },
      select: {
        id: true,
        code: true,
        type: true,
        startsAt: true,
        endsAt: true,
        maxUses: true,
      },
    });

    return {
      id: token.id,
      code: token.code,
      type: token.type,
      url: this.buildQrUrl(token.code),
      startsAt: token.startsAt,
      endsAt: token.endsAt,
      maxUses: token.maxUses,
    };
  }

  async resolveQr(code: string) {
    return this.prismaService.$transaction(async (tx) => {
      const now = new Date();
      const token = await tx.qRAccessToken.findUnique({
        where: {
          code,
        },
        select: {
          id: true,
          code: true,
          type: true,
          startsAt: true,
          endsAt: true,
          maxUses: true,
          usedCount: true,
          status: true,
        },
      });

      if (!token) {
        throw new NotFoundException("QR code not found");
      }

      await this.assertResolvableToken(tx, token, now);

      const resolvedToken = await tx.qRAccessToken.findUnique({
        where: {
          id: token.id,
        },
        select: qrResolutionSelect,
      });

      if (!resolvedToken) {
        throw new NotFoundException("QR code not found");
      }

      if (
        resolvedToken.maxUses !== null &&
        resolvedToken.usedCount >= resolvedToken.maxUses &&
        resolvedToken.status === PrismaQrStatus.active
      ) {
        await this.markTokenExpired(tx, token.id);
      }

      return toQrResolutionView(resolvedToken);
    });
  }

  async connectQuickConnectQr(
    userId: string,
    code: string,
    connectQuickConnectQrDto: ConnectQuickConnectQrDto,
  ) {
    const fromPersona = await this.personasService.findOwnedPersonaIdentity(
      userId,
      connectQuickConnectQrDto.fromPersonaId,
    );

    return this.prismaService.$transaction(async (tx) => {
      const now = new Date();
      const senderUser = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          isVerified: true,
        },
      });

      if (!senderUser) {
        throw new NotFoundException("User not found");
      }

      const token = await tx.qRAccessToken.findUnique({
        where: {
          code,
        },
        select: {
          id: true,
          type: true,
          startsAt: true,
          endsAt: true,
          maxUses: true,
          usedCount: true,
          status: true,
          rules: true,
          persona: {
            select: {
              id: true,
              userId: true,
              username: true,
              fullName: true,
              jobTitle: true,
              companyName: true,
              tagline: true,
              profilePhotoUrl: true,
              verifiedOnly: true,
            },
          },
        },
      });

      if (!token) {
        throw new NotFoundException("QR code not found");
      }

      if (token.type !== PrismaQrType.quick_connect) {
        throw new ConflictException("QR code does not support instant connect");
      }

      await this.assertResolvableToken(tx, token, now);

      if (token.persona.userId === userId) {
        throw new BadRequestException("You cannot connect to your own persona");
      }

      await this.blocksService.assertNoInteractionBlockInTransaction(
        tx,
        userId,
        token.persona.userId,
      );

      if (token.persona.verifiedOnly && !senderUser.isVerified) {
        throw new ForbiddenException("Verified profiles only");
      }

      const durationHours = this.getQuickConnectDurationHours(token.rules);
      const accessEndAt = new Date(
        now.getTime() + durationHours * 60 * 60 * 1000,
      );

      const consumeResult = await tx.qRAccessToken.updateMany({
        where: {
          id: token.id,
          type: PrismaQrType.quick_connect,
          status: PrismaQrStatus.active,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [
            {
              OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
            ...(token.maxUses === null
              ? []
              : [{ usedCount: { lt: token.maxUses } }]),
          ],
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      if (consumeResult.count !== 1) {
        const latestToken = await tx.qRAccessToken.findUnique({
          where: {
            id: token.id,
          },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            maxUses: true,
            usedCount: true,
            status: true,
          },
        });

        if (!latestToken) {
          throw new NotFoundException("QR code not found");
        }

        await this.assertResolvableToken(tx, latestToken, now);

        throw new ConflictException("QR code is no longer available");
      }

      const relationship =
        await this.relationshipsService.createOrRefreshInstantAccessRelationship(
          tx,
          {
            ownerUserId: userId,
            targetUserId: token.persona.userId,
            ownerPersonaId: fromPersona.id,
            targetPersonaId: token.persona.id,
            sourceId: token.id,
            accessStartAt: now,
            accessEndAt,
          },
        );

      await this.contactMemoryService.createInitialMemory(tx, {
        relationshipId: relationship.id,
        metAt: now,
        sourceLabel: "Quick Connect QR",
      });

      await Promise.all([
        this.notificationsService.createSafe(
          {
            userId,
            type: NotificationType.InstantConnect,
            title: "Instant connect",
            body: `You connected instantly with ${token.persona.fullName}`,
            data: {
              relationshipId: relationship.id,
              targetPersonaId: token.persona.id,
            },
          },
          tx,
        ),
        this.notificationsService.createSafe(
          {
            userId: token.persona.userId,
            type: NotificationType.InstantConnect,
            title: "Instant connect",
            body: `${fromPersona.fullName ?? "Someone"} connected with your QR`,
            data: {
              relationshipId: relationship.id,
              sourcePersonaId: fromPersona.id,
            },
          },
          tx,
        ),
      ]);

      if (token.maxUses !== null && token.usedCount + 1 >= token.maxUses) {
        await this.markTokenExpired(tx, token.id);
      }

      return {
        relationshipId: relationship.id,
        state: "instant_access" as const,
        accessStartAt: relationship.accessStartAt,
        accessEndAt: relationship.accessEndAt,
        targetPersona: {
          id: token.persona.id,
          username: token.persona.username,
          fullName: token.persona.fullName,
          jobTitle: token.persona.jobTitle,
          companyName: token.persona.companyName,
          tagline: token.persona.tagline,
          profilePhotoUrl: token.persona.profilePhotoUrl,
        },
      };
    });
  }

  private async assertResolvableToken(
    tx: Prisma.TransactionClient,
    token: {
      id: string;
      status: PrismaQrStatus;
      startsAt: Date | null;
      endsAt: Date | null;
      maxUses: number | null;
      usedCount: number;
    },
    now: Date,
  ) {
    if (token.status === PrismaQrStatus.disabled) {
      throw new ConflictException("QR code is disabled");
    }

    if (token.status === PrismaQrStatus.expired) {
      throw new ConflictException("QR code has expired");
    }

    if (token.startsAt && now < token.startsAt) {
      throw new ConflictException("QR code is not active yet");
    }

    if (token.endsAt && now > token.endsAt) {
      await this.markTokenExpired(tx, token.id);
      throw new ConflictException("QR code has expired");
    }

    if (token.maxUses !== null && token.usedCount >= token.maxUses) {
      await this.markTokenExpired(tx, token.id);
      throw new ConflictException("QR code usage limit reached");
    }
  }

  private getQuickConnectDurationHours(rules: Prisma.JsonValue): number {
    if (
      rules === null ||
      typeof rules !== "object" ||
      Array.isArray(rules) ||
      typeof rules.durationHours !== "number" ||
      !Number.isInteger(rules.durationHours) ||
      rules.durationHours < 1
    ) {
      throw new ConflictException("QR code has invalid quick connect rules");
    }

    return rules.durationHours;
  }

  private async markTokenExpired(
    tx: Prisma.TransactionClient,
    tokenId: string,
  ) {
    await tx.qRAccessToken.updateMany({
      where: {
        id: tokenId,
        status: {
          not: PrismaQrStatus.disabled,
        },
      },
      data: {
        status: PrismaQrStatus.expired,
      },
    });
  }

  private buildQrUrl(code: string): string {
    const baseUrl = this.configService.get<string>(
      "qr.baseUrl",
      "https://dotly.id/q",
    );

    return toQrLink(baseUrl, code);
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(9).toString("base64url");
      const existingToken = await this.prismaService.qRAccessToken.findUnique({
        where: {
          code,
        },
        select: {
          id: true,
        },
      });

      if (!existingToken) {
        return code;
      }
    }

    throw new ConflictException("Unable to generate a unique QR code");
  }
}
