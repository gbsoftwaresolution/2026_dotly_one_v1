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
import { DeviceSessionService } from "../src/modules/auth/device-session.service";
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
const TEST_SESSION_ID = "session-current";

const sharingUpdateCalls: Array<{
  userId: string;
  personaId: string;
  payload: unknown;
}> = [];

const personasServiceMock = {
  findAllByUser: async (userId: string) => [{ id: `persona-for-${userId}` }],
  updateSharingMode: async (
    userId: string,
    personaId: string,
    payload: any,
  ) => {
    sharingUpdateCalls.push({ userId, personaId, payload });

    return {
      id: personaId,
      sharingMode: payload.sharingMode ?? "controlled",
      smartCardConfig: payload.smartCardConfig ?? null,
      publicPhone: payload.publicPhone ?? null,
      publicWhatsappNumber: payload.publicWhatsappNumber ?? null,
      publicEmail: payload.publicEmail ?? null,
    };
  },
};

const profilesServiceMock = {
  getPublicProfile: async () => ({
    username: "alice",
    publicUrl: "https://dotly.id/alice",
    fullName: "Alice Demo",
    jobTitle: "Founder",
    companyName: "Dotly",
    tagline: "Connect fast",
    profilePhotoUrl: null,
    sharingMode: "smart_card",
    instantConnectUrl: null,
    trust: {
      isVerified: true,
      isStrongVerified: false,
      isBusinessVerified: false,
    },
    smartCard: {
      primaryAction: "request_access",
      actionState: {
        requestAccessEnabled: true,
        instantConnectEnabled: false,
        contactMeEnabled: true,
      },
      actionLinks: {
        call: null,
        whatsapp: "https://wa.me/15551234567",
        email: null,
        vcard: "/v1/public/personas/alice/vcard",
      },
    },
  }),
  getPublicVcard: async () => ({
    filename: "alice.vcf",
    content: [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Alice Demo",
      "TITLE:Founder",
      "ORG:Dotly",
      "URL:https://dotly.id/alice",
      "END:VCARD",
      "",
    ].join("\r\n"),
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

const deviceSessionServiceMock = {
  validateSession: async (_userId: string, sessionId: string) => ({
    status: "active" as const,
    session: {
      id: sessionId,
      expiresAt: new Date("2026-03-28T09:00:00.000Z"),
    },
  }),
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
    {
      provide: DeviceSessionService,
      useValue: deviceSessionServiceMock,
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

  it("accepts authenticated sharing updates with strict nested validation", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/personas/4b26dc1f-9238-46db-89c5-d9d2476f8c51/sharing`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sharingMode: "smart_card",
          publicWhatsappNumber: " +1 555 123 4567 ",
          smartCardConfig: {
            primaryAction: "instant_connect",
            allowWhatsapp: true,
            allowVcard: true,
          },
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(sharingUpdateCalls.at(-1)?.userId, "user-84");
    assert.equal(
      sharingUpdateCalls.at(-1)?.personaId,
      "4b26dc1f-9238-46db-89c5-d9d2476f8c51",
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(sharingUpdateCalls.at(-1)?.payload)),
      {
        sharingMode: "smart_card",
        publicWhatsappNumber: "+1 555 123 4567",
        smartCardConfig: {
          primaryAction: "instant_connect",
          allowCall: false,
          allowWhatsapp: true,
          allowEmail: false,
          allowVcard: true,
        },
      },
    );
  });

  it("rejects smart card mode without smart card config", async () => {
    const callCountBefore = sharingUpdateCalls.length;
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/personas/4b26dc1f-9238-46db-89c5-d9d2476f8c51/sharing`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sharingMode: "smart_card",
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.deepEqual(payload.message, [
      "smartCardConfig is required when sharingMode is smart_card",
    ]);
    assert.equal(sharingUpdateCalls.length, callCountBefore);
  });

  it("rejects unknown smart card config fields", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/personas/4b26dc1f-9238-46db-89c5-d9d2476f8c51/sharing`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sharingMode: "smart_card",
          smartCardConfig: {
            primaryAction: "request_access",
            internalFlag: true,
          },
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.deepEqual(payload.message, [
      "smartCardConfig.property internalFlag should not exist",
    ]);
  });

  it("rejects spoofed trust fields on persona sharing writes", async () => {
    const token = await jwtService.signAsync({
      sub: "user-84",
      email: "user84@example.com",
      sessionId: TEST_SESSION_ID,
    });

    const response = await fetch(
      `${baseUrl}/v1/personas/4b26dc1f-9238-46db-89c5-d9d2476f8c51/sharing`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sharingMode: "controlled",
          emailVerified: true,
          trustScore: 100,
        }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.deepEqual(payload.message, [
      "property emailVerified should not exist",
      "property trustScore should not exist",
    ]);
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
        sessionId: TEST_SESSION_ID,
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
      sessionId: TEST_SESSION_ID,
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
    const response = await fetch(`${baseUrl}/v1/public/personas/alice`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data, {
      username: "alice",
      publicUrl: "https://dotly.id/alice",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      profilePhotoUrl: null,
      sharingMode: "smart_card",
      instantConnectUrl: null,
      trust: {
        isVerified: true,
        isStrongVerified: false,
        isBusinessVerified: false,
      },
      smartCard: {
        primaryAction: "request_access",
        actionState: {
          requestAccessEnabled: true,
          instantConnectEnabled: false,
          contactMeEnabled: true,
        },
        actionLinks: {
          call: null,
          whatsapp: "https://wa.me/15551234567",
          email: null,
          vcard: "/v1/public/personas/alice/vcard",
        },
      },
    });
    assert.equal(payload.data.id, undefined);
    assert.equal(payload.data.accessMode, undefined);
    assert.equal(payload.data.verifiedOnly, undefined);
    assert.equal(payload.data.emailVerified, undefined);
    assert.equal(payload.data.phoneVerified, undefined);
    assert.equal(payload.data.businessVerified, undefined);
    assert.equal(payload.data.trustScore, undefined);
  });

  it("downloads public vcards without a JSON envelope", async () => {
    const response = await fetch(`${baseUrl}/v1/public/personas/alice/vcard`);
    const payload = await response.text();

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^text\/vcard; charset=utf-8$/,
    );
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="alice.vcf"',
    );
    assert.match(payload, /BEGIN:VCARD/);
    assert.match(payload, /FN:Alice Demo/);
    assert.doesNotMatch(payload, /"success":true/);
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
      sessionId: TEST_SESSION_ID,
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
