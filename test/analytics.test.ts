import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ForbiddenException, NotFoundException } from "@nestjs/common";

import {
  AnalyticsEventType as PrismaAnalyticsEventType,
  ContactRelationshipState,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "../src/generated/prisma/client";

import { AnalyticsService } from "../src/modules/analytics/analytics.service";
import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { ContactRequestCreateService } from "../src/modules/contact-requests/contact-request-create.service";
import { ContactRequestRecipientPolicyService } from "../src/modules/contact-requests/contact-request-recipient-policy.service";
import { ContactRequestRespondService } from "../src/modules/contact-requests/contact-request-respond.service";
import { ContactRequestRetryPolicyService } from "../src/modules/contact-requests/contact-request-retry-policy.service";
import { ContactRequestSourcePolicyService } from "../src/modules/contact-requests/contact-request-source-policy.service";
import { ContactRequestsService } from "../src/modules/contact-requests/contact-requests.service";
import { ProfilesService } from "../src/modules/profiles/profiles.service";
import { QrService } from "../src/modules/qr/qr.service";

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
          count: async ({
            where,
          }: {
            where: { eventType: PrismaAnalyticsEventType };
          }) => {
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

  it("returns total connections and this month's connections", async () => {
    const capturedWhere: Array<Record<string, unknown>> = [];

    const service = new AnalyticsService(
      {
        contactRelationship: {
          count: async ({ where }: { where: Record<string, unknown> }) => {
            capturedWhere.push(where);

            return capturedWhere.length === 1 ? 8 : 3;
          },
        },
      } as any,
      { warn: () => undefined } as any,
    );

    const result = await service.getMyAnalytics("user-id");

    assert.deepEqual(result, {
      totalConnections: 8,
      connectionsThisMonth: 3,
    });
    assert.equal(capturedWhere.length, 2);
    assert.deepEqual(capturedWhere[0], {
      ownerUserId: "user-id",
      state: ContactRelationshipState.APPROVED,
    });
    assert.equal(capturedWhere[1].ownerUserId, "user-id");
    assert.equal(capturedWhere[1].state, ContactRelationshipState.APPROVED);
    assert.deepEqual(Object.keys(capturedWhere[1]).sort(), [
      "connectedAt",
      "ownerUserId",
      "state",
    ]);

    const connectedAt = capturedWhere[1].connectedAt as {
      gte: Date;
      lt: Date;
    };

    assert.equal(connectedAt.gte.getUTCDate(), 1);
    assert.equal(connectedAt.gte.getUTCHours(), 0);
    assert.equal(connectedAt.gte.getUTCMinutes(), 0);
    assert.equal(connectedAt.gte.getUTCSeconds(), 0);
    assert.equal(connectedAt.gte.getUTCMilliseconds(), 0);
    assert.equal(connectedAt.lt.getUTCDate(), 1);
    assert.equal(connectedAt.lt.getUTCHours(), 0);
    assert.ok(connectedAt.lt.getTime() > connectedAt.gte.getTime());
  });
});

