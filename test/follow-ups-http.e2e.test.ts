import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  Module,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PrismaService } from "../src/infrastructure/database/prisma.service";
import { DeviceSessionService } from "../src/modules/auth/device-session.service";
import { FollowUpsController } from "../src/modules/follow-ups/follow-ups.controller";
import { FollowUpsService } from "../src/modules/follow-ups/follow-ups.service";

const JWT_ISSUER = "dotly-backend";
const JWT_AUDIENCE = "dotly-clients";
const JWT_SECRET = "test-secret";
const TEST_SESSION_ID = "session-current";

const createCalls: Array<{ userId: string; payload: unknown }> = [];
const listCalls: Array<{ userId: string; query: unknown }> = [];
const listDueCalls: Array<{ userId: string }> = [];
const processDueCalls: Array<{ userId: string }> = [];
const getCalls: Array<{ userId: string; id: string }> = [];
const updateCalls: Array<{ userId: string; id: string; payload: unknown }> = [];
const completeCalls: Array<{ userId: string; id: string }> = [];
const cancelCalls: Array<{ userId: string; id: string }> = [];

function createMockFollowUp() {
  return {
    id: "follow-up-1",
    relationshipId: "relationship-1",
    remindAt: new Date("2099-04-10T10:00:00.000Z"),
    triggeredAt: null,
    status: "pending",
    note: "Follow up on partnership discussion",
    createdAt: new Date("2099-04-01T09:00:00.000Z"),
    updatedAt: new Date("2099-04-01T09:00:00.000Z"),
    completedAt: null,
    relationship: {
      relationshipId: "relationship-1",
      state: "approved",
      targetPersona: {
        id: "persona-1",
        username: "alice",
        fullName: "Alice Demo",
        jobTitle: "Founder",
        companyName: "Dotly",
        profilePhotoUrl: null,
      },
    },
    metadata: {
      isOverdue: false,
      isUpcomingSoon: true,
      isTriggered: false,
    },
  };
}

