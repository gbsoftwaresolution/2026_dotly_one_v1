import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { ConfigService } from "../config/config.service";
import { Request } from "express";
import { UAParser } from "ua-parser-js";

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly refreshTokenExpiryDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {
    // Parse JWT_REFRESH_EXPIRES_IN (e.g., "30d", "7d", "1h")
    const refreshExpiresIn = this.configService.jwtRefreshExpiresIn;
    if (refreshExpiresIn.endsWith("d")) {
      this.refreshTokenExpiryDays = parseInt(refreshExpiresIn.slice(0, -1), 10);
    } else if (refreshExpiresIn.endsWith("h")) {
      this.refreshTokenExpiryDays =
        parseInt(refreshExpiresIn.slice(0, -1), 10) / 24;
    } else {
      this.refreshTokenExpiryDays = 30; // default 30 days
    }
  }

  /**
   * Create a new session for a user
   * @param userId User ID
   * @param request HTTP request (for userAgent and ip)
   * @returns The raw refresh token and session ID
   */
  async createSession(
    userId: string,
    request: Request,
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const refreshToken = this.passwordService.generateRandomToken(64);
    const refreshTokenHash =
      await this.passwordService.generateHashForToken(refreshToken);

    const userAgent = request.headers["user-agent"] || "unknown";
    // Get IP address with X-Forwarded-For support
    let ipAddress = "unknown";
    if (request.ip) {
      ipAddress = request.ip;
    } else if (request.socket.remoteAddress) {
      ipAddress = request.socket.remoteAddress;
    }

    // Mask IP address for storage (only store first two octets for IPv4)
    ipAddress = this.maskIpAddressForStorage(ipAddress);
    const expiresAt = new Date(
      Date.now() + this.refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
    );

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt,
        lastSeenAt: new Date(),
      },
    });

    return { sessionId: session.id, refreshToken };
  }

  /**
   * Validate a refresh token and return the session/user
   * @param refreshToken Raw refresh token
   * @returns Session and user if valid
   */
  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ session: any; user: any }> {
    const refreshTokenHash =
      await this.passwordService.generateHashForToken(refreshToken);

    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    // HARD FAIL if missing OR revoked OR expired
    if (!session || session.revokedAt) {
      throw new UnauthorizedException("Refresh token revoked or expired");
    }

    // Check if session is expired (should already be handled by expiresAt query, but double-check)
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    // Update lastSeenAt only on real refresh usage
    await this.updateSessionLastSeen(session.id);

    return { session, user: session.user };
  }

  /**
   * Update session's lastSeenAt timestamp by session ID
   * @param sessionId Session ID
   */
  async updateSessionLastSeen(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  }

  /**
   * Rename a session/device
   * @param userId User ID
   * @param sessionId Session ID
   * @param deviceName New device name
   */
  async renameSession(
    userId: string,
    sessionId: string,
    deviceName: string,
  ): Promise<void> {
    await this.prisma.userSession.update({
      where: {
        id: sessionId,
        userId, // Ensure user owns this session
      },
      data: { deviceName },
    });
  }

  /**
   * Revoke a specific session (soft delete with revokedAt)
   * @param userId User ID
   * @param sessionId Session ID
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: {
        id: sessionId,
        userId, // Ensure user owns this session
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all other sessions except the current one
   * @param userId User ID
   * @param currentSessionId Current session ID to keep
   */
  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  /**
   * Rotate refresh token (invalidate old, create new)
   * @param oldRefreshToken Old refresh token to invalidate
   * @param request HTTP request
   * @returns New session ID and refresh token
   */
  async rotateRefreshToken(
    oldRefreshToken: string,
    request: Request,
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const { session, user } = await this.validateRefreshToken(oldRefreshToken);

    // Invalidate old session (delete it)
    await this.prisma.userSession.delete({
      where: { id: session.id },
    });

    // Create new session
    return this.createSession(user.id, request);
  }

  /**
   * Revoke a refresh token (logout)
   * @param refreshToken Refresh token to revoke
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const refreshTokenHash =
      await this.passwordService.generateHashForToken(refreshToken);

    await this.prisma.userSession.deleteMany({
      where: { refreshTokenHash },
    });
  }

  /**
   * Revoke all sessions for a user (force logout everywhere)
   * @param userId User ID
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  /**
   * Get user's active sessions (not revoked, not expired)
   * @param userId User ID
   * @param currentSessionId Optional current session ID to mark as current
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<any[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
        revokedAt: null,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      deviceInfo: this.parseUserAgent(session.userAgent),
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  }

  /**
   * Parse user agent string for device info
   */
  private parseUserAgent(userAgent: string | null): any {
    if (!userAgent) return {};

    try {
      const parser = new UAParser(userAgent);
      const parsed = parser.getResult();
      return {
        browser:
          `${parsed.browser.name || "Unknown"} ${parsed.browser.version || ""}`.trim(),
        os: `${parsed.os.name || "Unknown"} ${parsed.os.version || ""}`.trim(),
        device: parsed.device.type || "Desktop",
        deviceModel: parsed.device.model || "Unknown",
      };
    } catch {
      return {};
    }
  }

  /**
   * Mask IP address for storage (only store first two octets for IPv4)
   * Similar to devices controller but always applied when storing
   */
  private maskIpAddressForStorage(ip: string): string {
    // Return null/empty for unknown
    if (!ip || ip === "unknown") {
      return "";
    }

    // IPv4 pattern
    const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      return `${ipv4Match[1]}.${ipv4Match[2]}.*.*`;
    }

    // IPv6 - store as empty string for privacy
    if (ip.includes(":")) {
      return "";
    }

    // Unknown format - return empty
    return "";
  }
}
