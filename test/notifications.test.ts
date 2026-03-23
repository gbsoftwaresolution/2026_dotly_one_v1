import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PersonaSharingMode as PrismaPersonaSharingMode } from "@prisma/client";
import { of } from "rxjs";

import { NotificationType } from "../src/common/enums/notification-type.enum";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { ContactRequestCreateService } from "../src/modules/contact-requests/contact-request-create.service";
import { ContactRequestRecipientPolicyService } from "../src/modules/contact-requests/contact-request-recipient-policy.service";
import { ContactRequestRespondService } from "../src/modules/contact-requests/contact-request-respond.service";
import { ContactRequestRetryPolicyService } from "../src/modules/contact-requests/contact-request-retry-policy.service";
import { ContactRequestSourcePolicyService } from "../src/modules/contact-requests/contact-request-source-policy.service";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";
import { NotificationsController } from "../src/modules/notifications/notifications.controller";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { QrService } from "../src/modules/qr/qr.service";
import { EventsService } from "../src/modules/events/events.service";
import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { EventParticipantRole } from "../src/common/enums/event-participant-role.enum";

function buildContactRequestsService(
  prismaService: any,
  personasService: any,
  blocksService: any,
  relationshipsService: any,
  contactMemoryService: any,
  requestRateLimitService: any,
  eventsService: any = { validateEventRequestAccess: async () => undefined },
  notificationsService: any = { createSafe: async () => undefined },
  analyticsService: any = {
    trackRequestSent: async () => undefined,
    trackRequestApproved: async () => undefined,
    trackContactCreated: async () => undefined,
  },
  verificationPolicyService: any = {
    assertUserIsVerified: async () => undefined,
  },
) {
  if (
    prismaService?.persona &&
    typeof prismaService.persona.findFirst !== "function" &&
    typeof prismaService.persona.findUnique === "function"
  ) {
    prismaService.persona.findFirst = prismaService.persona.findUnique;
  }

  return new ContactRequestsService(
    prismaService,
    new ContactRequestCreateService(
      prismaService,
      new ContactRequestRecipientPolicyService(
        prismaService,
        personasService,
        blocksService,
      ),
      new ContactRequestRetryPolicyService(prismaService),
      new ContactRequestSourcePolicyService(eventsService),
      requestRateLimitService,
      notificationsService,
      analyticsService,
      verificationPolicyService,
    ) as any,
    new ContactRequestRespondService(
      prismaService,
      blocksService,
      relationshipsService,
      contactMemoryService,
      notificationsService,
      analyticsService,
    ) as any,
  );
}

describe("NotificationsController", () => {
  it("fetches notifications for the current user", async () => {
    const calls: Array<{ userId: string; query: unknown }> = [];
    const controller = new NotificationsController({
      findAll: async (userId: string, query: unknown) => {
        calls.push({ userId, query });
        return [];
      },
    } as any);

    await controller.findAll(
      { id: "user-1", email: "user@example.com", isVerified: false },
      { limit: 10, offset: 5 },
    );

    assert.deepEqual(calls, [
      {
        userId: "user-1",
        query: { limit: 10, offset: 5 },
      },
    ]);
  });

  it("marks a single notification as read for the current user", async () => {
    const calls: Array<{ userId: string; id: string }> = [];
    const controller = new NotificationsController({
      markAsRead: async (userId: string, id: string) => {
        calls.push({ userId, id });
        return { id, isRead: true };
      },
    } as any);

    const result = await controller.markAsRead(
      { id: "user-1", email: "user@example.com", isVerified: false },
      "1d894fb0-c315-4d74-9f61-c770e7e08d11",
    );

    assert.deepEqual(calls, [
      {
        userId: "user-1",
        id: "1d894fb0-c315-4d74-9f61-c770e7e08d11",
      },
    ]);
    assert.deepEqual(result, {
      id: "1d894fb0-c315-4d74-9f61-c770e7e08d11",
      isRead: true,
    });
  });
});

