import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { PrismaModule } from "../prisma/prisma.module";
import { LoggerModule } from "../logger/logger.module";
import { MailModule } from "../mail/mail.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { PasswordService } from "./password.service";
import { SessionsService } from "./sessions.service";
import { TokensService } from "./tokens.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RecoveryService } from "./recovery.service";
import { RecoveryController } from "./recovery.controller";
import { DevicesController } from "./devices.controller";
import { VaultKeyService } from "./vault-key.service";
import { VaultKeyController } from "./vault-key.controller";

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: {
          expiresIn: configService.jwtAccessExpiresIn as any,
        },
      }),
      inject: [ConfigService],
    }),
    MailModule,
  ],
  controllers: [
    AuthController,
    RecoveryController,
    DevicesController,
    VaultKeyController,
  ],
  providers: [
    AuthService,
    PasswordService,
    SessionsService,
    TokensService,
    JwtAuthGuard,
    RecoveryService,
    VaultKeyService,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionsService,
    TokensService,
    JwtModule,
    JwtAuthGuard,
    RecoveryService,
    VaultKeyService,
  ],
})
export class AuthModule {}
