import { BadRequestException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { VaultKeyController } from "./vault-key.controller";
import { VaultKeyService } from "./vault-key.service";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

function b64(bytes: number): string {
  return Buffer.alloc(bytes, 7).toString("base64");
}

describe("VaultKeyController (upsert validation + audit)", () => {
  let controller: VaultKeyController;

  const mockVaultKeyService: any = {
    hasVaultKeyBundle: jest.fn(),
    upsertVaultKeyBundle: jest.fn(),
    getVaultKeyBundle: jest.fn(),
    deleteVaultKeyBundle: jest.fn(),
  };

  const mockPrisma: any = {
    auditEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaultKeyController],
      providers: [
        { provide: VaultKeyService, useValue: mockVaultKeyService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PasswordService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(VaultKeyController);
  });

  it("rejects invalid iv length (must be 12 bytes)", async () => {
    const req: any = { user: { sub: "user-1" } };

    await expect(
      controller.upsertVaultKeyBundle(req, {
        encryptedMasterKey: b64(48),
        iv: b64(8),
        kdfParams: { iterations: 300000, hash: "SHA-256", salt: b64(16) },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await controller.upsertVaultKeyBundle(req, {
        encryptedMasterKey: b64(48),
        iv: b64(8),
        kdfParams: { iterations: 300000, hash: "SHA-256", salt: b64(16) },
      } as any);
    } catch (e: any) {
      expect(e.getResponse()).toMatchObject({
        message: "iv must be 12 bytes for AES-GCM",
      });
    }
  });

  it("rejects kdfParams.iterations outside allowed range", async () => {
    const req: any = { user: { sub: "user-1" } };

    try {
      await controller.upsertVaultKeyBundle(req, {
        encryptedMasterKey: b64(48),
        iv: b64(12),
        kdfParams: { iterations: 9999, hash: "SHA-256", salt: b64(16) },
      } as any);
      throw new Error("Expected BadRequestException");
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.getResponse()).toMatchObject({
        message: "kdfParams.iterations out of allowed range",
      });
    }
  });

  it("emits CREATED when bundle did not exist, UPDATED otherwise", async () => {
    const req: any = { user: { sub: "user-1" } };
    const dto: any = {
      encryptedMasterKey: b64(48),
      iv: b64(12),
      kdfParams: { iterations: 300000, hash: "SHA-256", salt: b64(16) },
    };

    mockVaultKeyService.hasVaultKeyBundle.mockResolvedValueOnce(false);
    mockVaultKeyService.upsertVaultKeyBundle.mockResolvedValueOnce({});

    await controller.upsertVaultKeyBundle(req, dto);

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: "VAULT_KEY_BUNDLE_CREATED",
        entityType: "VAULT_KEY_BUNDLE",
        entityId: "user-1",
        meta: {},
      },
    });

    mockPrisma.auditEvent.create.mockClear();
    mockVaultKeyService.hasVaultKeyBundle.mockResolvedValueOnce(true);
    mockVaultKeyService.upsertVaultKeyBundle.mockResolvedValueOnce({});

    await controller.upsertVaultKeyBundle(req, dto);

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: "VAULT_KEY_BUNDLE_UPDATED",
        entityType: "VAULT_KEY_BUNDLE",
        entityId: "user-1",
        meta: {},
      },
    });
  });
});
