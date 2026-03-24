import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { configuration } from "./infrastructure/config/configuration";
import { validateEnvironment } from "./infrastructure/config/env.validation";
import { CacheInfrastructureModule } from "./infrastructure/cache/cache.module";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { LoggingModule } from "./infrastructure/logging/logging.module";
import { MailModule } from "./infrastructure/mail/mail.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { SmsModule } from "./infrastructure/sms/sms.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AgenciesModule } from "./modules/agencies/agencies.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BlocksModule } from "./modules/blocks/blocks.module";
import { ContactMemoryModule } from "./modules/contact-memory/contact-memory.module";
import { ContactRequestsModule } from "./modules/contact-requests/contact-requests.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { EventsModule } from "./modules/events/events.module";
import { FollowUpsModule } from "./modules/follow-ups/follow-ups.module";
import { HealthModule } from "./modules/health/health.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PersonasModule } from "./modules/personas/personas.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { QrModule } from "./modules/qr/qr.module";
import { RelationshipsModule } from "./modules/relationships/relationships.module";
import { SupportModule } from "./modules/support/support.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    LoggingModule,
    DatabaseModule,
    CacheInfrastructureModule,
    StorageModule,
    MailModule,
    SmsModule,
    AgenciesModule,
    AuthModule,
    UsersModule,
    PersonasModule,
    ProfilesModule,
    QrModule,
    ContactRequestsModule,
    ContactsModule,
    RelationshipsModule,
    SupportModule,
    FollowUpsModule,
    ContactMemoryModule,
    EventsModule,
    NotificationsModule,
    BlocksModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
