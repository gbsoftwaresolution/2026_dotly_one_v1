import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { StorageService } from "./storage.service";
import { StorageController } from "./storage.controller";

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
