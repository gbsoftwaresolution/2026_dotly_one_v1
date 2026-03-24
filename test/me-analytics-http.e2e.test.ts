import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";

import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { DeviceSessionService } from "../src/modules/auth/device-session.service";
import { MeAnalyticsController } from "../src/modules/analytics/me-analytics.controller";
import { AnalyticsService } from "../src/modules/analytics/analytics.service";

const JWT_ISSUER = "dotly-backend";
const JWT_AUDIENCE = "dotly-clients";
const JWT_SECRET = "me-analytics-test-secret";
const TEST_SESSION_ID = "11111111-1111-4111-8111-111111111111";

const analyticsCalls: Array<{ userId: string }> = [];

const analyticsServiceMock = {
  getMyAnalytics: async (userId: string) => {
    analyticsCalls.push({ userId });

    return {
      totalConnections: 12,
      connectionsThisMonth: 4,
    };
  },
};

const deviceSessionServiceMock = {
  validateSession: async () => ({
    status: "active" as const,
    session: {
      id: TEST_SESSION_ID,
      expiresAt: new Date("2026-03-28T09:00:00.000Z"),
    },
  }),
};

const prismaServiceMock = {
  user: {
    findUnique: async () => ({
      id: "user-1",
      email: "user@example.com",
      isVerified: true,
    }),
  },
};

const configServiceMock = {
  get: (key: string, fallback?: string) => {
    switch (key) {
      case "jwt.issuer":
        return JWT_ISSUER;
      case "jwt.audience":
        return JWT_AUDIENCE;
      default:
        return fallback;
    }
  },
};

const jwtService = new JwtService({
  secret: JWT_SECRET,
  signOptions: {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: "1h",
  },
});

@Module({
  controllers: [MeAnalyticsController],
  providers: [
    JwtAuthGuard,
    {
      provide: JwtService,
      useValue: jwtService,
    },
    {
      provide: ConfigService,
      useValue: configServiceMock,
    },
    {
      provide: AnalyticsService,
      useValue: analyticsServiceMock,
    },
    {
      provide: DeviceSessionService,
      useValue: deviceSessionServiceMock,
    },
    {
      provide: PrismaService,
      useValue: prismaServiceMock,
    },
  ],
})
class MeAnalyticsHttpTestModule {}

describe("Me analytics HTTP E2E", () => {
  let app: INestApplication;
  let baseUrl = "";

  before(async () => {
    app = await NestFactory.create(MeAnalyticsHttpTestModule, {
      logger: false,
    });

    app.setGlobalPrefix("v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        error: () => undefined,
      } as any),
    );

    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it("serves the authenticated user's lightweight analytics", async () => {
    analyticsCalls.length = 0;
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/me/analytics`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data, {
      totalConnections: 12,
      connectionsThisMonth: 4,
    });
    assert.deepEqual(analyticsCalls, [{ userId: "user-1" }]);
  });
});