describe("Notification response polish", () => {
  it("wraps successful responses in the shared envelope", async () => {
    const interceptor = new ResponseEnvelopeInterceptor();

    const result = await new Promise<any>((resolve, reject) => {
      interceptor
        .intercept({} as any, {
          handle: () =>
            of([
              {
                id: "notification-1",
                type: NotificationType.System,
                title: "Welcome back",
                body: "Phase 8 notification seed is ready.",
                isRead: false,
                createdAt: new Date("2026-03-21T10:00:00.000Z"),
                data: {},
              },
            ]),
        })
        .subscribe({ next: resolve, error: reject });
    });

    assert.equal(result.success, true);
    assert.equal(result.data[0].type, NotificationType.System);
    assert.ok(Date.parse(result.timestamp));
  });

  it("returns a consistent 404 error shape", () => {
    let statusCode = 0;
    let payload: any;

    const filter = new GlobalExceptionFilter({
      error: () => undefined,
    } as any);

    filter.catch(new NotFoundException("Notification not found"), {
      switchToHttp: () => ({
        getResponse: () => ({
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(value: unknown) {
            payload = value;
          },
        }),
        getRequest: () => ({
          method: "POST",
          url: "/notifications/1d894fb0-c315-4d74-9f61-c770e7e08d11/read",
        }),
      }),
    } as any);

    assert.equal(statusCode, 404);
    assert.equal(payload.success, false);
    assert.equal(payload.message, "Notification not found");
    assert.equal(
      payload.path,
      "/notifications/1d894fb0-c315-4d74-9f61-c770e7e08d11/read",
    );
    assert.ok(Date.parse(payload.timestamp));
  });

  it("returns a consistent 401 error shape", () => {
    let statusCode = 0;
    let payload: any;

    const filter = new GlobalExceptionFilter({
      error: () => undefined,
    } as any);

    filter.catch(
      new UnauthorizedException("Authentication token is required"),
      {
        switchToHttp: () => ({
          getResponse: () => ({
            status(code: number) {
              statusCode = code;
              return this;
            },
            json(value: unknown) {
              payload = value;
            },
          }),
          getRequest: () => ({
            method: "GET",
            url: "/notifications",
          }),
        }),
      } as any,
    );

    assert.equal(statusCode, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.message, "Authentication token is required");
    assert.equal(payload.path, "/notifications");
    assert.ok(Date.parse(payload.timestamp));
  });

  it("does not expose raw internal error messages", () => {
    let statusCode = 0;
    let payload: any;

    const filter = new GlobalExceptionFilter({
      error: () => undefined,
    } as any);

    filter.catch(new Error("database exploded"), {
      switchToHttp: () => ({
        getResponse: () => ({
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(value: unknown) {
            payload = value;
          },
        }),
        getRequest: () => ({
          method: "GET",
          url: "/notifications",
        }),
      }),
    } as any);

    assert.equal(statusCode, 500);
    assert.equal(payload.message, "Internal server error");
  });
});

