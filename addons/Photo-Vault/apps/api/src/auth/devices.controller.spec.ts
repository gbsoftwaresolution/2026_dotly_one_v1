import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { DevicesController } from "./devices.controller";
import { SessionsService } from "./sessions.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { RenameDeviceDto } from "@booster-vault/shared";
import {
  DevicesListResponse,
  DeviceResponse,
  RevokeDeviceResponse,
} from "@booster-vault/shared";

describe("DevicesController", () => {
  let controller: DevicesController;
  let sessionsService: SessionsService;
  let prisma: PrismaService;

  const mockSessionsService = {
    getUserSessions: jest.fn(),
    renameSession: jest.fn(),
    revokeSession: jest.fn(),
    revokeOtherSessions: jest.fn(),
  };

  const mockPrisma = {
    auditEvent: {
      create: jest.fn(),
    },
  };

  const mockUser = {
    sub: "user-123",
    sessionId: "session-current",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DevicesController>(DevicesController);
    sessionsService = module.get<SessionsService>(SessionsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getDevices", () => {
    it("should return list of devices with current session flagged", async () => {
      const mockSessions = [
        {
          id: "session-current",
          userId: "user-123",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          ipAddress: "192.168.1.100",
          deviceName: "My Laptop",
          createdAt: new Date("2025-02-01T10:00:00Z"),
          lastSeenAt: new Date("2025-02-07T10:30:00Z"),
          expiresAt: new Date("2025-03-01T10:00:00Z"),
          revokedAt: null,
          deviceInfo: {
            browser: "Chrome",
            os: "Windows",
            device: "desktop",
          },
        },
        {
          id: "session-other",
          userId: "user-123",
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/605.1.15",
          ipAddress: "10.0.0.5",
          deviceName: null,
          createdAt: new Date("2025-02-05T15:00:00Z"),
          lastSeenAt: new Date("2025-02-06T09:15:00Z"),
          expiresAt: new Date("2025-02-19T15:00:00Z"),
          revokedAt: null,
          deviceInfo: {
            browser: "Safari",
            os: "iOS",
            device: "mobile",
          },
        },
      ];

      mockSessionsService.getUserSessions.mockResolvedValue(mockSessions);

      const mockReq = { user: mockUser } as any;
      const result = await controller.getDevices(mockReq);

      expect(sessionsService.getUserSessions).toHaveBeenCalledWith(
        "user-123",
        "session-current",
      );
      expect(result).toBeInstanceOf(DevicesListResponse);
      expect(result.devices).toHaveLength(2);

      const currentDevice = result.devices.find((d) => d.isCurrent);
      expect(currentDevice).toBeDefined();
      expect(currentDevice?.sessionId).toBe("session-current");
      expect(currentDevice?.deviceName).toBe("My Laptop");
      expect(currentDevice?.ipAddress).toBe("192.168.*.*");

      const otherDevice = result.devices.find((d) => !d.isCurrent);
      expect(otherDevice).toBeDefined();
      expect(otherDevice?.sessionId).toBe("session-other");
      expect(otherDevice?.deviceName).toBe("Safari iOS"); // Generated from user agent
      expect(otherDevice?.ipAddress).toBe("10.0.*.*");
    });

    it("should handle sessions without device info gracefully", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-123",
          userAgent: null,
          ipAddress: null,
          deviceName: null,
          createdAt: new Date(),
          lastSeenAt: new Date(),
          expiresAt: new Date(),
          revokedAt: null,
          deviceInfo: null,
        },
      ];

      mockSessionsService.getUserSessions.mockResolvedValue(mockSessions);

      const mockReq = { user: mockUser } as any;
      const result = await controller.getDevices(mockReq);

      expect(result.devices[0].deviceName).toBe("Unknown Device");
      expect(result.devices[0].ipAddress).toBeUndefined();
      expect(result.devices[0].browser).toBeUndefined();
      expect(result.devices[0].os).toBeUndefined();
    });
  });

  describe("renameDevice", () => {
    it("should rename a device successfully", async () => {
      const renameDto: RenameDeviceDto = { deviceName: "My Work Laptop" };

      mockSessionsService.renameSession.mockResolvedValue(undefined);

      const mockReq = { user: mockUser } as any;

      await controller.renameDevice(mockReq, "session-other", renameDto);

      expect(sessionsService.renameSession).toHaveBeenCalledWith(
        "user-123",
        "session-other",
        "My Work Laptop",
      );
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          eventType: "DEVICE_RENAMED",
          entityType: "USER_SESSION",
          entityId: "session-other",
          meta: { deviceName: "My Work Laptop" },
        },
      });
    });

    it("should throw NotFoundException when session not found", async () => {
      const renameDto: RenameDeviceDto = { deviceName: "New Name" };

      mockSessionsService.renameSession.mockRejectedValue(
        new Error("Session not found"),
      );

      const mockReq = { user: mockUser } as any;

      await expect(
        controller.renameDevice(mockReq, "session-notfound", renameDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("revokeDevice", () => {
    it("should revoke another device successfully", async () => {
      mockSessionsService.revokeSession.mockResolvedValue(undefined);

      const mockReq = { user: mockUser } as any;
      const result = await controller.revokeDevice(mockReq, "session-other");

      expect(sessionsService.revokeSession).toHaveBeenCalledWith(
        "user-123",
        "session-other",
      );
      expect(result).toBeInstanceOf(RevokeDeviceResponse);
      expect(result.success).toBe(true);
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          eventType: "DEVICE_REVOKED",
          entityType: "USER_SESSION",
          entityId: "session-other",
          meta: {},
        },
      });
    });

    it("should throw BadRequestException when trying to revoke current session", async () => {
      const mockReq = { user: mockUser } as any;

      await expect(
        controller.revokeDevice(mockReq, "session-current"),
      ).rejects.toThrow(BadRequestException);

      expect(sessionsService.revokeSession).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when session not found", async () => {
      mockSessionsService.revokeSession.mockRejectedValue(
        new Error("Session not found"),
      );

      const mockReq = { user: mockUser } as any;

      await expect(
        controller.revokeDevice(mockReq, "session-notfound"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("revokeOtherDevices", () => {
    it("should revoke all other devices except current", async () => {
      mockSessionsService.revokeOtherSessions.mockResolvedValue(3);

      const mockReq = { user: mockUser } as any;
      const result = await controller.revokeOtherDevices(mockReq);

      expect(sessionsService.revokeOtherSessions).toHaveBeenCalledWith(
        "user-123",
        "session-current",
      );
      expect(result.revokedCount).toBe(3);
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          eventType: "DEVICES_REVOKE_OTHERS",
          entityType: "USER",
          entityId: "user-123",
          meta: { revokedCount: 3 },
        },
      });
    });

    it("should handle zero revoked sessions", async () => {
      mockSessionsService.revokeOtherSessions.mockResolvedValue(0);

      const mockReq = { user: mockUser } as any;
      const result = await controller.revokeOtherDevices(mockReq);

      expect(result.revokedCount).toBe(0);
    });
  });

  describe("maskIpAddress", () => {
    let controllerPrivate: any;

    beforeEach(() => {
      controllerPrivate = controller as any;
    });

    it("should mask IPv4 address", () => {
      expect(controllerPrivate.maskIpAddress("192.168.1.100")).toBe(
        "192.168.*.*",
      );
      expect(controllerPrivate.maskIpAddress("10.0.0.1")).toBe("10.0.*.*");
      expect(controllerPrivate.maskIpAddress("172.16.254.1")).toBe(
        "172.16.*.*",
      );
    });

    it("should handle IPv6 address", () => {
      expect(
        controllerPrivate.maskIpAddress(
          "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        ),
      ).toBe("IPv6");
      expect(controllerPrivate.maskIpAddress("::1")).toBe("IPv6");
    });

    it("should return original string for unknown format", () => {
      expect(controllerPrivate.maskIpAddress("invalid")).toBe("invalid");
    });
  });

  describe("generateDeviceNameFromUserAgent", () => {
    let controllerPrivate: any;

    beforeEach(() => {
      controllerPrivate = controller as any;
    });

    it("should detect Chrome on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe(
        "Chrome",
      );
    });

    it("should detect Chrome Mobile", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 13; SM-S901U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe(
        "Chrome Mobile",
      );
    });

    it("should detect Safari iOS", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe(
        "Safari iOS",
      );
    });

    it("should detect Firefox", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe(
        "Firefox",
      );
    });

    it("should detect Edge", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe(
        "Edge",
      );
    });

    it("should detect Android Browser", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe(
        "Chrome Mobile",
      );
    });

    it("should detect Mac", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
      expect(controllerPrivate.generateDeviceNameFromUserAgent(ua)).toBe("Mac");
    });

    it("should return Unknown Device for null user agent", () => {
      expect(controllerPrivate.generateDeviceNameFromUserAgent(null)).toBe(
        "Unknown Device",
      );
    });

    it("should return Web Browser for unknown user agent", () => {
      expect(
        controllerPrivate.generateDeviceNameFromUserAgent("Custom Agent/1.0"),
      ).toBe("Web Browser");
    });
  });
});
