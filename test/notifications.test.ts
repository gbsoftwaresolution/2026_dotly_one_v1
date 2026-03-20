import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { of } from "rxjs";

import { NotificationType } from "../src/common/enums/notification-type.enum";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response-envelope.interceptor";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";
import { NotificationsController } from "../src/modules/notifications/notifications.controller";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { QrService } from "../src/modules/qr/qr.service";
import { EventsService } from "../src/modules/events/events.service";
import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { EventParticipantRole } from "../src/common/enums/event-participant-role.enum";

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
      { id: "user-1", email: "user@example.com" },
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
      { id: "user-1", email: "user@example.com" },
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
});

describe("Notification hooks", () => {
  it("creates a request_received notification for profile requests", async () => {
    const notifications: unknown[] = [];

    const service = new ContactRequestsService(
      {
        persona: {
          findUnique: async () => ({
            id: "target-persona",
            userId: "target-user",
            username: "target",
            fullName: "Target User",
            accessMode: "OPEN",
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

    const service = new ContactRequestsService(
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
        createApprovedRelationship: async () => ({ id: "relationship-id" }),
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
  });
});
