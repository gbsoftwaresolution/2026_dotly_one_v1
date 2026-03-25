import { Module, Global } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import * as path from "path";
import { ConfigService } from "./config.service";

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [
        process.env.DOTENV_PATH,
        path.resolve(process.cwd(), ".env"),
        // Common monorepo layout: apps/api -> ../../.env
        path.resolve(process.cwd(), "../../.env"),
      ].filter((p): p is string => typeof p === "string" && p.length > 0),
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
