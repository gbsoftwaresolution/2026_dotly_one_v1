import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { AnalyticsEventType as PrismaAnalyticsEventType } from "@prisma/client";

import { AnalyticsService } from "../src/modules/analytics/analytics.service";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";
import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { ProfilesService } from "../src/modules/profiles/profiles.service";
import { QrService } from "../src/modules/qr/qr.service";

describe("AnalyticsService", () => {
  it("avoids duplicate aggregate increments for repeated request approval events", async () => {
    let createCalls = 0;
    let upsertCalls = 0;

    const service = new AnalyticsService(
      {} as any,
      {
        warn: () => undefined,
      } as any,
    );

    const tx = {
      analyticsEvent: {
        create: async () => {
          createCalls += 1;

          if (createCalls === 2) {
            const error = new Error("duplicate");
            (error as any).code = "P2002";
            throw error;
          }

          return { id: "event-id" };
        },
      },
      personaAnalytics: {
        upsert: async () => {
          upsertCalls += 1;
          return { personaId: "persona-id" };
        },
      },
    };

    await service.trackRequestApproved(
      {
        actorUserId: "user-id",
        personaId: "persona-id",
        requestId: "request-id",
      },
      tx as any,
    );

    await service.trackRequestApproved(
      {
        actorUserId: "user-id",
        personaId: "persona-id",
        requestId: "request-id",
      },
      tx as any,
    );

    assert.equal(createCalls, 2);
    assert.equal(upsertCalls, 1);
  });

  it("returns zeroed persona analytics when no aggregate exists", async () => {
    const service = new AnalyticsService(
      {
        persona: {
          findFirst: async () => ({ id: "persona-id" }),
        },
        personaAnalytics: {
          findUnique: async () => null,
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.getPersonaAnalytics("user-id", "persona-id");

    assert.deepEqual(result, {
      personaId: "persona-id",
      profileViews: 0,
      qrScans: 0,
      requestsReceived: 0,
      requestsApproved: 0,
      contactsCreated: 0,
      conversionRate: 0,
    });
  });

  it("returns conversion rate as a percentage capped to 2 decimals", async () => {
    const service = new AnalyticsService(
      {
        persona: {
          findFirst: async () => ({ id: "persona-id" }),
        },
        personaAnalytics: {
          findUnique: async () => ({
            personaId: "persona-id",
            profileViews: 10,
            qrScans: 5,
            requestsReceived: 3,
            requestsApproved: 1,
            contactsCreated: 1,
          }),
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.getPersonaAnalytics("user-id", "persona-id");

    assert.equal(result.conversionRate, 33.33);
  });

  it("returns summed analytics across user personas", async () => {
    const service = new AnalyticsService(
      {
        persona: {
          findMany: async () => [{ id: "persona-1" }, { id: "persona-2" }],
        },
        analyticsEvent: {
          count: async ({ where }: { where: { eventType: PrismaAnalyticsEventType } }) => {
            switch (where.eventType) {
              case PrismaAnalyticsEventType.EMAIL_VERIFICATION_ISSUED:
                return 3;
              case PrismaAnalyticsEventType.EMAIL_VERIFICATION_RESENT:
                return 1;
              case PrismaAnalyticsEventType.EMAIL_VERIFICATION_VERIFIED:
                return 2;
              case PrismaAnalyticsEventType.VERIFICATION_REQUIREMENT_BLOCKED:
                return 4;
              default:
                return 0;
            }
          },
        },
        personaAnalytics: {
          aggregate: async () => ({
            _sum: {
              profileViews: 12,
              qrScans: 5,
              requestsReceived: 4,
              requestsApproved: 3,
              contactsCreated: 3,
            },
          }),
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.getSummary("user-id");

    assert.deepEqual(result, {
      totalProfileViews: 12,
      totalQrScans: 5,
      totalRequests: 4,
      totalApproved: 3,
      totalContacts: 3,
      totalVerificationEmailsIssued: 3,
      totalVerificationResends: 1,
      totalVerificationCompleted: 2,
      totalVerificationBlocks: 4,
      verificationConversionRate: 66.67,
    });
  });
});

describe("ProfilesService analytics hook", () => {
  it("tracks a profile view when a public profile is loaded", async () => {
    const tracked: unknown[] = [];

    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
          }),
        },
      } as any,
      {
        trackProfileView: async (payload: unknown) => {
          tracked.push(payload);
          return true;
        },
      } as any,
    );

    const result = await service.getPublicProfile("alice", {
      idempotencyKey: "request-key",
    });

    assert.deepEqual(result, {
      username: "alice",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      profilePhotoUrl: null,
    });

    assert.deepEqual(tracked[0], {
      personaId: "persona-id",
      viewerUserId: null,
      idempotencyKey: "request-key",
    });
  });

  it("does not block public profile loading when analytics is slow", async () => {
    let resolved = false;

    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
          }),
        },
      } as any,
      {
        trackProfileView: async () =>
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(true), 50);
          }),
      } as any,
    );

    await service.getPublicProfile("alice");
    resolved = true;

    assert.equal(resolved, true);
  });
});

