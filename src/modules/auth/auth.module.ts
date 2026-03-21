import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { StringValue } from "ms";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AnalyticsModule } from "../analytics/analytics.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
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
    AuthService,
    JwtAuthGuard,
    VerificationPolicyService,
    VerificationDiagnosticsService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtModule,
    VerificationPolicyService,
    VerificationDiagnosticsService,
  ],
})
export class AuthModule {}
