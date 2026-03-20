import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContactRequestStatus as PrismaContactRequestStatus } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";

@Injectable()
export class BlocksService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new BadRequestException("You cannot block yourself");
    }

    const targetUser = await this.prismaService.user.findUnique({
      where: {
        id: blockedUserId,
      },
      select: {
        id: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    const createdAt = new Date();

    const block = await this.prismaService.$transaction(async (tx) => {
      const existingBlock = await tx.block.findUnique({
        where: {
          blockerUserId_blockedUserId: {
            blockerUserId: userId,
            blockedUserId,
          },
        },
        select: {
          id: true,
          blockerUserId: true,
          blockedUserId: true,
          createdAt: true,
        },
      });

      if (existingBlock) {
        return existingBlock;
      }

      const createdBlock = await tx.block.create({
        data: {
          blockerUserId: userId,
          blockedUserId,
          createdAt,
        },
        select: {
          id: true,
          blockerUserId: true,
          blockedUserId: true,
          createdAt: true,
        },
      });

      await tx.contactRequest.updateMany({
        where: {
          status: PrismaContactRequestStatus.PENDING,
          OR: [
            {
              fromUserId: userId,
              toUserId: blockedUserId,
            },
            {
              fromUserId: blockedUserId,
              toUserId: userId,
            },
          ],
        },
        data: {
          status: PrismaContactRequestStatus.CANCELLED,
          respondedAt: createdAt,
        },
      });

      return createdBlock;
    });

    return {
      id: block.id,
      blockedUserId: block.blockedUserId,
      createdAt: block.createdAt,
    };
  }

  async remove(userId: string, blockedUserId: string) {
    await this.prismaService.block.deleteMany({
      where: {
        blockerUserId: userId,
        blockedUserId,
      },
    });

    return {
      success: true,
    };
  }

  async findAll(userId: string) {
    const blocks = await this.prismaService.block.findMany({
      where: {
        blockerUserId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        blockedUserId: true,
        createdAt: true,
      },
    });

    return blocks;
  }

  async isBlockedByUser(
    blockerUserId: string,
    blockedUserId: string,
  ): Promise<boolean> {
    const block = await this.prismaService.block.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId,
          blockedUserId,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(block);
  }

  async assertNoInteractionBlock(actorUserId: string, otherUserId: string) {
    const blocks = await this.prismaService.block.findMany({
      where: {
        OR: [
          {
            blockerUserId: otherUserId,
            blockedUserId: actorUserId,
          },
          {
            blockerUserId: actorUserId,
            blockedUserId: otherUserId,
          },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });

    for (const block of blocks) {
      if (
        block.blockerUserId === otherUserId &&
        block.blockedUserId === actorUserId
      ) {
        throw new ForbiddenException("User has blocked you");
      }

      if (
        block.blockerUserId === actorUserId &&
        block.blockedUserId === otherUserId
      ) {
        throw new ForbiddenException("You have blocked this user");
      }
    }
  }
}
