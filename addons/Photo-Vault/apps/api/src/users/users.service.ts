import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService, AuthUser } from "../auth/auth.service";

export interface UserSubscription {
  id: string;
  status: string;
  plan: string;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialMediaLimit: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserUsage {
  totalMediaCount: number;
  totalPhotoCount: number;
  totalVideoCount: number;
  trashedMediaCount: number;
  updatedAt: Date;
}

const bigintToNumber = (value: unknown): number => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string): Promise<AuthUser> {
    return this.authService.getCurrentUser(userId);
  }

  /**
   * Update user profile (non-sensitive fields)
   */
  async updateProfile(
    userId: string,
    updates: { displayName?: string; locale?: string; timezone?: string },
  ): Promise<AuthUser> {
    return this.authService.updateProfile(userId, updates);
  }

  /**
   * Get user's subscription
   */
  async getSubscription(userId: string): Promise<UserSubscription> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      // Create default subscription if not exists (should have been created on registration)
      return this.createDefaultSubscription(userId);
    }

    return {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.plan,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
      trialMediaLimit: subscription.trialMediaLimit,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  /**
   * Get user's usage statistics
   */
  async getUsage(userId: string): Promise<UserUsage> {
    let usage = await this.prisma.userUsage.findUnique({
      where: { userId },
    });

    if (!usage) {
      // Create default usage record if not exists (should have been created on registration)
      usage = await this.prisma.userUsage.create({
        data: {
          userId,
          totalMediaCount: 0,
          totalPhotoCount: 0,
          totalVideoCount: 0,
          trashedMediaCount: 0,
        },
      });
    }

    return {
      totalMediaCount: bigintToNumber(usage.totalMediaCount),
      totalPhotoCount: bigintToNumber(usage.totalPhotoCount),
      totalVideoCount: bigintToNumber(usage.totalVideoCount),
      trashedMediaCount: bigintToNumber(usage.trashedMediaCount),
      updatedAt: usage.updatedAt,
    };
  }

  /**
   * Get user's active sessions
   */
  async getSessions(userId: string): Promise<any[]> {
    // This method delegates to SessionsService, but we need to import it
    // For now, we'll query directly
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));
  }

  /**
   * Create default subscription for a user (fallback)
   */
  private async createDefaultSubscription(
    userId: string,
  ): Promise<UserSubscription> {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        status: "TRIAL",
        plan: "P6M_25",
        trialStartedAt: new Date(),
        trialEndsAt,
        trialMediaLimit: 50,
      },
    });

    return {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.plan,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
      trialMediaLimit: subscription.trialMediaLimit,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
