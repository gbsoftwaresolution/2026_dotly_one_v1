import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { ConfigModule } from "../config/config.module";
import { MediaService } from "./media.service";
import { MediaController } from "./media.controller";
import { PurgeQueue } from "./purge.queue";
import { ThumbnailsQueue } from "./thumbnails.queue";

@Module({
  imports: [AuthModule, PrismaModule, StorageModule, ConfigModule],
  providers: [MediaService, PurgeQueue, ThumbnailsQueue],
  controllers: [MediaController],
  exports: [MediaService, PurgeQueue, ThumbnailsQueue],
})
export class MediaModule {}
