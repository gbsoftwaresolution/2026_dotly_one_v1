import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { RecoveryController } from "./recovery.controller";
import { RecoveryService } from "./recovery.service";
import { PasswordService } from "./password.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditEventType } from "../audit/audit-event-types";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

describe("RecoveryController (accept-risk)", () => {
  let controller: RecoveryController;

  const mockPrisma: any = {
    user: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecoveryController],
      providers: [
        { provide: RecoveryService, useValue: {} },
        { provide: PasswordService, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(RecoveryController);
  });

  it("sets acceptedAt and emits audit event once (idempotent)", async () => {
    const req: any = {
      user: { sub: "user-1" },
      requestId: "req-1",
    };

    const now = new Date("2026-02-09T00:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);

    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const first = await controller.acceptRecoveryRisk(req);
    expect(first.acceptedAt).toBe(now.toISOString());

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: AuditEventType.RECOVERY_RISK_ACCEPTED,
        entityType: "USER",
        entityId: "user-1",
        meta: { requestId: "req-1" },
      },
    });

    // Second call: no update, returns stored timestamp, no new audit.
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      acceptedVaultRecoveryRiskAt: now,
    });

    const second = await controller.acceptRecoveryRisk(req);
    expect(second.acceptedAt).toBe(now.toISOString());

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
