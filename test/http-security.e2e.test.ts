import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";

import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { ContactRequestsController } from "../src/modules/contact-requests/contact-requests.controller";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";
import { EventsController } from "../src/modules/events/events.controller";
import { EventsService } from "../src/modules/events/events.service";
import { NotificationsController } from "../src/modules/notifications/notifications.controller";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { PersonasController } from "../src/modules/personas/personas.controller";
import { PersonasService } from "../src/modules/personas/personas.service";
import { ProfilesController } from "../src/modules/profiles/profiles.controller";
import { ProfilesService } from "../src/modules/profiles/profiles.service";
import { QrController } from "../src/modules/qr/qr.controller";
import { QrService } from "../src/modules/qr/qr.service";

const JWT_ISSUER = "dotly-backend";
const JWT_AUDIENCE = "dotly-clients";
const JWT_SECRET = "test-secret";

const personasServiceMock = {
  findAllByUser: async (userId: string) => [{ id: `persona-for-${userId}` }],
};

const profilesServiceMock = {
  getPublicProfile: async () => ({
    username: "alice",
    fullName: "Alice Demo",
    jobTitle: "Founder",
    companyName: "Dotly",
    tagline: "Connect fast",
    profilePhotoUrl: null,
  }),
};

const qrServiceMock = {
  resolveQr: async () => ({
    type: "quick_connect",
    code: "qr-code",
    persona: {
      username: "alice",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      profilePhotoUrl: null,
    },
  }),
};

const requestCalls: Array<{ userId: string; payload: unknown }> = [];
const contactRequestsServiceMock = {
  create: async (userId: string, payload: unknown) => {
    requestCalls.push({ userId, payload });
    return {
      id: "request-id",
      status: "pending",
    };
  },
};

const notificationCalls: Array<{ userId: string; query: unknown }> = [];
const notificationsServiceMock = {
  findAll: async (userId: string, query: unknown) => {
    notificationCalls.push({ userId, query });
    return {
      notifications: [],
      total: 0,
      unreadCount: 0,
    };
  },
};

const eventsServiceMock = {
  findVisibleParticipants: async () => [],
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
  controllers: [
    PersonasController,
    ProfilesController,
    QrController,
    ContactRequestsController,
    NotificationsController,
    EventsController,
  ],
  providers: [
    JwtAuthGuard,
    {
      provide: JwtService,
      useValue: jwtService,
    },
    {
      provide: "ConfigService",
      useValue: configServiceMock,
    },
    {
      provide: PersonasService,
      useValue: personasServiceMock,
    },
    {
      provide: ProfilesService,
      useValue: profilesServiceMock,
    },
    {
      provide: QrService,
      useValue: qrServiceMock,
    },
    {
      provide: ContactRequestsService,
      useValue: contactRequestsServiceMock,
    },
    {
      provide: NotificationsService,
      useValue: notificationsServiceMock,
    },
    {
      provide: EventsService,
      useValue: eventsServiceMock,
    },
    {
      provide: ConfigService,
      useValue: configServiceMock,
    },
  ],
})
class HttpSecurityTestModule {}

describe("HTTP Security E2E", () => {
  let app: INestApplication;
  let baseUrl = "";

  before(async () => {
    app = await NestFactory.create(HttpSecurityTestModule, {
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

  it("rejects protected endpoints without authentication", async () => {
    const response = await fetch(`${baseUrl}/v1/personas`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.message, "Authentication token is required");
  });

  it("rejects tokens with the wrong audience", async () => {
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        email: "user@example.com",
      },
      {
        audience: "wrong-audience",
        issuer: JWT_ISSUER,
      },
    );

    const response = await fetch(`${baseUrl}/v1/personas`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.message, "Invalid authentication token");
  });

  it("rejects spoofed body fields on protected writes", async () => {
    const token = await jwtService.signAsync({
      sub: "user-1",
      email: "user@example.com",
    });

    const response = await fetch(`${baseUrl}/v1/contact-requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromPersonaId: "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
        toPersonaId: "581193ab-bc38-460f-b0ea-fdd30429c750",
        sourceType: ContactRequestSourceType.Profile,
        userId: "spoofed-user",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.deepEqual(payload.message, ["property userId should not exist"]);
    assert.equal(requestCalls.length, 0);
  });

  it("serves public profiles with only the allowed public fields", async () => {
    const response = await fetch(`${baseUrl}/v1/public/alice`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data, {
      username: "alice",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      profilePhotoUrl: null,
    });
    assert.equal(payload.data.id, undefined);
    assert.equal(payload.data.accessMode, undefined);
    assert.equal(payload.data.verifiedOnly, undefined);
  });

  it("serves QR resolution without leaking internal QR metadata", async () => {
    const response = await fetch(`${baseUrl}/v1/qr/qr-code`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data, {
      type: "quick_connect",
      code: "qr-code",
      persona: {
        username: "alice",
        fullName: "Alice Demo",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Connect fast",
        profilePhotoUrl: null,
      },
    });
    assert.equal(payload.data.quickConnect, undefined);
    assert.equal(payload.data.persona.id, undefined);
  });

  it("uses the authenticated user identity server-side", async () => {
    const token = await jwtService.signAsync({
      sub: "user-42",
      email: "user42@example.com",
    });

    const response = await fetch(
      `${baseUrl}/v1/notifications?limit=5&offset=0`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(notificationCalls.at(-1)?.userId, "user-42");
    assert.equal((notificationCalls.at(-1)?.query as any)?.limit, 5);
    assert.equal((notificationCalls.at(-1)?.query as any)?.offset, 0);
  });
});