describe("ProfilesService analytics hook", () => {
  it("prefers identity handles for canonical public urls while preserving persona username aliases", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findMany: async ({ where }: any) => {
            if (where.identity?.is?.handle === "acme") {
              return [
                {
                  id: "persona-default",
                  userId: "user-default",
                  username: "alice",
                  publicUrl: "",
                  identity: { handle: "acme" },
                  fullName: "Alice Default",
                  jobTitle: "Founder",
                  companyName: "Dotly",
                  tagline: "Connect fast",
                  websiteUrl: "https://dotly.one",
                  isVerified: true,
                  profilePhotoUrl: null,
                  accessMode: "OPEN",
                  sharingMode: "CONTROLLED",
                  smartCardConfig: null,
                  emailVerified: false,
                  phoneVerified: false,
                  businessVerified: false,
                  publicPhone: null,
                  publicWhatsappNumber: null,
                  publicEmail: null,
                  qRAccessTokens: [],
                },
              ];
            }

            return [];
          },
          findFirst: async ({ where }: any) => {
            if (where.username === "alice-ops") {
              return {
                id: "persona-alias",
                userId: "user-alias",
                username: "alice-ops",
                publicUrl: "",
                identity: { handle: "acme" },
                fullName: "Alice Ops",
                jobTitle: "Operations",
                companyName: "Dotly",
                tagline: "Alias profile",
                websiteUrl: "https://dotly.one",
                isVerified: false,
                profilePhotoUrl: null,
                accessMode: "OPEN",
                sharingMode: "CONTROLLED",
                smartCardConfig: null,
                emailVerified: false,
                phoneVerified: false,
                businessVerified: false,
                publicPhone: null,
                publicWhatsappNumber: null,
                publicEmail: null,
                qRAccessTokens: [],
              };
            }

            return null;
          },
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
    );

    const canonicalProfile = await service.getPublicProfile("acme");
    const aliasProfile = await service.getPublicProfile("alice-ops");

    assert.equal(canonicalProfile.username, "alice");
    assert.equal(canonicalProfile.publicUrl, "https://dotly.id/acme");
    assert.equal(aliasProfile.username, "alice-ops");
    assert.equal(aliasProfile.publicUrl, "https://dotly.id/acme");
  });

  it("tracks a profile view when a public profile is loaded", async () => {
    const tracked: unknown[] = [];

    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            websiteUrl: "https://dotly.one",
            isVerified: true,
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "request_access",
              allowWhatsapp: true,
            },
            publicPhone: null,
            publicWhatsappNumber: "+15551234567",
            publicEmail: null,
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
      publicUrl: "https://dotly.id/alice",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      websiteUrl: "https://dotly.one",
      isVerified: true,
      profilePhotoUrl: null,
      sharingMode: "smart_card",
      instantConnectUrl: null,
      trust: {
        isVerified: false,
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
          vcard: null,
        },
      },
    });

    assert.deepEqual(tracked[0], {
      personaId: "persona-id",
      viewerUserId: null,
      idempotencyKey: "request-key",
    });
  });

  it("returns only safe smart card config fields on public profiles", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            websiteUrl: "https://dotly.one",
            isVerified: false,
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: true,
              internalPersonaId: "persona-id",
              nested: {
                secret: true,
              },
            },
            publicPhone: "+15551234567",
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
    );

    const result = await service.getPublicProfile("alice");

    assert.equal(result.instantConnectUrl, null);
    assert.deepEqual(result.trust, {
      isVerified: false,
      isStrongVerified: false,
      isBusinessVerified: false,
    });

    assert.deepEqual(result.smartCard, {
      primaryAction: "contact_me",
      actionState: {
        requestAccessEnabled: true,
        instantConnectEnabled: false,
        contactMeEnabled: true,
      },
      actionLinks: {
        call: "tel:+15551234567",
        whatsapp: null,
        email: null,
        vcard: null,
      },
    });
  });

  it("fails closed for controlled profiles with legacy smart card data", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "CONTROLLED",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: true,
              allowWhatsapp: false,
              allowEmail: true,
              allowVcard: true,
            },
            publicPhone: "+15551234567",
            publicWhatsappNumber: null,
            publicEmail: "alice@example.com",
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
    );

    const result = await service.getPublicProfile("alice");

    assert.equal(result.smartCard, null);
    assert.deepEqual(result.trust, {
      isVerified: false,
      isStrongVerified: false,
      isBusinessVerified: false,
    });
  });

  it("does not expose stored public values when the matching actions are disabled", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: false,
            },
            publicPhone: "+15551234567",
            publicWhatsappNumber: "+15557654321",
            publicEmail: "alice@example.com",
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
    );

    const result = await service.getPublicProfile("alice");

    assert.deepEqual(result.trust, {
      isVerified: false,
      isStrongVerified: false,
      isBusinessVerified: false,
    });
    assert.deepEqual(result.smartCard, {
      primaryAction: "contact_me",
      actionState: {
        requestAccessEnabled: true,
        instantConnectEnabled: false,
        contactMeEnabled: false,
      },
      actionLinks: {
        call: null,
        whatsapp: null,
        email: null,
        vcard: null,
      },
    });
  });

  it("rejects request targets when smart card mode does not allow request access", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            fullName: "Alice Demo",
            accessMode: "OPEN",
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "instant_connect",
              allowCall: true,
            },
          }),
        },
        qRAccessToken: {
          findFirst: async () => ({ id: "profile-qr-1" }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.getRequestTarget("viewer-user", "alice"),
      ForbiddenException,
    );
  });

  it("blocks authenticated viewers from loading public profiles when a block exists", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            userId: "target-user",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            sharingMode: "CONTROLLED",
            smartCardConfig: null,
            emailVerified: false,
            phoneVerified: false,
            businessVerified: false,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => {
          throw new ForbiddenException("User has blocked you");
        },
      } as any,
    );

    await assert.rejects(
      service.getPublicProfile("alice", { viewerUserId: "viewer-user" }),
      ForbiddenException,
    );
  });

  it("blocks authenticated viewers from downloading public vcards when a block exists", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            userId: "target-user",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
            },
            emailVerified: false,
            phoneVerified: false,
            businessVerified: false,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => {
          throw new ForbiddenException("User has blocked you");
        },
      } as any,
    );

    await assert.rejects(
      service.getPublicVcard("alice", "viewer-user"),
      ForbiddenException,
    );
  });

  it("degrades request targets to request access when instant connect has no active profile QR", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            fullName: "Alice Demo",
            accessMode: "OPEN",
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "instant_connect",
              allowCall: true,
            },
          }),
        },
        qRAccessToken: {
          findFirst: async () => null,
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      undefined as any,
      {
        assertNoInteractionBlock: async () => undefined,
      } as any,
    );

    const result = await service.getRequestTarget("viewer-user", "alice");

    assert.deepEqual(result, {
      username: "alice",
      fullName: "Alice Demo",
      accessMode: "open",
    });
  });

  it("returns an instant connect url when a public profile QR is active", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "instant_connect",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: false,
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
        qRAccessToken: {
          findFirst: async () => ({ code: "profile-qr-1" }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
      {
        get: (key: string, fallback?: string) =>
          key === "qr.baseUrl" ? "https://dotly.id/q" : fallback,
      } as any,
    );

    const result = await service.getPublicProfile("alice");

    assert.equal(result.instantConnectUrl, "https://dotly.id/q/profile-qr-1");
    assert.deepEqual(result.trust, {
      isVerified: false,
      isStrongVerified: false,
      isBusinessVerified: false,
    });
  });

  it("caches safe public profile payloads without skipping per-viewer block checks", async () => {
    let personaReads = 0;
    const tracked: Array<Record<string, unknown>> = [];
    const blockChecks: Array<{ viewerUserId: string; targetUserId: string }> =
      [];

    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => {
            personaReads += 1;

            return {
              id: "persona-id",
              userId: "target-user",
              username: "alice",
              publicUrl: "https://dotly.id/alice",
              fullName: "Alice Demo",
              jobTitle: "Founder",
              companyName: "Dotly",
              tagline: "Connect fast",
              profilePhotoUrl: null,
              accessMode: "OPEN",
              sharingMode: "SMART_CARD",
              smartCardConfig: {
                primaryAction: "instant_connect",
                allowCall: false,
                allowWhatsapp: false,
                allowEmail: false,
                allowVcard: false,
              },
              emailVerified: false,
              phoneVerified: false,
              businessVerified: false,
              publicPhone: null,
              publicWhatsappNumber: null,
              publicEmail: null,
              qRAccessTokens: [{ code: "profile-qr-1", id: "profile-qr-1" }],
            };
          },
        },
      } as any,
      {
        trackProfileView: async (payload: Record<string, unknown>) => {
          tracked.push(payload);
          return true;
        },
      } as any,
      {
        get: (key: string, fallback?: string) =>
          key === "qr.baseUrl" ? "https://dotly.id/q" : fallback,
      } as any,
      {
        assertNoInteractionBlock: async (
          viewerUserId: string,
          targetUserId: string,
        ) => {
          blockChecks.push({ viewerUserId, targetUserId });
        },
      } as any,
    );

    const firstResult = await service.getPublicProfile("alice", {
      viewerUserId: "viewer-1",
      idempotencyKey: "request-1",
    });
    const secondResult = await service.getPublicProfile("alice", {
      viewerUserId: "viewer-2",
      idempotencyKey: "request-2",
    });

    assert.equal(personaReads, 1);
    assert.equal(blockChecks.length, 2);
    assert.deepEqual(blockChecks, [
      {
        viewerUserId: "viewer-1",
        targetUserId: "target-user",
      },
      {
        viewerUserId: "viewer-2",
        targetUserId: "target-user",
      },
    ]);
    assert.equal(tracked.length, 2);
    assert.equal(
      firstResult.instantConnectUrl,
      "https://dotly.id/q/profile-qr-1",
    );
    assert.deepEqual(secondResult, firstResult);
  });

  it("builds a public vcard with only safe public fields", async () => {
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
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: true,
              allowWhatsapp: true,
              allowEmail: true,
              allowVcard: true,
            },
            publicPhone: "+1 (555) 123-4567",
            publicWhatsappNumber: "+1 (555) 123-4567",
            publicEmail: "alice@example.com",
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.equal(result.filename, "alice.vcf");
    assert.match(result.content, /BEGIN:VCARD/);
    assert.match(result.content, /FN:Alice Demo/);
    assert.match(result.content, /TITLE:Founder/);
    assert.match(result.content, /ORG:Dotly/);
    assert.match(result.content, /EMAIL:alice@example.com/);
    assert.match(result.content, /TEL:\+1 \(555\) 123-4567/);
    assert.match(result.content, /URL:https:\/\/dotly.id\/alice/);
    assert.match(result.content, /NOTE:Connect fast/);
    assert.doesNotMatch(result.content, /persona-id/);
  });

  it("returns 404 when a public vcard is disabled", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "request_access",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: false,
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    await assert.rejects(service.getPublicVcard("alice"), NotFoundException);
  });

  it("returns 404 for controlled profiles even when legacy vcard config remains", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "CONTROLLED",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: true,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
            },
            publicPhone: "+15551234567",
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    await assert.rejects(service.getPublicVcard("alice"), NotFoundException);
  });

  it("omits malformed public action values from the generated vcard", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: true,
              allowWhatsapp: false,
              allowEmail: true,
              allowVcard: true,
            },
            publicPhone: "invalid-phone",
            publicWhatsappNumber: null,
            publicEmail: "alice@example.com",
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.doesNotMatch(result.content, /TEL:/);
    assert.match(result.content, /EMAIL:alice@example.com/);
  });

  it("omits stored public values from the generated vcard when they are disabled", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
            },
            publicPhone: "+1 (555) 123-4567",
            publicWhatsappNumber: "+1 (555) 765-4321",
            publicEmail: "alice@example.com",
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.doesNotMatch(result.content, /TEL:/);
    assert.doesNotMatch(result.content, /EMAIL:/);
    assert.doesNotMatch(result.content, /15557654321/);
  });

  it("never leaks whatsapp values into the generated vcard", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: true,
              allowEmail: false,
              allowVcard: true,
            },
            publicPhone: null,
            publicWhatsappNumber: "+1 (555) 123-4567",
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.doesNotMatch(result.content, /WA\.ME/i);
    assert.doesNotMatch(result.content, /15551234567/);
    assert.doesNotMatch(result.content, /TEL:/);
  });

  it("sanitizes the downloaded vcard filename", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: 'Alice ../" Demo',
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.equal(result.filename, "alice-demo.vcf");
  });

  it("serializes single-token names without duplicating the family name", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Cher",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.match(result.content, /FN:Cher/);
    assert.match(result.content, /N:;Cher;;;/);
    assert.doesNotMatch(result.content, /N:Cher;Cher;;;/);
  });

  it("folds long vcard lines for standards-compliant output", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline:
              "This is a deliberately long public note that should be folded into multiple physical lines for strict vCard importers without changing the visible content.",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    const result = await service.getPublicVcard("alice");

    assert.match(
      result.content,
      /NOTE:This is a deliberately long public note/,
    );
    assert.match(result.content, /\r\n /);
  });

  it("returns 404 when the smart card config is malformed", async () => {
    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "SMART_CARD",
            smartCardConfig: {
              primaryAction: "contact_me",
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: "yes",
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
          }),
        },
      } as any,
      {
        trackProfileView: async () => true,
      } as any,
    );

    await assert.rejects(service.getPublicVcard("alice"), NotFoundException);
  });

  it("does not block public profile loading when analytics is slow", async () => {
    let resolved = false;

    const service = new ProfilesService(
      {
        persona: {
          findFirst: async () => ({
            id: "persona-id",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "OPEN",
            verifiedOnly: false,
            sharingMode: "CONTROLLED",
            smartCardConfig: null,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
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

    const result = await service.getPublicProfile("alice");
    resolved = true;

    assert.equal(resolved, true);
    assert.equal(result.smartCard, null);
    assert.deepEqual(result.trust, {
      isVerified: false,
      isStrongVerified: false,
      isBusinessVerified: false,
    });
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
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        expireRelationshipIfNeeded: async () => undefined,
      } as any,
      {
        createInitialMemory: async () => undefined,
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      {
        trackQrScan: async (payload: unknown) => {
          tracked.push(payload);
          return true;
        },
      } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await service.resolveQr("qr-code", {
      scannerUserId: "viewer-user",
      idempotencyKey: "scan-key",
    });

    assert.deepEqual(tracked[0], {
      personaId: "persona-id",
      scannerUserId: "viewer-user",
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
      {
        assertNoInteractionBlockInTransaction: async () => undefined,
      } as any,
      {
        expireRelationshipIfNeeded: async () => undefined,
      } as any,
      {
        createInitialMemory: async () => undefined,
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      { trackQrScan: async () => true } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    const result = await service.resolveQr("qr-code", {
      scannerUserId: "viewer-user",
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

  it("blocks QR resolution when the scanner is blocked by the persona owner", async () => {
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
                    endsAt: null,
                    maxUses: null,
                    usedCount: 0,
                    status: "active",
                  };
                }

                return {
                  code: "qr-code",
                  type: "quick_connect",
                  persona: {
                    id: "persona-id",
                    userId: "target-user",
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
      {
        assertNoInteractionBlockInTransaction: async () => {
          throw new ForbiddenException("User has blocked you");
        },
      } as any,
      {
        expireRelationshipIfNeeded: async () => undefined,
      } as any,
      {
        createInitialMemory: async () => undefined,
      } as any,
      {
        createSafe: async () => undefined,
      } as any,
      { trackQrScan: async () => true } as any,
      {
        assertUserIsVerified: async () => undefined,
      } as any,
    );

    await assert.rejects(
      service.resolveQr("qr-code", {
        scannerUserId: "viewer-user",
        idempotencyKey: "scan-key",
      }),
      ForbiddenException,
    );
  });
});

describe("ContactRequestsService analytics hooks", () => {
  it("tracks request_sent during request creation", async () => {
    const tracked: Array<{ eventType: string; payload: unknown }> = [];

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
        updateInteractionMetadata: async () => null,
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
