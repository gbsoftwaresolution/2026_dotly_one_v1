import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";

import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { EventParticipantRole } from "../src/common/enums/event-participant-role.enum";
import { ContactRequestCreateService } from "../src/modules/contact-requests/contact-request-create.service";
import { ContactRequestRecipientPolicyService } from "../src/modules/contact-requests/contact-request-recipient-policy.service";
import { ContactRequestRespondService } from "../src/modules/contact-requests/contact-request-respond.service";
import { ContactRequestRetryPolicyService } from "../src/modules/contact-requests/contact-request-retry-policy.service";
import { ContactRequestSourcePolicyService } from "../src/modules/contact-requests/contact-request-source-policy.service";
import { EventsService } from "../src/modules/events/events.service";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";

const LIVE_STATUS = "LIVE" as any;
const SPEAKER_ROLE = "SPEAKER" as any;
const ATTENDEE_ROLE = "ATTENDEE" as any;

describe("EventsService", () => {
  it("blocks event joins from unverified accounts", async () => {
    const service = new EventsService(
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => {
          throw new ForbiddenException(
            "Verify your email or complete mobile OTP before joining Dotly event networking.",
          );
        },
      } as any,
    );

    await assert.rejects(
      service.join("user-id", "event-id", {
        personaId: "persona-id",
        role: EventParticipantRole.Attendee,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Verify your email or complete mobile OTP before joining Dotly event networking.",
        );
        return true;
      },
    );
  });

  it("prevents duplicate joins for the same event", async () => {
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
            status: LIVE_STATUS,
            createdByUserId: "organizer-user",
            createdAt: new Date("2099-03-01T10:00:00.000Z"),
            updatedAt: new Date("2099-03-01T10:00:00.000Z"),
          }),
        },
        eventParticipant: {
          create: async () => {
            const error = new Error("duplicate");
            (error as any).code = "P2002";
            throw error;
          },
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.join("user-id", "event-id", {
        personaId: "persona-id",
        role: EventParticipantRole.Attendee,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictException);
        assert.equal(error.message, "You have already joined this event");
        return true;
      },
    );
  });

  it("rejects joining events outside the active window", async () => {
    const service = new EventsService(
      {
        event: {
          findUnique: async () => ({
            id: "event-id",
            name: "Dotly Summit",
            slug: "dotly-summit",
            description: null,
            startsAt: new Date(Date.now() + 60_000),
            endsAt: new Date(Date.now() + 120_000),
            location: "Chennai",
            status: LIVE_STATUS,
            createdByUserId: "organizer-user",
            createdAt: new Date("2099-03-01T10:00:00.000Z"),
            updatedAt: new Date("2099-03-01T10:00:00.000Z"),
          }),
        },
        eventParticipant: {
          create: async () => {
            throw new Error("eventParticipant.create should not be called");
          },
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.join("user-id", "event-id", {
        personaId: "persona-id",
        role: EventParticipantRole.Attendee,
      }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(error.message, "Event join is not active");
        return true;
      },
    );
  });

  it("rejects self-assigned privileged event roles on join", async () => {
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
            status: LIVE_STATUS,
            createdByUserId: "organizer-user",
            createdAt: new Date("2099-03-01T10:00:00.000Z"),
            updatedAt: new Date("2099-03-01T10:00:00.000Z"),
          }),
        },
        eventParticipant: {
          create: async () => {
            throw new Error("eventParticipant.create should not be called");
          },
        },
      } as any,
      {
        findOwnedPersonaIdentity: async () => ({ id: "persona-id" }),
      } as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.join("user-id", "event-id", {
        personaId: "persona-id",
        role: EventParticipantRole.Organizer,
      }),
      (error: unknown) => {
        assert.equal(
          error instanceof Error ? error.message : String(error),
          "Only attendee role can be self-assigned when joining an event",
        );
        return true;
      },
    );
  });

  it("returns only discoverable, unblocked participants during the event window", async () => {
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
            status: LIVE_STATUS,
            createdByUserId: "organizer-user",
            createdAt: new Date("2099-03-01T10:00:00.000Z"),
            updatedAt: new Date("2099-03-01T10:00:00.000Z"),
          }),
        },
        eventParticipant: {
          findFirst: async (args: any) => {
            if (args.where.userId === "viewer-user") {
              return { id: "viewer-participant" };
            }

            return null;
          },
          findMany: async () => [
            {
              id: "visible-participant",
              eventId: "event-id",
              userId: "visible-user",
              personaId: "visible-persona",
              role: SPEAKER_ROLE,
              discoveryEnabled: true,
              joinedAt: new Date("2099-03-20T10:30:00.000Z"),
              persona: {
                id: "visible-persona",
                username: "visible",
                publicUrl: "dotly.id/visible",
                fullName: "Visible User",
                jobTitle: "Engineer",
                companyName: "Dotly",
                tagline: "Here to connect",
                profilePhotoUrl: null,
              },
            },
            {
              id: "blocked-participant",
              eventId: "event-id",
              userId: "blocked-user",
              personaId: "blocked-persona",
              role: ATTENDEE_ROLE,
              discoveryEnabled: true,
              joinedAt: new Date("2099-03-20T10:45:00.000Z"),
              persona: {
                id: "blocked-persona",
                username: "blocked",
                publicUrl: "dotly.id/blocked",
                fullName: "Blocked User",
                jobTitle: "Designer",
                companyName: "Dotly",
                tagline: "Should not appear",
                profilePhotoUrl: null,
              },
            },
          ],
        },
        block: {
          findMany: async () => [
            {
              blockerUserId: "viewer-user",
              blockedUserId: "blocked-user",
            },
          ],
        },
      } as any,
      {} as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    const result = await service.findVisibleParticipants(
      "viewer-user",
      "event-id",
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.persona.id, "visible-persona");
    assert.equal(result[0]?.role, EventParticipantRole.Speaker);
    assert.equal((result[0] as any).discoveryEnabled, undefined);
  });

  it("rejects participant listing for users outside the event", async () => {
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
            status: LIVE_STATUS,
            createdByUserId: "organizer-user",
            createdAt: new Date("2099-03-01T10:00:00.000Z"),
            updatedAt: new Date("2099-03-01T10:00:00.000Z"),
          }),
        },
        eventParticipant: {
          findFirst: async () => null,
        },
      } as any,
      {} as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.findVisibleParticipants("viewer-user", "event-id"),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.equal(
          error.message,
          "Enable discovery to view participants in this event",
        );
        return true;
      },
    );
  });

  it("rejects blank event names after trimming", async () => {
    const service = new EventsService(
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("user-id", {
        name: "   ",
        slug: "dotly-summit",
        description: null,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 120_000).toISOString(),
        location: "Chennai",
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Event name cannot be empty");
        return true;
      },
    );
  });

  it("rejects blank event slugs after trimming", async () => {
    const service = new EventsService(
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("user-id", {
        name: "Dotly Summit",
        slug: "   ",
        description: null,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 120_000).toISOString(),
        location: "Chennai",
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Event slug cannot be empty");
        return true;
      },
    );
  });

  it("rejects blank event locations after trimming", async () => {
    const service = new EventsService(
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.create("user-id", {
        name: "Dotly Summit",
        slug: "dotly-summit",
        description: null,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 120_000).toISOString(),
        location: "   ",
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Event location cannot be empty");
        return true;
      },
    );
  });
});

