import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { PasswordService } from "./password.service";
import { SessionsService } from "./sessions.service";
import { TokensService } from "./tokens.service";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "../config/config.service";
import { AuditEventType } from "../audit/audit-event-types";

describe("AuthService (password reset audit)", () => {
  let service: AuthService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    recoveryBundle: {
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  };

  const mockTokens: any = {
    validateAndConsumeToken: jest.fn(),
  };

  const mockPassword: any = {
    hashPassword: jest.fn(),
  };

  const mockSessions: any = {
    revokeAllUserSessions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: {} },
        { provide: PasswordService, useValue: mockPassword },
        { provide: SessionsService, useValue: mockSessions },
        { provide: TokensService, useValue: mockTokens },
        { provide: MailService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get(AuthService);

    mockTokens.validateAndConsumeToken.mockResolvedValue("user-1");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "a@b.com",
      passwordHash: "old",
      acceptedVaultRecoveryRiskAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    mockPassword.hashPassword.mockResolvedValue("new-hash");
    mockPrisma.user.update.mockResolvedValue({});
    mockSessions.revokeAllUserSessions.mockResolvedValue(undefined);
    mockPrisma.recoveryBundle.findUnique.mockResolvedValue(null);
    mockPrisma.auditEvent.create.mockResolvedValue({});
  });

  it("emits PASSWORD_RESET_WITHOUT_RECOVERY when recovery disabled but risk accepted", async () => {
    await service.resetPassword("token", "newPassword", "req-99");

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: AuditEventType.PASSWORD_RESET_WITHOUT_RECOVERY,
        entityType: "USER",
        entityId: "user-1",
        meta: { requestId: "req-99" },
      },
    });

    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        eventType: "PASSWORD_RESET",
        entityType: "USER",
        entityId: "user-1",
        meta: { requestId: "req-99" },
      },
    });
  });
});
