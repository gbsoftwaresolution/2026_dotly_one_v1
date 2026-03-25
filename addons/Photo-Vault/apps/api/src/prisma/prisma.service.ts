import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly loggerService: LoggerService) {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["error"],
    });
  }

  async onModuleInit() {
    const logger = this.loggerService.child({ context: PrismaService.name });
    try {
      await this.$connect();
      logger.log("Prisma connected to database");
    } catch (error) {
      logger.warn({
        msg: "Failed to connect to database",
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without database connection for development
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}
