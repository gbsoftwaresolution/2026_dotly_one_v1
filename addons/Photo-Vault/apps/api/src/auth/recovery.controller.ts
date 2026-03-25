import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RecoveryService } from "./recovery.service";
import {
  EnableRecoveryDto,
  DisableRecoveryDto,
  RecoveryStatusResponse,
} from "@booster-vault/shared";
import { Request as ExpressRequest } from "express";
import { PasswordService } from "./password.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditEventType } from "../audit/audit-event-types";

@Controller("recovery")
@UseInterceptors(ClassSerializerInterceptor)
export class RecoveryController {
  constructor(
    private readonly recoveryService: RecoveryService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
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
   * Enable recovery phrase for the current user
   */
  @Post("enable")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.CREATED)
  async enableRecovery(
    @Request() req: ExpressRequest,
    @Body() enableRecoveryDto: EnableRecoveryDto,
  ): Promise<{ success: boolean }> {
    const userId = (req as any).user?.sub;

    this.validateKdfParamsOrThrow(enableRecoveryDto.kdfParams);

    let encryptedBytes: Buffer;
    let ivBytes: Buffer;
    try {
      encryptedBytes = Buffer.from(
        enableRecoveryDto.encryptedMasterKey,
        "base64",
      );
      ivBytes = Buffer.from(enableRecoveryDto.iv, "base64");
    } catch {
      throw new BadRequestException("encryptedMasterKey/iv must be base64");
    }
    if (encryptedBytes.byteLength < 48) {
      throw new BadRequestException("encryptedMasterKey is too short");
    }
    if (ivBytes.byteLength !== 12) {
      throw new BadRequestException("iv must be 12 bytes for AES-GCM");
    }

    // Check if recovery already enabled
    const existing = await this.recoveryService.getRecoveryBundle(userId);
    if (existing) {
      throw new ConflictException("Recovery phrase already enabled");
    }

    await this.recoveryService.createRecoveryBundle(userId, enableRecoveryDto);

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "RECOVERY_ENABLED",
        entityType: "RECOVERY_BUNDLE",
        entityId: null,
        meta: {},
      },
    });

    return { success: true };
  }

  /**
   * Get recovery status for the current user
   */
  @Get("status")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async getStatus(
    @Request() req: ExpressRequest,
  ): Promise<RecoveryStatusResponse> {
    const userId = (req as any).user?.sub;
    const bundle = await this.recoveryService.getRecoveryBundle(userId);

    return new RecoveryStatusResponse({
      enabled: !!bundle,
      createdAt: bundle?.createdAt,
    });
  }

  /**
   * Explicitly accept the risk of proceeding without a recovery phrase.
   * Idempotent: subsequent calls return the original timestamp.
   */
  @Post("accept-risk")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async acceptRecoveryRisk(
    @Request() req: ExpressRequest,
  ): Promise<{ acceptedAt: string }> {
    const userId = (req as any).user?.sub;
    const requestId = (req as any).requestId;

    const now = new Date();

    // Atomic, idempotent set-if-null
    const updated = await this.prisma.user.updateMany({
      where: {
        id: userId,
        acceptedVaultRecoveryRiskAt: null,
      },
      data: {
        acceptedVaultRecoveryRiskAt: now,
      },
    });

    if (updated.count > 0) {
      await this.prisma.auditEvent.create({
        data: {
          userId,
          eventType: AuditEventType.RECOVERY_RISK_ACCEPTED,
          entityType: "USER",
          entityId: userId,
          meta: {
            requestId,
          },
        },
      });

      return { acceptedAt: now.toISOString() };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { acceptedVaultRecoveryRiskAt: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Extremely defensive: if still null, set it now.
    if (!user.acceptedVaultRecoveryRiskAt) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { acceptedVaultRecoveryRiskAt: now },
      });
      await this.prisma.auditEvent.create({
        data: {
          userId,
          eventType: AuditEventType.RECOVERY_RISK_ACCEPTED,
          entityType: "USER",
          entityId: userId,
          meta: {
            requestId,
          },
        },
      });
      return { acceptedAt: now.toISOString() };
    }

    return { acceptedAt: user.acceptedVaultRecoveryRiskAt.toISOString() };
  }

  /**
   * Disable recovery phrase for the current user
   * Requires password re-authentication
   */
  @Delete("disable")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableRecovery(
    @Request() req: ExpressRequest,
    @Body() disableRecoveryDto: DisableRecoveryDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;

    // Verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const passwordValid = await this.passwordService.verifyPassword(
      disableRecoveryDto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new ForbiddenException("Invalid password");
    }

    // Check if recovery is enabled
    const existing = await this.recoveryService.getRecoveryBundle(userId);
    if (!existing) {
      throw new NotFoundException("Recovery phrase not enabled");
    }

    await this.recoveryService.deleteRecoveryBundle(userId);

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "RECOVERY_DISABLED",
        entityType: "RECOVERY_BUNDLE",
        entityId: null,
        meta: {},
      },
    });
  }

  /**
   * Get encrypted master key for recovery (used during restore flow)
   * This endpoint is used when a user is trying to restore their vault on a new device
   * It returns the encrypted bundle without any authentication beyond the recovery phrase
   * Note: This should be rate-limited heavily to prevent brute force
   */
  @Post("bundle")
  @Throttle({ auth: { ttl: 60000, limit: 5 } }) // 5 attempts per minute
  async getRecoveryBundle(
    @Body("userId") userId: string,
  ): Promise<{ encryptedMasterKey: string; iv: string; kdfParams: any }> {
    if (!userId) {
      throw new BadRequestException("User ID required");
    }

    const bundle = await this.recoveryService.getRecoveryBundle(userId);
    if (!bundle) {
      throw new NotFoundException("Recovery bundle not found");
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
}
