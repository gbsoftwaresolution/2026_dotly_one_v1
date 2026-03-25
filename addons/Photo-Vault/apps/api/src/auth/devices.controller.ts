import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { SessionsService } from "./sessions.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  DeviceResponse,
  DevicesListResponse,
  RenameDeviceDto,
  RevokeDeviceResponse,
} from "@booster-vault/shared";
import { Request as ExpressRequest } from "express";

@Controller("devices")
@UseInterceptors(ClassSerializerInterceptor)
export class DevicesController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get list of active devices/sessions for the current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async getDevices(
    @Request() req: ExpressRequest,
  ): Promise<DevicesListResponse> {
    const userId = (req as any).user?.sub;
    const sessionId = (req as any).user?.sessionId;

    const sessions = await this.sessionsService.getUserSessions(
      userId,
      sessionId,
    );

    const devices = sessions.map((session) =>
      this.mapSessionToDeviceResponse(session, sessionId),
    );

    return new DevicesListResponse({ devices });
  }

  /**
   * Rename a device/session
   */
  @Patch(":sessionId")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.NO_CONTENT)
  async renameDevice(
    @Request() req: ExpressRequest,
    @Param("sessionId") targetSessionId: string,
    @Body() renameDeviceDto: RenameDeviceDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;

    try {
      await this.sessionsService.renameSession(
        userId,
        targetSessionId,
        renameDeviceDto.deviceName,
      );
    } catch (error) {
      // Prisma will throw if session not found or user doesn't own it
      throw new NotFoundException("Session not found");
    }

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "DEVICE_RENAMED",
        entityType: "USER_SESSION",
        entityId: targetSessionId,
        meta: { deviceName: renameDeviceDto.deviceName },
      },
    });
  }

  /**
   * Revoke a specific device/session
   */
  @Post(":sessionId/revoke")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async revokeDevice(
    @Request() req: ExpressRequest,
    @Param("sessionId") targetSessionId: string,
  ): Promise<RevokeDeviceResponse> {
    const userId = (req as any).user?.sub;
    const currentSessionId = (req as any).user?.sessionId;

    // Cannot revoke current session via this endpoint (should logout instead)
    if (targetSessionId === currentSessionId) {
      throw new BadRequestException(
        "Cannot revoke current session. Use logout instead.",
      );
    }

    try {
      await this.sessionsService.revokeSession(userId, targetSessionId);
    } catch (error) {
      throw new NotFoundException("Session not found");
    }

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "DEVICE_REVOKED",
        entityType: "USER_SESSION",
        entityId: targetSessionId,
        meta: {},
      },
    });

    return new RevokeDeviceResponse({ success: true });
  }

  /**
   * Revoke all other devices/sessions except current
   */
  @Post("revoke-others")
  @UseGuards(JwtAuthGuard)
  @Throttle({ auth: {} })
  @HttpCode(HttpStatus.OK)
  async revokeOtherDevices(
    @Request() req: ExpressRequest,
  ): Promise<{ revokedCount: number }> {
    const userId = (req as any).user?.sub;
    const currentSessionId = (req as any).user?.sessionId;

    const revokedCount = await this.sessionsService.revokeOtherSessions(
      userId,
      currentSessionId,
    );

    // Audit event
    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: "DEVICES_REVOKE_OTHERS",
        entityType: "USER",
        entityId: userId,
        meta: { revokedCount },
      },
    });

    return { revokedCount };
  }

  /**
   * Map session object from sessions service to DeviceResponse DTO
   */
  private mapSessionToDeviceResponse(
    session: any,
    currentSessionId?: string,
  ): DeviceResponse {
    const deviceInfo = session.deviceInfo || {};

    // Mask IP address for privacy (show only first two octets for IPv4)
    let maskedIp: string | undefined = undefined;
    if (session.ipAddress) {
      maskedIp = this.maskIpAddress(session.ipAddress);
    }

    // Generate device name fallback from user agent
    let deviceName = session.deviceName;
    if (!deviceName) {
      deviceName = this.generateDeviceNameFromUserAgent(session.userAgent);
    }

    return new DeviceResponse({
      sessionId: session.id,
      deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      deviceType: deviceInfo.device,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      ipAddress: maskedIp,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    });
  }

  /**
   * Mask IP address for privacy
   * For IPv4: 192.168.1.1 → 192.168.*.*
   * For IPv6: simplify or just show empty
   */
  private maskIpAddress(ip: string): string {
    // IPv4 pattern
    const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      return `${ipv4Match[1]}.${ipv4Match[2]}.*.*`;
    }

    // IPv6 - just return empty or masked representation
    if (ip.includes(":")) {
      // For privacy, don't show IPv6 address
      return "IPv6";
    }

    // Unknown format
    return ip;
  }

  /**
   * Generate a friendly device name from user agent
   */
  private generateDeviceNameFromUserAgent(userAgent: string | null): string {
    if (!userAgent) return "Unknown Device";

    const lowerUA = userAgent.toLowerCase();

    // Must be checked before Chrome since Edge UAs include "chrome".
    if (lowerUA.includes("edg/")) {
      return "Edge";
    }

    if (lowerUA.includes("chrome")) {
      if (lowerUA.includes("mobile")) return "Chrome Mobile";
      return "Chrome";
    } else if (lowerUA.includes("firefox")) {
      return "Firefox";
    } else if (lowerUA.includes("safari") && !lowerUA.includes("chrome")) {
      if (lowerUA.includes("iphone") || lowerUA.includes("ipad"))
        return "Safari iOS";
      return "Safari";
    } else if (lowerUA.includes("edge")) {
      return "Edge";
    } else if (lowerUA.includes("opera")) {
      return "Opera";
    } else if (lowerUA.includes("android")) {
      return "Android Browser";
    } else if (lowerUA.includes("iphone") || lowerUA.includes("ipad")) {
      return "iOS Device";
    } else if (lowerUA.includes("windows")) {
      return "Windows PC";
    } else if (lowerUA.includes("mac os")) {
      return "Mac";
    } else if (lowerUA.includes("linux")) {
      return "Linux PC";
    }

    return "Web Browser";
  }
}
