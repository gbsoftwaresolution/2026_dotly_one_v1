import { Module, Global, MiddlewareConsumer } from "@nestjs/common";
import { LoggerService } from "./logger.service";
import { RequestIdMiddleware } from "./request-id.middleware";
import { ConfigModule } from "../config/config.module";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [LoggerService, RequestIdMiddleware],
  exports: [LoggerService, RequestIdMiddleware],
})
export class LoggerModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*"); // Apply to all routes
  }
}
