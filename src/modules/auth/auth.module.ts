import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { StringValue } from "ms";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { AnalyticsModule } from "../analytics/analytics.module";

import { AuthAbuseProtectionService } from "./auth-abuse-protection.service";
import { AuthController } from "./auth.controller";
import { AuthMetricsService } from "./auth-metrics.service";
import { AuthService } from "./auth.service";
import { DeviceSessionService } from "./device-session.service";
import { PasswordPolicyService } from "./password-policy.service";
import { PasskeysService } from "./passkeys.service";
import { SecurityArtifactLifecycleService } from "./security-artifact-lifecycle.service";
import { VerificationDiagnosticsService } from "./verification-diagnostics.service";
import { VerificationPolicyService } from "./verification-policy.service";

@Global()
@Module({
  imports: [
    AnalyticsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("jwt.secret"),
        signOptions: {
          expiresIn: configService.get<string>(
            "jwt.expiresIn",
            "7d",
          ) as StringValue,
          issuer: configService.get<string>("jwt.issuer", "dotly-backend"),
          audience: configService.get<string>("jwt.audience", "dotly-clients"),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthAbuseProtectionService,
    AuthMetricsService,
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PasswordPolicyService,
    PasskeysService,
    DeviceSessionService,
    SecurityArtifactLifecycleService,
    VerificationPolicyService,
    VerificationDiagnosticsService,
  ],
  exports: [
    AuthMetricsService,
    AuthService,
    DeviceSessionService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    JwtModule,
    PasskeysService,
    SecurityArtifactLifecycleService,
    VerificationPolicyService,
    VerificationDiagnosticsService,
  ],
})
export class AuthModule {}
