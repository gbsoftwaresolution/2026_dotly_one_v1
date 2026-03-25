import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { HealthModule } from "./health/health.module";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { LoggerModule } from "./logger/logger.module";
import { AuthModule } from "./auth/auth.module";
import { MailModule } from "./mail/mail.module";
import { UsersModule } from "./users/users.module";
import { StorageModule } from "./storage/storage.module";
import { MediaModule } from "./media/media.module";
import { AlbumsModule } from "./albums/albums.module";
import { BrowseModule } from "./browse/browse.module";
import { ExportsModule } from "./exports/exports.module";
import { BillingModule } from "./billing/billing.module";
import { SharingModule } from "./sharing/sharing.module";
import { ConfigService } from "./config/config.service";
import { QueueModule } from "./queue/queue.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { LifeDocsModule } from "./life-docs/life-docs.module";
import { ContinuityModule } from "./continuity/continuity.module";
import { CardModule } from "./card/card.module";

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: config.rateLimitTtl,
            limit: config.rateLimitMax,
          },
          {
            name: "auth",
            ttl: config.rateLimitAuthTtl,
            limit: config.rateLimitAuthMax,
          },
          {
            name: "upload",
            ttl: config.rateLimitUploadTtl,
            limit: config.rateLimitUploadMax,
          },
          {
            name: "share-public",
            ttl: config.rateLimitSharePublicTtl,
            limit: config.rateLimitSharePublicMax,
          },
          {
            name: "card-public",
            ttl: config.rateLimitCardPublicTtl,
            limit: config.rateLimitCardPublicMax,
          },
          {
            name: "card-contact-public",
            ttl: config.rateLimitCardContactPublicTtl,
            limit: config.rateLimitCardContactPublicMax,
          },
          {
            name: "card-token-public",
            ttl: config.rateLimitCardTokenPublicTtl,
            limit: config.rateLimitCardTokenPublicMax,
          },
          {
            name: "billing-webhook",
            ttl: config.rateLimitBillingWebhookTtl,
            limit: config.rateLimitBillingWebhookMax,
          },
        ],
      }),
    }),
    ConfigModule,
    HealthModule,
    PrismaModule,
    LoggerModule,
    QueueModule,
    AuthModule,
    MailModule,
    UsersModule,
    StorageModule,
    MediaModule,
    AlbumsModule,
    BrowseModule,
    ExportsModule,
    BillingModule,
    SharingModule,
    CardModule,
    IdempotencyModule,
    LifeDocsModule,
    ContinuityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
