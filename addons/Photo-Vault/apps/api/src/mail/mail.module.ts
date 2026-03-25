import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MailService } from "./mail.service";

@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
