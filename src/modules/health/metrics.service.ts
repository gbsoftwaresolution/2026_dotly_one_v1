import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CacheService } from "../../infrastructure/cache/cache.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  AuthMetricsService,
  noopAuthMetricsService,
} from "../auth/auth-metrics.service";

@Injectable()
export class MetricsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly authMetricsService: AuthMetricsService = noopAuthMetricsService,
  ) {}

  async getPrometheusSnapshot(): Promise<string> {
    const [database, cache, authSecurity] = await Promise.all([
      this.getDatabaseMetricValue(),
      this.getCacheMetricValue(),
      this.getAuthSecurityMetricValues(),
    ]);

    const lines = [
      "# HELP dotly_service_info Static metadata for the running Dotly backend instance",
      "# TYPE dotly_service_info gauge",
      `dotly_service_info{service="dotly-backend",environment="${this.configService.get<string>("app.nodeEnv", "development")}"} 1`,
      "# HELP dotly_database_up Database readiness indicator",
      "# TYPE dotly_database_up gauge",
      `dotly_database_up ${database}`,
      "# HELP dotly_cache_up Redis cache readiness indicator",
      "# TYPE dotly_cache_up gauge",
      `dotly_cache_up ${cache}`,
      "# HELP dotly_auth_password_reset_active_tokens Active, unconsumed password reset tokens",
      "# TYPE dotly_auth_password_reset_active_tokens gauge",
      `dotly_auth_password_reset_active_tokens ${authSecurity.activePasswordResetTokens}`,
      "# HELP dotly_auth_password_reset_issued_last_24h Password reset tokens issued in the last 24 hours",
      "# TYPE dotly_auth_password_reset_issued_last_24h gauge",
      `dotly_auth_password_reset_issued_last_24h ${authSecurity.passwordResetIssuedLast24Hours}`,
      "# HELP dotly_auth_mobile_otp_active_challenges Active mobile OTP challenges",
      "# TYPE dotly_auth_mobile_otp_active_challenges gauge",
      `dotly_auth_mobile_otp_active_challenges ${authSecurity.activeMobileOtpChallenges}`,
      "# HELP dotly_auth_mobile_otp_issued_last_24h Mobile OTP challenges issued in the last 24 hours",
      "# TYPE dotly_auth_mobile_otp_issued_last_24h gauge",
      `dotly_auth_mobile_otp_issued_last_24h ${authSecurity.mobileOtpIssuedLast24Hours}`,
      "# HELP dotly_auth_sessions_active Active unrevoked sessions",
      "# TYPE dotly_auth_sessions_active gauge",
      `dotly_auth_sessions_active ${authSecurity.activeSessions}`,
      "# HELP dotly_auth_sessions_revoked_last_24h Sessions revoked in the last 24 hours",
      "# TYPE dotly_auth_sessions_revoked_last_24h gauge",
      `dotly_auth_sessions_revoked_last_24h ${authSecurity.revokedSessionsLast24Hours}`,
    ];

    return `${lines.join("\n")}\n${this.authMetricsService.renderPrometheusMetrics()}`;
  }

  private async getDatabaseMetricValue(): Promise<0 | 1> {
    try {
      await this.prismaService.$queryRawUnsafe("SELECT 1");
      return 1;
    } catch {
      return 0;
    }
  }

  private async getCacheMetricValue(): Promise<0 | 1> {
    const health = await this.cacheService.getHealthStatus({
      attemptConnection: false,
    });

    return health.status === "up" ? 1 : 0;
  }

  private async getAuthSecurityMetricValues(): Promise<{
    activePasswordResetTokens: number;
    passwordResetIssuedLast24Hours: number;
    activeMobileOtpChallenges: number;
    mobileOtpIssuedLast24Hours: number;
    activeSessions: number;
    revokedSessionsLast24Hours: number;
  }> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activePasswordResetTokens,
      passwordResetIssuedLast24Hours,
      activeMobileOtpChallenges,
      mobileOtpIssuedLast24Hours,
      activeSessions,
      revokedSessionsLast24Hours,
    ] = await Promise.all([
      this.prismaService.passwordResetToken.count({
        where: {
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
      }),
      this.prismaService.passwordResetToken.count({
        where: {
          createdAt: {
            gte: last24Hours,
          },
        },
      }),
      this.prismaService.mobileOtpChallenge.count({
        where: {
          consumedAt: null,
          supersededAt: null,
          expiresAt: {
            gt: now,
          },
        },
      }),
      this.prismaService.mobileOtpChallenge.count({
        where: {
          createdAt: {
            gte: last24Hours,
          },
        },
      }),
      this.prismaService.authSession.count({
        where: {
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
      }),
      this.prismaService.authSession.count({
        where: {
          revokedAt: {
            gte: last24Hours,
          },
        },
      }),
    ]);

    return {
      activePasswordResetTokens,
      passwordResetIssuedLast24Hours,
      activeMobileOtpChallenges,
      mobileOtpIssuedLast24Hours,
      activeSessions,
      revokedSessionsLast24Hours,
    };
  }
}
