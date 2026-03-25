import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { AuthModule } from "../auth/auth.module";
import { QUEUE_NAMES } from "./queue.constants";
import { RedisService } from "./redis.service";
import { QueueTelemetryService } from "./queue.telemetry.service";
import { QueueHealthController } from "./queue-health.controller";
import { QueueBackoffService } from "./queue-backoff.service";

@Global()
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.redisUrl,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.exports },
      { name: QUEUE_NAMES.purge },
      { name: QUEUE_NAMES.thumbnails },
      { name: QUEUE_NAMES.lifeDocsReminders },
    ),
  ],
  controllers: [QueueHealthController],
  providers: [RedisService, QueueTelemetryService, QueueBackoffService],
  exports: [BullModule, RedisService, QueueBackoffService],
})
export class QueueModule {}