describe("NotificationsService", () => {
  it("marks a single owned notification as read", async () => {
    let updatePayload: unknown;

    const service = new NotificationsService(
      {
        notification: {
          findFirst: async () => ({ id: "notification-1" }),
          update: async (payload: unknown) => {
            updatePayload = payload;

            return {
              id: "notification-1",
              type: "REQUEST_RECEIVED",
              title: "New request",
              body: "Alice Demo requested to connect",
              isRead: true,
              createdAt: new Date("2026-03-21T10:00:00.000Z"),
              data: null,
            };
          },
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.markAsRead("user-1", "notification-1");

    assert.equal(result.isRead, true);
    assert.deepEqual((updatePayload as any).data, { isRead: true });
  });

  it("returns the count when marking all notifications as read", async () => {
    const service = new NotificationsService(
      {
        notification: {
          updateMany: async () => ({ count: 4 }),
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.markAllAsRead("user-1");

    assert.deepEqual(result, { updatedCount: 4 });
  });

  it("filters foreign relationship ids from notification data", async () => {
    const service = new NotificationsService(
      {
        notification: {
          findMany: async () => [
            {
              id: "notification-1",
              type: "REQUEST_APPROVED",
              title: "Request approved",
              body: "Receiver User approved your request",
              isRead: false,
              createdAt: new Date("2026-03-21T10:00:00.000Z"),
              data: {
                relationshipId: "foreign-relationship-id",
                requestId: "request-id",
              },
            },
            {
              id: "notification-2",
              type: "INSTANT_CONNECT",
              title: "Instant connect",
              body: "You connected instantly with Target User",
              isRead: false,
              createdAt: new Date("2026-03-21T11:00:00.000Z"),
              data: {
                relationshipId: "owned-relationship-id",
                targetPersonaId: "target-persona",
              },
            },
          ],
          count: async () => 2,
        },
        contactRelationship: {
          findMany: async () => [{ id: "owned-relationship-id" }],
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.findAll("user-1");

    assert.deepEqual(result.notifications[0]?.data, {});
    assert.deepEqual(result.notifications[1]?.data, {
      relationshipId: "owned-relationship-id",
    });
  });

  it("filters foreign relationship ids when marking a notification as read", async () => {
    const service = new NotificationsService(
      {
        notification: {
          findFirst: async () => ({ id: "notification-1" }),
          update: async () => ({
            id: "notification-1",
            type: "INSTANT_CONNECT",
            title: "Instant connect",
            body: "Someone connected with your QR",
            isRead: true,
            createdAt: new Date("2026-03-21T10:00:00.000Z"),
            data: {
              relationshipId: "foreign-relationship-id",
              sourcePersonaId: "source-persona",
            },
          }),
        },
        contactRelationship: {
          findMany: async () => [],
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.markAsRead("user-1", "notification-1");

    assert.deepEqual(result.data, {});
  });

  it("enforces allowed notification payload fields by type", async () => {
    const service = new NotificationsService(
      {
        notification: {
          findMany: async () => [
            {
              id: "notification-request-received",
              type: "REQUEST_RECEIVED",
              title: "New request",
              body: "Alice Demo requested to connect",
              isRead: false,
              createdAt: new Date("2026-03-21T10:00:00.000Z"),
              data: {
                requestId: "request-id",
                fromPersonaId: "from-persona",
                sourceType: "profile",
                sourceId: "source-id",
                relationshipId: "foreign-relationship-id",
                injected: "drop-me",
              },
            },
            {
              id: "notification-request-approved",
              type: "REQUEST_APPROVED",
              title: "Request approved",
              body: "Receiver User approved your request",
              isRead: false,
              createdAt: new Date("2026-03-21T10:01:00.000Z"),
              data: {
                requestId: "request-approved-id",
                toPersonaId: "to-persona",
                relationshipId: "owned-relationship-id",
                injected: "drop-me",
              },
            },
            {
              id: "notification-instant-connect-owned",
              type: "INSTANT_CONNECT",
              title: "Instant connect",
              body: "You connected instantly with Target User",
              isRead: false,
              createdAt: new Date("2026-03-21T10:02:00.000Z"),
              data: {
                relationshipId: "owned-relationship-id",
                targetPersonaId: "target-persona",
                injected: "drop-me",
              },
            },
            {
              id: "notification-instant-connect-received",
              type: "INSTANT_CONNECT",
              title: "Instant connect",
              body: "Alice Demo connected with your QR",
              isRead: false,
              createdAt: new Date("2026-03-21T10:03:00.000Z"),
              data: {
                sourcePersonaId: "source-persona",
                relationshipId: "foreign-relationship-id",
                injected: "drop-me",
              },
            },
            {
              id: "notification-event-joined",
              type: "EVENT_JOINED",
              title: "Event joined",
              body: "You joined Dotly Summit",
              isRead: false,
              createdAt: new Date("2026-03-21T10:04:00.000Z"),
              data: {
                eventId: "event-id",
                personaId: "persona-id",
                requestId: "drop-me",
                injected: "drop-me",
              },
            },
            {
              id: "notification-event-request",
              type: "EVENT_REQUEST",
              title: "Event request",
              body: "Alice Demo wants to connect from an event",
              isRead: false,
              createdAt: new Date("2026-03-21T10:05:00.000Z"),
              data: {
                requestId: "event-request-id",
                fromPersonaId: "event-from-persona",
                sourceType: "event",
                sourceId: "event-id",
                targetPersonaId: "drop-me",
                injected: "drop-me",
              },
            },
            {
              id: "notification-system",
              type: "SYSTEM",
              title: "System message",
              body: "Hello",
              isRead: false,
              createdAt: new Date("2026-03-21T10:06:00.000Z"),
              data: {
                arbitrary: "drop-me",
              },
            },
          ],
          count: async () => 7,
        },
        contactRelationship: {
          findMany: async () => [{ id: "owned-relationship-id" }],
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.findAll("user-1");

    assert.deepEqual(
      result.notifications.map((notification) => notification.data),
      [
        {
          sourceType: ContactRequestSourceType.Profile,
        },
        {
          relationshipId: "owned-relationship-id",
        },
        {
          relationshipId: "owned-relationship-id",
        },
        {},
        {},
        {
          sourceType: ContactRequestSourceType.Event,
        },
        {},
      ],
    );
  });
});

describe("Notification hooks", () => {
  it("creates a request_received notification for profile requests", async () => {
    const notifications: unknown[] = [];

    const service = buildContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: "OPEN",
            sharingMode: PrismaPersonaSharingMode.CONTROLLED,
            smartCardConfig: null,
            verifiedOnly: false,
          }),
        },
        user: {
          findUnique: async () => ({
            id: "sender-user",
            isVerified: true,
          }),
        },
        contactRequest: {
          findFirst: async () => null,
          create: async () => ({
            id: "request-id",
            status: "PENDING",
            createdAt: new Date("2026-03-21T10:00:00.000Z"),
            toPersona: {
              id: "target-persona",
              username: "target",
              fullName: "Target User",
            },
          }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({
          id: "from-persona",
          fullName: "Alice Demo",
        }),
      } as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {} as any,
      {} as any,
      {
        reserveAndCreate: async (
          _userId: string,
          callback: (tx: any) => Promise<any>,
        ) =>
          callback({
            contactRequest: {
              create: async () => ({
                id: "request-id",
                status: "PENDING",
                createdAt: new Date("2026-03-21T10:00:00.000Z"),
                toPersona: {
                  id: "target-persona",
                  username: "target",
                  fullName: "Target User",
                },
              }),
            },
          }),
      } as any,
      {
        validateEventRequestAccess: async () => undefined,
      } as any,
      {
        createSafe: async (payload: unknown) => {
          notifications.push(payload);
        },
      } as any,
      {
        trackRequestSent: async () => undefined,
        trackRequestApproved: async () => undefined,
        trackContactCreated: async () => undefined,
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await service.create("sender-user", {
      fromPersonaId: "from-persona",
      toPersonaId: "target-persona",
      sourceType: ContactRequestSourceType.Profile,
    });

    assert.equal(
      (notifications[0] as any).type,
      NotificationType.RequestReceived,
    );
    assert.equal((notifications[0] as any).userId, "target-user");
    assert.equal(
      (notifications[0] as any).body,
      "Alice Demo requested to connect",
    );
  });

  it("creates a request_approved notification on approval", async () => {
    const notifications: Array<{ payload: unknown; tx: unknown }> = [];
    const interactionUpdates: string[] = [];

    const service = buildContactRequestsService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            contactRequest: {
              findUnique: async () => ({
                id: "request-id",
                status: "PENDING",
                fromUserId: "sender-user",
                toUserId: "receiver-user",
                fromPersonaId: "from-persona",
                toPersonaId: "to-persona",
                sourceType: "PROFILE",
                sourceId: null,
                toPersona: {
                  fullName: "Receiver User",
                },
              }),
              updateMany: async () => ({ count: 1 }),
            },
          }),
      } as any,
      {} as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
      {
        createApprovedRelationship: async () => ({
          id: "relationship-id",
          reciprocalRelationshipId: "relationship-reciprocal-id",
        }),
        updateInteractionMetadata: async (
          _tx: unknown,
          relationshipId: string,
        ) => {
          interactionUpdates.push(relationshipId);
          return null;
        },
      } as any,
      {
        createInitialMemory: async () => ({ id: "memory-id" }),
      } as any,
      {} as any,
      {} as any,
      {
        createSafe: async (payload: unknown, tx: unknown) => {
          notifications.push({ payload, tx });
        },
      } as any,
    );

    const result = await service.approve("receiver-user", "request-id");

    assert.equal(result.relationshipId, "relationship-id");
    assert.equal(
      (notifications[0]?.payload as any).type,
      NotificationType.RequestApproved,
    );
    assert.equal(
      (notifications[0]?.payload as any).body,
      "Receiver User approved your request",
    );
    assert.deepEqual((notifications[0]?.payload as any).data, {
      relationshipId: "relationship-reciprocal-id",
    });
    assert.deepEqual(interactionUpdates, [
      "relationship-id",
      "relationship-reciprocal-id",
    ]);
  });

  it("creates an event_joined notification when joining an event", async () => {
    const notifications: unknown[] = [];

    const service = new EventsService(
      {
        event: {
          findUnique: async () => ({
            id: "event-id",
            name: "Dotly Summit",
            slug: "dotly-summit",
            description: null,
            startsAt: new Date(Date.now() - 60_000),
            endsAt: new Date(Date.now() + 60_000),
            location: "Chennai",
            status: "LIVE",
            createdByUserId: "organizer-user",
            createdAt: new Date("2026-03-21T10:00:00.000Z"),
            updatedAt: new Date("2026-03-21T10:00:00.000Z"),
          }),
          findFirst: async () => ({
            id: "event-id",
            name: "Dotly Summit",
            slug: "dotly-summit",
            description: null,
            startsAt: new Date(Date.now() - 60_000),
            endsAt: new Date(Date.now() + 60_000),
            location: "Chennai",
            status: "LIVE",
            createdByUserId: "organizer-user",
            createdAt: new Date("2026-03-21T10:00:00.000Z"),
            updatedAt: new Date("2026-03-21T10:00:00.000Z"),
            participants: [
              {
                personaId: "persona-id",
                role: "ATTENDEE",
                discoveryEnabled: false,
              },
            ],
          }),
        },
        eventParticipant: {
          create: async () => ({ id: "participant-id" }),
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      {
        createSafe: async (payload: unknown) => {
          notifications.push(payload);
        },
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await service.join("user-id", "event-id", {
      personaId: "persona-id",
      role: EventParticipantRole.Attendee,
    });

    assert.equal((notifications[0] as any).type, NotificationType.EventJoined);
    assert.equal((notifications[0] as any).body, "You joined Dotly Summit");
  });

  it("creates instant_connect notifications for both users", async () => {
    const notifications: unknown[] = [];

    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            user: {
              findUnique: async () => ({
                id: "scanner-user",
                isVerified: true,
              }),
            },
            qRAccessToken: {
              findUnique: async (args: any) => {
                if (args.where.code) {
                  return {
                    id: "qr-token-id",
                    type: "quick_connect",
                    startsAt: null,
                    endsAt: new Date("2099-03-20T15:00:00.000Z"),
                    maxUses: 5,
                    usedCount: 1,
                    status: "active",
                    rules: { durationHours: 4 },
                    persona: {
                      id: "target-persona",
                      userId: "target-user",
                      username: "target",
                      fullName: "Target User",
                      jobTitle: "Founder",
                      companyName: "Dotly",
                      tagline: "Connect fast",
                      profilePhotoUrl: null,
                      verifiedOnly: false,
                    },
                  };
                }

                return null;
              },
              updateMany: async () => ({ count: 1 }),
            },
          }),
      } as any,
      {
        get: () => "https://dotly.id/q",
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({
          id: "from-persona",
          fullName: "Alice Demo",
        }),
      } as any,
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        createOrRefreshInstantAccessRelationship: async () => ({
          id: "relationship-id",
          accessStartAt: new Date("2099-03-20T12:00:00.000Z"),
          accessEndAt: new Date("2099-03-20T16:00:00.000Z"),
        }),
      } as any,
      {
        createInitialMemory: async () => ({ id: "memory-id" }),
      } as any,
      {
        createSafe: async (payload: unknown) => {
          notifications.push(payload);
        },
      } as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await service.connectQuickConnectQr("scanner-user", "qr", {
      fromPersonaId: "from-persona",
    });

    assert.equal(notifications.length, 2);
    assert.deepEqual(
      notifications.map((notification: any) => notification.type),
      [NotificationType.InstantConnect, NotificationType.InstantConnect],
    );
    assert.equal(
      (notifications[1] as any).body,
      "Alice Demo connected with your QR",
    );
    assert.deepEqual((notifications[0] as any).data, {
      relationshipId: "relationship-id",
    });
    assert.deepEqual((notifications[1] as any).data, {});
  });
});
