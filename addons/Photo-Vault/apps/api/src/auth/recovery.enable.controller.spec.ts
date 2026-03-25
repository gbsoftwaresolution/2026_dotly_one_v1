import { BadRequestException, ConflictException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { RecoveryController } from "./recovery.controller";
import { RecoveryService } from "./recovery.service";
import { PasswordService } from "./password.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

function b64(bytes: number): string {
  return Buffer.alloc(bytes, 9).toString("base64");
}

describe("RecoveryController (enable validation)", () => {
  let controller: RecoveryController;

  const mockRecoveryService: any = {
    getRecoveryBundle: jest.fn(),
    createRecoveryBundle: jest.fn(),
    deleteRecoveryBundle: jest.fn(),
  };

  const mockPrisma: any = {
    auditEvent: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecoveryController],
      providers: [
        { provide: RecoveryService, useValue: mockRecoveryService },
        { provide: PasswordService, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(RecoveryController);
  });

  it("rejects invalid iv length (must be 12 bytes)", async () => {
    const req: any = { user: { sub: "user-1" } };

    try {
      await controller.enableRecovery(req, {
        encryptedMasterKey: b64(48),
        iv: b64(8),
        kdfParams: { iterations: 300000, hash: "SHA-256", salt: b64(16) },
      } as any);
      throw new Error("Expected BadRequestException");
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.getResponse()).toMatchObject({
        message: "iv must be 12 bytes for AES-GCM",
      });
    }
  });

  it("rejects when recovery already enabled", async () => {
    const req: any = { user: { sub: "user-1" } };

    mockRecoveryService.getRecoveryBundle.mockResolvedValueOnce({
      id: "bundle-1",
    });

    await expect(
      controller.enableRecovery(req, {
        encryptedMasterKey: b64(48),
        iv: b64(12),
        kdfParams: { iterations: 300000, hash: "SHA-256", salt: b64(16) },
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates recovery bundle and emits audit event on success", async () => {
    const req: any = { user: { sub: "user-1" } };

    mockRecoveryService.getRecoveryBundle.mockResolvedValueOnce(null);
    mockRecoveryService.createRecoveryBundle.mockResolvedValueOnce({
      id: "bundle-1",
    });

    const dto: any = {
      encryptedMasterKey: b64(48),
      iv: b64(12),
      kdfParams: { iterations: 300000, hash: "SHA-256", salt: b64(16) },
    };

    const result = await controller.enableRecovery(req, dto);
    expect(result).toEqual({ success: true });

    expect(mockRecoveryService.createRecoveryBundle).toHaveBeenCalledWith(
      "user-1",
      dto,
    );
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: "RECOVERY_ENABLED",
        entityType: "RECOVERY_BUNDLE",
        entityId: null,
        meta: {},
      },
    });
  });
});
