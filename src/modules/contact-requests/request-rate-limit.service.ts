import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";

const REQUESTS_PER_HOUR_LIMIT = 20;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

@Injectable()
export class RequestRateLimitService {
  constructor(private readonly prismaService: PrismaService) {}

  async reserveAndCreate<T>(
    userId: string,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    now = new Date(),
  ): Promise<T> {
    return this.prismaService.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`contact-request-rate:${userId}`}));
      `;

      const windowStart = new Date(now.getTime() - ONE_HOUR_IN_MS);
      const attempts = await tx.contactRequest.count({
        where: {
          fromUserId: userId,
          createdAt: {
            gte: windowStart,
          },
        },
      });

      if (attempts >= REQUESTS_PER_HOUR_LIMIT) {
        throw new HttpException(
          "Requests are temporarily limited",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return callback(tx);
    });
  }

  async consume(userId: string, now = new Date()): Promise<void> {
    const windowStart = new Date(now.getTime() - ONE_HOUR_IN_MS);
    const attempts = await this.prismaService.contactRequest.count({
      where: {
        fromUserId: userId,
        createdAt: {
          gte: windowStart,
        },
      },
    });

    if (attempts >= REQUESTS_PER_HOUR_LIMIT) {
      throw new HttpException(
        "Requests are temporarily limited",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
