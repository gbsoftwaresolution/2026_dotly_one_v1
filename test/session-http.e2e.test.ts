import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";

import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { DeviceSessionService } from "../src/modules/auth/device-session.service";
import { UsersController } from "../src/modules/users/users.controller";
import { UsersService } from "../src/modules/users/users.service";

const JWT_ISSUER = "dotly-backend";
const JWT_AUDIENCE = "dotly-clients";
const JWT_SECRET = "session-test-secret";
const SESSION_CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_OTHER_ID = "22222222-2222-4222-8222-222222222222";

const sessionCalls = {
  list: [] as Array<{ userId: string; sessionId: string | undefined }>,
  revoke: [] as Array<{
    userId: string;
    currentSessionId: string;
    sessionId: string;
  }>,
  revokeOthers: [] as Array<{ userId: string; currentSessionId: string }>,
};

let sessionValidationResult:
  | { status: "active"; session: { id: string; expiresAt: Date } }
  | { status: "missing" } = {
  status: "active",
  session: {
    id: SESSION_CURRENT_ID,
    expiresAt: new Date("2026-03-28T09:00:00.000Z"),
  },
};

const usersServiceMock = {
  listSessions: async (userId: string, sessionId?: string) => {
    sessionCalls.list.push({ userId, sessionId });

    return {
      sessions: [
        {
          id: SESSION_CURRENT_ID,
          deviceLabel: "MacBook Pro · Chrome",
          platformLabel: "macOS",
          createdAt: new Date("2026-03-21T09:00:00.000Z"),
          lastActiveAt: new Date("2026-03-21T11:45:00.000Z"),
          expiresAt: new Date("2026-03-28T09:00:00.000Z"),
          isCurrent: true,
        },
      ],
    };
  },
  revokeSession: async (
    userId: string,
    currentSessionId: string,
    dto: { sessionId: string },
  ) => {
    sessionCalls.revoke.push({
      userId,
      currentSessionId,
      sessionId: dto.sessionId,
    });

    return {
      success: true,
    };
  },
  revokeOtherSessions: async (userId: string, currentSessionId: string) => {
    sessionCalls.revokeOthers.push({ userId, currentSessionId });

    return {
      success: true,
      revokedCount: 2,
    };
  },
};

const deviceSessionServiceMock = {
  validateSession: async (_userId: string, _sessionId: string) =>
    sessionValidationResult,
};

const prismaServiceMock = {
  user: {
    findUnique: async () => ({
      id: "user-1",
      email: "user@example.com",
      isVerified: false,
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
  controllers: [UsersController],
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
      provide: UsersService,
      useValue: usersServiceMock,
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
class SessionHttpTestModule {}

describe("Session HTTP E2E", () => {
  let app: INestApplication;
  let baseUrl = "";

  before(async () => {
    app = await NestFactory.create(SessionHttpTestModule, {
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

  it("lists tracked sessions for the authenticated user", async () => {
    sessionCalls.list.length = 0;
    sessionValidationResult = {
      status: "active",
      session: {
        id: SESSION_CURRENT_ID,
        expiresAt: new Date("2026-03-28T09:00:00.000Z"),
      },
    };
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
      sessionId: SESSION_CURRENT_ID,
    });

    const response = await fetch(`${baseUrl}/v1/users/me/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.sessions[0].id, SESSION_CURRENT_ID);
    assert.deepEqual(sessionCalls.list, [
      {
        userId: "user-1",
        sessionId: SESSION_CURRENT_ID,
      },
    ]);
  });

  it("revokes a selected session for the authenticated user", async () => {
    sessionCalls.revoke.length = 0;
    sessionValidationResult = {
      status: "active",
      session: {
        id: SESSION_CURRENT_ID,
        expiresAt: new Date("2026-03-28T09:00:00.000Z"),
      },
    };
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
      sessionId: SESSION_CURRENT_ID,
    });

    const response = await fetch(`${baseUrl}/v1/users/me/sessions/revoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: SESSION_OTHER_ID,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(sessionCalls.revoke, [
      {
        userId: "user-1",
        currentSessionId: SESSION_CURRENT_ID,
        sessionId: SESSION_OTHER_ID,
      },
    ]);
  });

  it("revokes all other sessions for the authenticated user", async () => {
    sessionCalls.revokeOthers.length = 0;
    sessionValidationResult = {
      status: "active",
      session: {
        id: SESSION_CURRENT_ID,
        expiresAt: new Date("2026-03-28T09:00:00.000Z"),
      },
    };
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
      sessionId: SESSION_CURRENT_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/users/me/sessions/revoke-others`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.revokedCount, 2);
    assert.deepEqual(sessionCalls.revokeOthers, [
      {
        userId: "user-1",
        currentSessionId: SESSION_CURRENT_ID,
      },
    ]);
  });

  it("rejects requests when the tracked session has been revoked", async () => {
    sessionValidationResult = {
      status: "missing",
    };
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
      sessionId: SESSION_CURRENT_ID,
    });

    const response = await fetch(`${baseUrl}/v1/users/me/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.message, "Invalid authentication token");
  });

  it("rejects requests when the JWT does not carry a tracked session id", async () => {
    sessionValidationResult = {
      status: "active",
      session: {
        id: SESSION_CURRENT_ID,
        expiresAt: new Date("2026-03-28T09:00:00.000Z"),
      },
    };
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
    });

    const response = await fetch(`${baseUrl}/v1/users/me/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.message, "Invalid authentication token");
  });
});