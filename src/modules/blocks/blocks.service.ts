import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service";

@Injectable()
export class BlocksService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
