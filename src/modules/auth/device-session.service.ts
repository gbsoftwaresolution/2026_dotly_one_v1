import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../infrastructure/database/prisma.service";

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

type AuthSessionStore = {
  authSession: {
    create: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<{ count: number }>;
  };
};

export type SessionValidationResult =
  | { status: "active"; session: { id: string; expiresAt: Date } }
  | { status: "missing" }
  | { status: "revoked"; session: { id: string; revokedAt: Date } }
  | { status: "expired"; session: { id: string; expiresAt: Date } };

export type SessionRevokeResult =
  | { status: "revoked"; revokedAt: Date }
  | { status: "already_inactive" }
  | { status: "not_found" };

@Injectable()
export class DeviceSessionService {
  constructor(private readonly prismaService: PrismaService) {}

  private get prisma(): any {
    return this.prismaService as any;
  }

  private getStore(store?: AuthSessionStore): AuthSessionStore {
    return store ?? (this.prisma as AuthSessionStore);
  }

  async createSession(
    userId: string,
    expiresAt: Date,
    context?: SessionContext,
    store?: AuthSessionStore,
  ) {
    const metadata = this.describeUserAgent(context?.userAgent ?? null);
    const authSessionStore = this.getStore(store);

    return authSessionStore.authSession.create({
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
      return {
        status: "missing",
      } as const;
    }

    if (session.revokedAt) {
      return {
        status: "revoked",
        session: {
          id: session.id,
          revokedAt: session.revokedAt,
        },
      } as const;
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      return {
        status: "expired",
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
        },
      } as const;
    }

    const keepAlive = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        lastActiveAt: now,
      },
    });

    if (keepAlive.count === 0) {
      return {
        status: "missing",
      } as const;
    }

    return {
      status: "active",
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    } as const;
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

  async revokeSession(
    userId: string,
    sessionId: string,
    reason: string,
    store?: AuthSessionStore,
  ) {
    const now = new Date();
    const authSessionStore = this.getStore(store);
    const existingSession = await authSessionStore.authSession.findFirst({
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

    if (!existingSession) {
      return {
        status: "not_found",
      } as const;
    }

    if (
      existingSession.revokedAt ||
      existingSession.expiresAt.getTime() <= now.getTime()
    ) {
      return {
        status: "already_inactive",
      } as const;
    }

    const result = await authSessionStore.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
        revokedReason: reason,
      },
    });

    if (result.count > 0) {
      return {
        status: "revoked",
        revokedAt: now,
      } as const;
    }

    return {
      status: "already_inactive",
    } as const;
  }

  async revokeOtherSessions(
    userId: string,
    sessionId: string,
    reason: string,
    store?: AuthSessionStore,
  ) {
    const now = new Date();
    const authSessionStore = this.getStore(store);
    const result = await authSessionStore.authSession.updateMany({
      where: {
        userId,
        id: {
          not: sessionId,
        },
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
        revokedReason: reason,
      },
    });

    return result.count;
  }

  async revokeAllSessions(userId: string, reason: string, store?: AuthSessionStore) {
    const now = new Date();
    const authSessionStore = this.getStore(store);
    const result = await authSessionStore.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
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
