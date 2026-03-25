import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AlbumsService } from "./albums.service";
import { AlbumsController } from "./albums.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [AlbumsService],
  controllers: [AlbumsController],
  exports: [AlbumsService],
})
export class AlbumsModule {}
