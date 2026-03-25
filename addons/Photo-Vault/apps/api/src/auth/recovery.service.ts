import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EnableRecoveryDto } from "@booster-vault/shared";

@Injectable()
export class RecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get recovery bundle for a user
   */
  async getRecoveryBundle(userId: string) {
    return this.prisma.recoveryBundle.findUnique({
      where: { userId },
    });
  }

  /**
   * Create recovery bundle for a user
   */
  async createRecoveryBundle(userId: string, dto: EnableRecoveryDto) {
    // Convert base64 strings to Bytes (Buffer)
    const encryptedMasterKey = Buffer.from(dto.encryptedMasterKey, "base64");
    const iv = Buffer.from(dto.iv, "base64");

    return this.prisma.recoveryBundle.create({
      data: {
        userId,
        encryptedMasterKey,
        iv,
        kdfParams: dto.kdfParams,
      },
    });
  }

  /**
   * Delete recovery bundle for a user
   */
  async deleteRecoveryBundle(userId: string) {
    return this.prisma.recoveryBundle
      .delete({
        where: { userId },
      })
      .catch((error) => {
        if (error.code === "P2025") {
          throw new NotFoundException("Recovery bundle not found");
        }
        throw error;
      });
  }
}
