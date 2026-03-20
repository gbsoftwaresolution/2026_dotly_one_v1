import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactRelationshipState as PrismaContactRelationshipState,
  ContactRequestSourceType as PrismaContactRequestSourceType,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";

@Injectable()
export class RelationshipsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createApprovedRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceType: PrismaContactRequestSourceType;
      sourceId?: string | null;
    },
  ) {
    try {
      const relationship = await tx.contactRelationship.create({
        data: {
          ownerUserId: data.ownerUserId,
          targetUserId: data.targetUserId,
          ownerPersonaId: data.ownerPersonaId,
          targetPersonaId: data.targetPersonaId,
          state: PrismaContactRelationshipState.APPROVED,
          sourceType: data.sourceType,
          sourceId: data.sourceId ?? null,
        },
        select: {
          id: true,
        },
      });

      await tx.contactRelationship.create({
        data: {
          ownerUserId: data.targetUserId,
          targetUserId: data.ownerUserId,
          ownerPersonaId: data.targetPersonaId,
          targetPersonaId: data.ownerPersonaId,
          state: PrismaContactRelationshipState.APPROVED,
          sourceType: data.sourceType,
          sourceId: data.sourceId ?? null,
        },
        select: {
          id: true,
        },
      });

      return relationship;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Contact relationship already exists");
      }

      throw error;
    }
  }

  async createOrRefreshInstantAccessRelationship(
    tx: Prisma.TransactionClient,
    data: {
      ownerUserId: string;
      targetUserId: string;
      ownerPersonaId: string;
      targetPersonaId: string;
      sourceId: string;
      accessStartAt: Date;
      accessEndAt: Date;
    },
  ) {
    const existingRelationship = await tx.contactRelationship.findUnique({
      where: {
        ownerUserId_targetUserId_ownerPersonaId_targetPersonaId: {
          ownerUserId: data.ownerUserId,
          targetUserId: data.targetUserId,
          ownerPersonaId: data.ownerPersonaId,
          targetPersonaId: data.targetPersonaId,
        },
      },
      select: {
        id: true,
        state: true,
        accessEndAt: true,
      },
    });

    if (!existingRelationship) {
      try {
        return await tx.contactRelationship.create({
          data: {
            ownerUserId: data.ownerUserId,
            targetUserId: data.targetUserId,
            ownerPersonaId: data.ownerPersonaId,
            targetPersonaId: data.targetPersonaId,
            state: PrismaContactRelationshipState.INSTANT_ACCESS,
            sourceType: PrismaContactRequestSourceType.QR,
            sourceId: data.sourceId,
            accessStartAt: data.accessStartAt,
            accessEndAt: data.accessEndAt,
          },
          select: {
            id: true,
            state: true,
            accessStartAt: true,
            accessEndAt: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictException(
            "An active instant access relationship already exists",
          );
        }

        throw error;
      }
    }

    const normalizedRelationship = await this.expireRelationshipIfNeeded(
      tx,
      existingRelationship,
    );

    if (
      normalizedRelationship.state === PrismaContactRelationshipState.APPROVED
    ) {
      throw new ConflictException("Contact relationship already exists");
    }

    if (
      normalizedRelationship.state ===
      PrismaContactRelationshipState.INSTANT_ACCESS
    ) {
      throw new ConflictException(
        "An active instant access relationship already exists",
      );
    }

    return tx.contactRelationship.update({
      where: {
        id: normalizedRelationship.id,
      },
      data: {
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
        sourceType: PrismaContactRequestSourceType.QR,
        sourceId: data.sourceId,
        accessStartAt: data.accessStartAt,
        accessEndAt: data.accessEndAt,
      },
      select: {
        id: true,
        state: true,
        accessStartAt: true,
        accessEndAt: true,
      },
    });
  }

  async upgradeOwnedRelationship(userId: string, relationshipId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipForMutation(
        tx,
        userId,
        relationshipId,
      );
      const normalizedRelationship = await this.expireRelationshipIfNeeded(
        tx,
        relationship,
      );

      if (
        normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
      ) {
        throw new ConflictException(
          "Expired instant access relationships cannot be upgraded",
        );
      }

      if (
        normalizedRelationship.state !==
        PrismaContactRelationshipState.INSTANT_ACCESS
      ) {
        throw new ConflictException(
          "Only instant access relationships can be upgraded",
        );
      }

      await tx.contactRelationship.update({
        where: {
          id: normalizedRelationship.id,
        },
        data: {
          state: PrismaContactRelationshipState.APPROVED,
          accessStartAt: null,
          accessEndAt: null,
        },
      });

      return {
        relationshipId: normalizedRelationship.id,
        state: "approved" as const,
      };
    });
  }

  async expireOwnedRelationship(userId: string, relationshipId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const relationship = await this.getOwnedRelationshipForMutation(
        tx,
        userId,
        relationshipId,
      );
      const normalizedRelationship = await this.expireRelationshipIfNeeded(
        tx,
        relationship,
      );

      if (
        normalizedRelationship.state === PrismaContactRelationshipState.EXPIRED
      ) {
        return {
          relationshipId: normalizedRelationship.id,
          state: "expired" as const,
        };
      }

      if (
        normalizedRelationship.state !==
        PrismaContactRelationshipState.INSTANT_ACCESS
      ) {
        throw new ConflictException(
          "Only instant access relationships can be expired",
        );
      }

      await tx.contactRelationship.update({
        where: {
          id: normalizedRelationship.id,
        },
        data: {
          state: PrismaContactRelationshipState.EXPIRED,
          accessEndAt:
            normalizedRelationship.accessEndAt !== null &&
            normalizedRelationship.accessEndAt < new Date()
              ? normalizedRelationship.accessEndAt
              : new Date(),
        },
      });

      return {
        relationshipId: normalizedRelationship.id,
        state: "expired" as const,
      };
    });
  }

  async expireOwnedExpiredRelationships(
    userId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    await prisma.contactRelationship.updateMany({
      where: {
        ownerUserId: userId,
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
        accessEndAt: {
          lt: new Date(),
        },
      },
      data: {
        state: PrismaContactRelationshipState.EXPIRED,
      },
    });
  }

  async expireRelationshipIfNeeded<
    T extends {
      id: string;
      state: PrismaContactRelationshipState;
      accessEndAt: Date | null;
    },
  >(
    prisma: Prisma.TransactionClient | PrismaService,
    relationship: T,
  ): Promise<T> {
    if (
      relationship.state !== PrismaContactRelationshipState.INSTANT_ACCESS ||
      relationship.accessEndAt === null ||
      relationship.accessEndAt >= new Date()
    ) {
      return relationship;
    }

    await prisma.contactRelationship.updateMany({
      where: {
        id: relationship.id,
        state: PrismaContactRelationshipState.INSTANT_ACCESS,
      },
      data: {
        state: PrismaContactRelationshipState.EXPIRED,
        accessEndAt: relationship.accessEndAt,
      },
    });

    return {
      ...relationship,
      state: PrismaContactRelationshipState.EXPIRED,
    };
  }

  private async getOwnedRelationshipForMutation(
    tx: Prisma.TransactionClient,
    userId: string,
    relationshipId: string,
  ) {
    const relationship = await tx.contactRelationship.findUnique({
      where: {
        id: relationshipId,
      },
      select: {
        id: true,
        ownerUserId: true,
        state: true,
        accessEndAt: true,
      },
    });

    if (!relationship) {
      throw new NotFoundException("Relationship not found");
    }

    if (relationship.ownerUserId !== userId) {
      throw new ForbiddenException(
        "You are not allowed to update this relationship",
      );
    }

    return relationship;
  }
}
