import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";

export type TokenType = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Create a one-time token for a specific user and type
   * @param userId The user ID
   * @param type Token type (EMAIL_VERIFICATION or PASSWORD_RESET)
   * @param expiresInHours Expiration time in hours
   * @returns The raw token (to be sent to user) and the hashed token (stored in DB)
   */
  async createToken(
    userId: string,
    type: TokenType,
    expiresInHours: number = 24,
  ): Promise<{ rawToken: string; hashedToken: string }> {
    const rawToken = this.passwordService.generateRandomToken(32);
    const hashedToken =
      await this.passwordService.generateHashForToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    await this.prisma.token.create({
      data: {
        userId,
        type,
        hash: hashedToken,
        expiresAt,
        usedAt: null,
      },
    });

    // Clean up any expired tokens for this user and type
    await this.cleanupExpiredTokens(userId, type);

    return { rawToken, hashedToken };
  }

  /**
   * Validate and consume a token
   * @param rawToken The raw token from user
   * @param type Expected token type
   * @returns User ID if valid, null if invalid
   */
  async validateAndConsumeToken(
    rawToken: string,
    type: TokenType,
  ): Promise<string | null> {
    const hashedToken =
      await this.passwordService.generateHashForToken(rawToken);

    const token = await this.prisma.token.findFirst({
      where: {
        hash: hashedToken,
        type,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!token) {
      return null;
    }

    // Mark token as used
    await this.prisma.token.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });

    return token.userId;
  }

  /**
   * Clean up expired tokens for a user and type
   */
  private async cleanupExpiredTokens(
    userId: string,
    type: TokenType,
  ): Promise<void> {
    try {
      await this.prisma.token.deleteMany({
        where: {
          userId,
          type,
          OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup expired tokens for user ${userId}: ${error}`,
      );
    }
  }

  /**
   * Check if a user has a valid token of a specific type
   */
  async hasValidToken(userId: string, type: TokenType): Promise<boolean> {
    const token = await this.prisma.token.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return !!token;
  }

  /**
   * Invalidate all tokens of a specific type for a user
   */
  async invalidateAllTokens(userId: string, type: TokenType): Promise<void> {
    await this.prisma.token.updateMany({
      where: {
        userId,
        type,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }
}