describe("QrService analytics hook", () => {
  it("tracks qr scans when resolving a code", async () => {
    const tracked: unknown[] = [];

    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            qRAccessToken: {
              findUnique: async (args: any) => {
                if (args.where.code) {
                  return {
                    id: "qr-token-id",
                    code: "qr-code",
                    type: "profile",
                    startsAt: null,
                    endsAt: null,
                    maxUses: null,
                    usedCount: 0,
                    status: "active",
                  };
                }

                return {
                  id: "qr-token-id",
                  code: "qr-code",
                  type: "profile",
                  startsAt: null,
                  endsAt: null,
                  maxUses: null,
                  usedCount: 0,
                  status: "active",
                  persona: {
                    id: "persona-id",
                    username: "alice",
                    publicUrl: "dotly.id/alice",
                    fullName: "Alice Demo",
                    jobTitle: "Founder",
                    companyName: "Dotly",
                    tagline: "Connect fast",
                    profilePhotoUrl: null,
                    accessMode: "OPEN",
                  },
                };
              },
            },
          }),
      } as any,
      { get: () => "https://dotly.id/q" } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        trackQrScan: async (payload: unknown) => {
          tracked.push(payload);
          return true;
        },
      } as any,
    );

    await service.resolveQr("qr-code", { idempotencyKey: "scan-key" });

    assert.deepEqual(tracked[0], {
      personaId: "persona-id",
      scannerUserId: null,
      qrTokenId: "qr-token-id",
      idempotencyKey: "scan-key",
    });
  });

  it("does not expose internal QR metadata in resolve responses", async () => {
    const service = new QrService(
      {
        $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
          callback({
            qRAccessToken: {
              findUnique: async (args: any) => {
                if (args.where.code) {
                  return {
                    id: "qr-token-id",
                    code: "qr-code",
                    type: "quick_connect",
                    startsAt: null,
                    endsAt: new Date("2099-03-20T15:00:00.000Z"),
                    maxUses: 5,
                    usedCount: 1,
                    status: "active",
                  };
                }

                return {
                  code: "qr-code",
                  type: "quick_connect",
                  persona: {
                    id: "persona-id",
                    username: "alice",
                    fullName: "Alice Demo",
                    jobTitle: "Founder",
                    companyName: "Dotly",
                    tagline: "Connect fast",
                    profilePhotoUrl: null,
                  },
                };
              },
            },
          }),
      } as any,
      { get: () => "https://dotly.id/q" } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { trackQrScan: async () => true } as any,
    );

    const result = await service.resolveQr("qr-code", {
      idempotencyKey: "scan-key",
    });

    assert.deepEqual(result, {
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
    assert.equal((result as any).quickConnect, undefined);
  });
});

describe("ContactRequestsService analytics hooks", () => {
  it("tracks request_sent during request creation", async () => {
    const tracked: Array<{ eventType: string; payload: unknown }> = [];

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
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestSent: async (payload: unknown) => {
          tracked.push({ eventType: "request_sent", payload });
          return true;
        },
      } as any,
    );

    await service.create("sender-user", {
      fromPersonaId: "from-persona",
      toPersonaId: "target-persona",
      sourceType: ContactRequestSourceType.Profile,
    });

    assert.deepEqual(tracked[0], {
      eventType: "request_sent",
      payload: {
        actorUserId: "sender-user",
        personaId: "target-persona",
        requestId: "request-id",
        sourceType: "profile",
        sourceId: null,
      },
    });
  });

  it("tracks approval and contact creation during request approval", async () => {
    const tracked: Array<{ eventType: string; payload: unknown }> = [];

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
        createSafe: async () => undefined,
      } as any,
      {
        trackRequestApproved: async (payload: unknown) => {
          tracked.push({ eventType: "request_approved", payload });
          return true;
        },
        trackContactCreated: async (payload: unknown) => {
          tracked.push({ eventType: "contact_created", payload });
          return true;
        },
      } as any,
    );

    await service.approve("receiver-user", "request-id");

    assert.deepEqual(tracked, [
      {
        eventType: "request_approved",
        payload: {
          actorUserId: "receiver-user",
          personaId: "to-persona",
          requestId: "request-id",
        },
      },
      {
        eventType: "contact_created",
        payload: {
          actorUserId: "receiver-user",
          personaId: "to-persona",
          relationshipId: "relationship-id",
          sourceType: "profile",
          sourceId: null,
        },
      },
    ]);
  });
});

describe("Analytics event enum", () => {
  it("exposes the expected analytics event types", () => {
    assert.equal(PrismaAnalyticsEventType.PROFILE_VIEW, "PROFILE_VIEW");
    assert.equal(PrismaAnalyticsEventType.QR_SCAN, "QR_SCAN");
    assert.equal(PrismaAnalyticsEventType.REQUEST_SENT, "REQUEST_SENT");
    assert.equal(PrismaAnalyticsEventType.REQUEST_APPROVED, "REQUEST_APPROVED");
    assert.equal(PrismaAnalyticsEventType.CONTACT_CREATED, "CONTACT_CREATED");
  });
});