describe("ContactRequestsService event source", () => {
  it("validates event membership and source tagging for event requests", async () => {
    let createPayload: any = null;

    const prismaService = {
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
        create: async (payload: any) => {
          createPayload = payload;
          return {
            id: "request-id",
            status: "PENDING",
            createdAt: new Date("2099-03-20T12:00:00.000Z"),
            toPersona: {
              id: "target-persona",
              username: "target",
              fullName: "Target User",
            },
          };
        },
      },
    } as any;
    prismaService.persona.findFirst = prismaService.persona.findUnique;

    const service = new ContactRequestsService(
      prismaService,
      new ContactRequestCreateService(
        prismaService,
        new ContactRequestRecipientPolicyService(
          prismaService,
          {
            findOwnedPersonaIdentity: async () => ({ id: "from-persona" }),
          } as any,
          {
            assertNoInteractionBlock: async () => undefined,
          } as any,
        ),
        new ContactRequestRetryPolicyService(prismaService),
        new ContactRequestSourcePolicyService({
          validateEventRequestAccess: async (
            actorUserId: string,
            eventId: string,
            actorPersonaId: string,
            targetPersonaId: string,
          ) => {
            assert.equal(actorUserId, "sender-user");
            assert.equal(eventId, "event-id");
            assert.equal(actorPersonaId, "from-persona");
            assert.equal(targetPersonaId, "target-persona");
          },
        } as any),
        {
          reserveAndCreate: async (
            _userId: string,
            callback: (tx: any) => Promise<any>,
          ) =>
            callback({
              contactRequest: {
                create: async (payload: any) => {
                  createPayload = payload;
                  return {
                    id: "request-id",
                    status: "PENDING",
                    createdAt: new Date("2099-03-20T12:00:00.000Z"),
                    toPersona: {
                      id: "target-persona",
                      username: "target",
                      fullName: "Target User",
                    },
                  };
                },
              },
            }),
        } as any,
        {
          createSafe: async () => undefined,
        } as any,
        {
          trackRequestSent: async () => undefined,
        } as any,
        {
          assertUserIsVerified: async () => undefined,
        } as any,
      ) as any,
      new ContactRequestRespondService(
        prismaService,
        {
          assertNoInteractionBlock: async () => undefined,
        } as any,
        {
          createApprovedRelationship: async () => ({ id: "relationship-id" }),
        } as any,
        {
          createInitialMemory: async () => ({ id: "memory-id" }),
        } as any,
        {
          createSafe: async () => undefined,
        } as any,
        {
          trackRequestApproved: async () => undefined,
          trackContactCreated: async () => undefined,
        } as any,
      ) as any,
    );

    await service.create("sender-user", {
      fromPersonaId: "from-persona",
      toPersonaId: "target-persona",
      sourceType: ContactRequestSourceType.Event,
      sourceId: "event-id",
    });

    assert.equal(createPayload.data.sourceType, "EVENT");
    assert.equal(createPayload.data.sourceId, "event-id");
  });
});
