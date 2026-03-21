import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../infrastructure/database/prisma.service";

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class DeviceSessionService {
  constructor(private readonly prismaService: PrismaService) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  async createSession(
    userId: string,
    expiresAt: Date,
    context?: SessionContext,
  ) {
    const metadata = this.describeUserAgent(context?.userAgent ?? null);

    return this.prisma.authSession.create({
      data: {
        userId,
        userAgent: context?.userAgent ?? null,
        deviceLabel: metadata.deviceLabel,
        platformLabel: metadata.platformLabel,
        ipAddressHash: context?.ipAddress
          ? createHash("sha256").update(context.ipAddress).digest("hex")
          : null,
        expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });
  }

  async validateSession(userId: string, sessionId: string) {
    const now = new Date();
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!session) {
      return null;
    }

    if (session.revokedAt || session.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    await this.prisma.authSession.update({
      where: {
        id: session.id,
      },
      data: {
        lastActiveAt: now,
      },
      select: {
        id: true,
      },
    });

    return session;
  }

  async listSessions(userId: string) {
    return this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        deviceLabel: true,
        platformLabel: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSession(userId: string, sessionId: string, reason: string) {
    const now = new Date();
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedReason: reason,
      },
    });

    return result.count > 0;
  }

  async revokeOtherSessions(userId: string, sessionId: string, reason: string) {
    const now = new Date();
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        id: {
          not: sessionId,
        },
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedReason: reason,
      },
    });

    return result.count;
  }

  async revokeAllSessions(userId: string, reason: string) {
    const now = new Date();
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedReason: reason,
      },
    });

    return result.count;
  }

  private describeUserAgent(userAgent: string | null) {
    const source = userAgent ?? "";
    const lower = source.toLowerCase();

    let platformLabel = "Unknown platform";
    if (lower.includes("iphone") || lower.includes("ios")) {
      platformLabel = "iPhone";
    } else if (lower.includes("ipad")) {
      platformLabel = "iPad";
    } else if (lower.includes("android")) {
      platformLabel = "Android";
    } else if (lower.includes("mac os") || lower.includes("macintosh")) {
      platformLabel = "macOS";
    } else if (lower.includes("windows")) {
      platformLabel = "Windows";
    } else if (lower.includes("linux")) {
      platformLabel = "Linux";
    }

    let browserLabel = "Browser";
    if (lower.includes("edg/")) {
      browserLabel = "Edge";
    } else if (lower.includes("chrome/")) {
      browserLabel = "Chrome";
    } else if (lower.includes("safari/") && !lower.includes("chrome/")) {
      browserLabel = "Safari";
    } else if (lower.includes("firefox/")) {
      browserLabel = "Firefox";
    }

    return {
      platformLabel,
      deviceLabel: `${platformLabel} · ${browserLabel}`,
    };
  }
}
