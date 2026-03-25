import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { VaultKeyService } from "./vault-key.service";
import {
  ResetVaultKeyBundleDto,
  UpsertVaultKeyBundleDto,
  VaultKeyBundleStatusResponse,
} from "@booster-vault/shared";
import { Request as ExpressRequest } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";

@Controller("vault-key")
@UseInterceptors(ClassSerializerInterceptor)
export class VaultKeyController {
  constructor(
    private readonly vaultKeyService: VaultKeyService,
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  private validateKdfParamsOrThrow(kdfParams: any) {
    if (!kdfParams || typeof kdfParams !== "object") {
      throw new BadRequestException("kdfParams is required");
    }

    const { iterations, hash, salt } = kdfParams as {
      iterations?: unknown;
      hash?: unknown;
      salt?: unknown;
    };

    if (typeof iterations !== "number" || !Number.isFinite(iterations)) {
      throw new BadRequestException("kdfParams.iterations must be a number");
    }
    if (iterations < 10000 || iterations > 2000000) {
      throw new BadRequestException(
        "kdfParams.iterations out of allowed range",
      );
    }

    if (typeof hash !== "string" || hash.length < 3) {
      throw new BadRequestException("kdfParams.hash must be a string");
    }
    if (hash.toUpperCase() !== "SHA-256") {
      throw new BadRequestException("kdfParams.hash must be SHA-256");
    }

    if (typeof salt !== "string" || salt.length < 8) {
      throw new BadRequestException("kdfParams.salt must be a base64 string");
    }

    let saltBytes: Buffer;
    try {
      saltBytes = Buffer.from(salt, "base64");
    } catch {
      throw new BadRequestException("kdfParams.salt must be valid base64");
    }
    if (saltBytes.byteLength < 8 || saltBytes.byteLength > 128) {
      throw new BadRequestException("kdfParams.salt has invalid length");
    }
  }

  /**
   * Get vault key bundle status for the current user
   */
  @Get("status")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async getStatus(
    @Request() req: ExpressRequest,
  ): Promise<VaultKeyBundleStatusResponse> {
    const userId = (req as any).user?.sub;
    const bundle = await this.vaultKeyService.getVaultKeyBundle(userId);

    return new VaultKeyBundleStatusResponse({
      enabled: !!bundle,
      createdAt: bundle?.createdAt,
      updatedAt: bundle?.updatedAt,
    });
  }

  /**
   * Create or update vault key bundle for the current user
   */
  @Post("upsert")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.CREATED)
  async upsertVaultKeyBundle(
    @Request() req: ExpressRequest,
    @Body() upsertVaultKeyBundleDto: UpsertVaultKeyBundleDto,
  ): Promise<{ success: boolean }> {
    const userId = (req as any).user?.sub;

    this.validateKdfParamsOrThrow(upsertVaultKeyBundleDto.kdfParams);

    let encryptedBytes: Buffer;
    let ivBytes: Buffer;
    try {
      encryptedBytes = Buffer.from(
        upsertVaultKeyBundleDto.encryptedMasterKey,
        "base64",
      );
      ivBytes = Buffer.from(upsertVaultKeyBundleDto.iv, "base64");
    } catch {
      throw new BadRequestException("encryptedMasterKey/iv must be base64");
    }
    if (encryptedBytes.byteLength < 48) {
      throw new BadRequestException("encryptedMasterKey is too short");
    }
    if (ivBytes.byteLength !== 12) {
      throw new BadRequestException("iv must be 12 bytes for AES-GCM");
    }

    const existed = await this.vaultKeyService.hasVaultKeyBundle(userId);

    await this.vaultKeyService.upsertVaultKeyBundle(
      userId,
      upsertVaultKeyBundleDto,
    );

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: existed
          ? "VAULT_KEY_BUNDLE_UPDATED"
          : "VAULT_KEY_BUNDLE_CREATED",
        entityType: "VAULT_KEY_BUNDLE",
        entityId: userId,
        meta: {},
      },
    });

    return { success: true };
  }

  /**
   * Get encrypted master key for the current user
   * Used during unlock flow
   */
  @Get("bundle")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async getBundle(
    @Request() req: ExpressRequest,
  ): Promise<{ encryptedMasterKey: string; iv: string; kdfParams: any }> {
    const userId = (req as any).user?.sub;
    const bundle = await this.vaultKeyService.getVaultKeyBundle(userId);

    if (!bundle) {
      throw new NotFoundException("Vault key bundle not found");
    }

    // Convert Bytes to base64 strings
    const encryptedMasterKey = Buffer.from(bundle.encryptedMasterKey).toString(
      "base64",
    );
    const iv = Buffer.from(bundle.iv).toString("base64");

    return {
      encryptedMasterKey,
      iv,
      kdfParams: bundle.kdfParams,
    };
  }

  /**
   * Reset (delete) the vault key bundle for the current user.
   * This is a destructive operation and requires the current account password.
   */
  @Post("reset")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async resetVaultKeyBundle(
    @Request() req: ExpressRequest,
    @Body() dto: ResetVaultKeyBundleDto,
  ): Promise<{ success: boolean }> {
    const userId = (req as any).user?.sub;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const passwordValid = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid password");
    }

    // Delete bundle if present; if missing, treat as success.
    await this.vaultKeyService.deleteVaultKeyBundle(userId).catch((error) => {
      if (error?.code !== "P2025") throw error;
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "VAULT_KEY_BUNDLE_RESET",
        entityType: "VAULT_KEY_BUNDLE",
        entityId: userId,
        meta: {},
      },
    });

    return { success: true };
  }
}
