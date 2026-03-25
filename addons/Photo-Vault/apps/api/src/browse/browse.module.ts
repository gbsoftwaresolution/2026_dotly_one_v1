import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "../config/config.module";
import { TimelineService } from "./timeline.service";
import { SearchService } from "./search.service";
import { BrowseController } from "./browse.controller";

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule],
  providers: [TimelineService, SearchService],
  controllers: [BrowseController],
  exports: [TimelineService, SearchService],
})
export class BrowseModule {}