const followUpsServiceMock = {
  createFollowUp: async (userId: string, payload: unknown) => {
    createCalls.push({ userId, payload });
    return createMockFollowUp();
  },
  listFollowUps: async (userId: string, query: unknown) => {
    listCalls.push({ userId, query });
    return [];
  },
  listDueFollowUps: async (userId: string) => {
    listDueCalls.push({ userId });
    return [createMockFollowUp()];
  },
  processDueFollowUps: async ({ userId }: { userId: string }) => {
    processDueCalls.push({ userId });
    return {
      processedCount: 1,
    };
  },
  getFollowUp: async (userId: string, id: string) => {
    getCalls.push({ userId, id });
    return createMockFollowUp();
  },
  updateFollowUp: async (userId: string, id: string, payload: unknown) => {
    updateCalls.push({ userId, id, payload });
    return createMockFollowUp();
  },
  completeFollowUp: async (userId: string, id: string) => {
    completeCalls.push({ userId, id });
    return {
      ...createMockFollowUp(),
      status: "completed",
      completedAt: new Date("2099-04-11T10:00:00.000Z"),
    };
  },
  cancelFollowUp: async (userId: string, id: string) => {
    cancelCalls.push({ userId, id });
    return {
      ...createMockFollowUp(),
      status: "cancelled",
    };
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

const deviceSessionServiceMock = {
  validateSession: async (_userId: string, sessionId: string) => ({
    status: "active" as const,
    session: {
      id: sessionId,
      expiresAt: new Date("2026-03-28T09:00:00.000Z"),
    },
  }),
};

const prismaServiceMock = {
  user: {
    findUnique: async (args: { where: { id: string } }) => ({
      id: args.where.id,
      email: "user@example.com",
      isVerified: false,
    }),
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
  controllers: [FollowUpsController],
  providers: [
    JwtAuthGuard,
    {
      provide: JwtService,
      useValue: jwtService,
    },
    {
      provide: FollowUpsService,
      useValue: followUpsServiceMock,
    },
    {
      provide: ConfigService,
      useValue: configServiceMock,
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
class FollowUpsHttpTestModule {}

describe("Follow-ups HTTP E2E", () => {
  let app: INestApplication;
  let baseUrl = "";

  beforeEach(() => {
    createCalls.length = 0;
    listCalls.length = 0;
    listDueCalls.length = 0;
    processDueCalls.length = 0;
    getCalls.length = 0;
    updateCalls.length = 0;
    completeCalls.length = 0;
    cancelCalls.length = 0;
  });

  before(async () => {
    app = await NestFactory.create(FollowUpsHttpTestModule, {
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

  it("requires authentication for follow-up routes", async () => {
    const response = await fetch(`${baseUrl}/v1/follow-ups`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
  });

  it("rejects invalid remindAt values before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relationshipId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
        remindAt: "2000-01-01T00:00:00.000Z",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(createCalls.length, 0);
  });

  it("rejects non-ISO remindAt values before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relationshipId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
        remindAt: "April 10 2099 10:00 AM",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(createCalls.length, 0);
  });

  it("rejects invalid relationship ids before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relationshipId: "not-a-uuid",
        remindAt: "2099-04-10T10:00:00.000Z",
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(createCalls.length, 0);
  });

  it("accepts preset-based creation with minimal input", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relationshipId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
        preset: "TOMORROW",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.success, true);
    assert.deepEqual(JSON.parse(JSON.stringify(createCalls.at(-1))), {
      userId: "user-84",
      payload: {
        relationshipId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
        preset: "TOMORROW",
      },
    });
  });

  it("rejects invalid follow-up presets before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relationshipId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
        preset: "LATER",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(createCalls.length, 0);
  });

  it("parses authenticated list query filters and delegates to the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/follow-ups?upcoming=true&status=pending&relationshipId=4b26dc1f-9238-46db-89c5-d9d2476f8c51`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(listCalls.at(-1)?.userId, "user-84");
    assert.deepEqual(JSON.parse(JSON.stringify(listCalls.at(-1)?.query)), {
      upcoming: true,
      status: "pending",
      relationshipId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
    });
  });

  it("returns the authenticated user's due follow-ups", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups/due`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(listDueCalls.at(-1), {
      userId: "user-84",
    });
    assert.equal(payload.data[0]?.metadata.isTriggered, false);
  });

  it("processes due follow-ups for the authenticated user", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups/process-due`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.success, true);
    assert.deepEqual(processDueCalls.at(-1), {
      userId: "user-84",
    });
    assert.equal(payload.data.processedCount, 1);
  });

  it("rejects invalid follow-up status query params before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups?status=archived`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
  });

  it("rejects invalid list relationship ids before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/follow-ups?relationshipId=not-a-uuid`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
  });

  it("rejects invalid upcoming query params before reaching the service", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(`${baseUrl}/v1/follow-ups?upcoming=soon`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
  });

  it("returns the authenticated user's follow-up by id", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/follow-ups/4b26dc1f-9238-46db-89c5-d9d2476f8c51`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(getCalls.at(-1), {
      userId: "user-84",
      id: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
    });
  });

  it("returns 404 when the service hides another user's follow-up", async () => {
    const originalGetFollowUp = followUpsServiceMock.getFollowUp;
    followUpsServiceMock.getFollowUp = async () => {
      throw new NotFoundException("Follow-up not found");
    };

    try {
      const token = await jwtService.signAsync({
        sub: "user-84",
        email: "user84@example.com",
        sessionId: TEST_SESSION_ID,
      });

      const response = await fetch(
        `${baseUrl}/v1/follow-ups/4b26dc1f-9238-46db-89c5-d9d2476f8c51`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const payload = await response.json();

      assert.equal(response.status, 404);
      assert.equal(payload.success, false);
    } finally {
      followUpsServiceMock.getFollowUp = originalGetFollowUp;
    }
  });

  it("returns 409 when trying to re-complete a non-pending follow-up", async () => {
    const originalCompleteFollowUp = followUpsServiceMock.completeFollowUp;
    followUpsServiceMock.completeFollowUp = async () => {
      throw new ConflictException("Only pending follow-ups can be completed");
    };

    try {
      const token = await jwtService.signAsync({
        sub: "user-84",
        email: "user84@example.com",
        sessionId: TEST_SESSION_ID,
      });

      const response = await fetch(
        `${baseUrl}/v1/follow-ups/4b26dc1f-9238-46db-89c5-d9d2476f8c51/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const payload = await response.json();

      assert.equal(response.status, 409);
      assert.equal(payload.success, false);
    } finally {
      followUpsServiceMock.completeFollowUp = originalCompleteFollowUp;
    }
  });
});
