import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertVaultKeyBundleDto } from "@booster-vault/shared";

@Injectable()
export class VaultKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get vault key bundle for a user
   */
  async getVaultKeyBundle(userId: string) {
    return this.prisma.vaultKeyBundle.findUnique({
      where: { userId },
    });
  }

  /**
   * Create or update vault key bundle for a user
   */
  async upsertVaultKeyBundle(userId: string, dto: UpsertVaultKeyBundleDto) {
    // Convert base64 strings to Bytes (Buffer)
    const encryptedMasterKey = Buffer.from(dto.encryptedMasterKey, "base64");
    const iv = Buffer.from(dto.iv, "base64");

    return this.prisma.vaultKeyBundle.upsert({
      where: { userId },
      create: {
        userId,
        encryptedMasterKey,
        iv,
        kdfParams: dto.kdfParams,
        kdfAlgo: "pbkdf2",
        bundleVersion: 1,
      },
      update: {
        encryptedMasterKey,
        iv,
        kdfParams: dto.kdfParams,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete vault key bundle for a user (e.g., when disabling recovery or account deletion)
   */
  async deleteVaultKeyBundle(userId: string) {
    return this.prisma.vaultKeyBundle
      .delete({
        where: { userId },
      })
      .catch((error) => {
        if (error.code === "P2025") {
          throw new NotFoundException("Vault key bundle not found");
        }
        throw error;
      });
  }

  /**
   * Check if vault key bundle exists for a user
   */
  async hasVaultKeyBundle(userId: string): Promise<boolean> {
    const bundle = await this.getVaultKeyBundle(userId);
    return !!bundle;
  }
}
