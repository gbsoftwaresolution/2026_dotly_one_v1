import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  PersonaAccessMode as PrismaPersonaAccessMode,
  PersonaSharingMode as PrismaPersonaSharingMode,
} from "../src/generated/prisma/client";
import { NotFoundException } from "@nestjs/common";

import { PersonaSmartCardPrimaryAction } from "../src/common/enums/persona-smart-card-primary-action.enum";
import { PersonasService } from "../src/modules/personas/personas.service";

describe("PersonasService share mode", () => {
  it("builds a minimal fast share payload for instant rendering", async () => {
    const service = new PersonasService(
      {
        user: {
          findUnique: async () => ({ lastUsedPersonaId: null }),
          update: async () => ({ id: "user-1" }),
        },
        persona: {
          findFirst: async ({ where }: { where: { id?: string; userId: string } }) => {
            if (where.id !== "persona-1") {
              return null;
            }

            return {
              id: "persona-1",
              username: "alice",
              fullName: "Alice Demo",
              profilePhotoUrl: "https://cdn.dotly.one/alice.jpg",
              accessMode: PrismaPersonaAccessMode.OPEN,
              sharingMode: PrismaPersonaSharingMode.SMART_CARD,
              smartCardConfig: {
                primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
                allowCall: false,
                allowWhatsapp: false,
                allowEmail: false,
                allowVcard: true,
                source: "user_custom",
              },
              publicPhone: null,
              publicWhatsappNumber: null,
              publicEmail: null,
              createdAt: new Date("2026-03-23T10:00:00.000Z"),
              updatedAt: new Date("2026-03-23T11:00:00.000Z"),
            };
          },
        },
        qRAccessToken: {
          findMany: async () => [
            {
              code: "quick-share-1",
              maxUses: 5,
              usedCount: 1,
            },
          ],
        },
      } as any,
      {
        get: (key: string, fallback?: string) => {
          if (key === "mail.frontendVerificationUrlBase") {
            return "https://dotly.one/verify-email";
          }

          return fallback;
        },
      } as any,
    );

    const result = await service.getFastSharePayload("user-1", "persona-1");

    assert.deepEqual(result, {
      personaId: "persona-1",
      username: "alice",
      fullName: "Alice Demo",
      profilePhotoUrl: "https://cdn.dotly.one/alice.jpg",
      shareUrl: "https://dotly.one/q/quick-share-1",
      qrValue: "https://dotly.one/q/quick-share-1",
      primaryAction: "instant_connect",
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: true,
      },
      preferredShareType: "instant_connect",
      hasQuickConnect: true,
      quickConnectUrl: "https://dotly.one/q/quick-share-1",
    });
  });

  it("returns a safe empty fast-share response when the user has no personas", async () => {
    const service = new PersonasService(
      {
        user: {
          findUnique: async () => ({ lastUsedPersonaId: null }),
        },
        persona: {
          findFirst: async () => null,
        },
        qRAccessToken: {
          findMany: async () => [],
        },
      } as any,
    );

    const result = await service.getMyFastSharePayload("user-1");

    assert.deepEqual(result, {
      persona: null,
      share: null,
    });
  });

  it("caches the selected fast-share payload for repeated reads inside the ttl", async () => {
    let personaReads = 0;
    let tokenReads = 0;

    const service = new PersonasService(
      {
        user: {
          findUnique: async () => ({ lastUsedPersonaId: null }),
          update: async () => ({ id: "user-1" }),
        },
        persona: {
          findFirst: async ({ where }: { where: { id?: string; userId: string } }) => {
            personaReads += 1;

            if (where.id && where.id !== "persona-1") {
              return null;
            }

            return {
              id: "persona-1",
              username: "alice",
              fullName: "Alice Demo",
              profilePhotoUrl: null,
              accessMode: PrismaPersonaAccessMode.OPEN,
              sharingMode: PrismaPersonaSharingMode.SMART_CARD,
              smartCardConfig: {
                primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
                allowCall: false,
                allowWhatsapp: false,
                allowEmail: false,
                allowVcard: true,
                source: "user_custom",
              },
              publicPhone: null,
              publicWhatsappNumber: null,
              publicEmail: null,
              createdAt: new Date("2026-03-23T10:00:00.000Z"),
              updatedAt: new Date("2026-03-23T11:00:00.000Z"),
            };
          },
        },
        qRAccessToken: {
          findMany: async () => {
            tokenReads += 1;

            return [
              {
                code: "quick-share-1",
                maxUses: 5,
                usedCount: 1,
              },
            ];
          },
        },
      } as any,
    );

    const firstResult = await service.getMyFastSharePayload("user-1");
    const secondResult = await service.getMyFastSharePayload("user-1");

    assert.deepEqual(secondResult, firstResult);
    assert.equal(personaReads, 2);
    assert.equal(tokenReads, 1);
  });

  it("builds a canonical share payload with valid quick connect metadata", async () => {
    const service = new PersonasService(
      {
        user: {
          update: async () => ({ id: "user-1" }),
        },
        persona: {
          findFirst: async () => ({
            id: "persona-1",
            type: "PROFESSIONAL",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: PrismaPersonaAccessMode.OPEN,
            verifiedOnly: false,
            emailVerified: true,
            phoneVerified: false,
            businessVerified: false,
            sharingMode: PrismaPersonaSharingMode.SMART_CARD,
            smartCardConfig: {
              primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
              source: "user_custom",
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          }),
        },
        qRAccessToken: {
          findMany: async () => [
            {
              code: "quick-share-1",
              maxUses: 5,
              usedCount: 1,
            },
          ],
        },
      } as any,
      {
        get: (key: string, fallback?: string) => {
          if (key === "mail.frontendVerificationUrlBase") {
            return "https://dotly.one/verify-email";
          }

          return fallback;
        },
      } as any,
    );

    const result = await service.getPersonaShareMode("user-1", "persona-1");

    assert.deepEqual(result, {
      personaId: "persona-1",
      username: "alice",
      fullName: "Alice Demo",
      sharingMode: "smart_card",
      primaryAction: "instant_connect",
      shareUrl: "https://dotly.one/q/quick-share-1",
      qrValue: "https://dotly.one/q/quick-share-1",
      effectiveActions: {
        canCall: false,
        canWhatsapp: false,
        canEmail: false,
        canSaveContact: true,
      },
      preferredShareType: "instant_connect",
      hasQuickConnect: true,
      quickConnectUrl: "https://dotly.one/q/quick-share-1",
      trust: {
        isVerified: true,
        isStrongVerified: false,
        isBusinessVerified: false,
      },
    });
  });

  it("falls back to canonical profile sharing when no safe quick connect token exists", async () => {
    const service = new PersonasService(
      {
        user: {
          update: async () => ({ id: "user-1" }),
        },
        persona: {
          findFirst: async () => ({
            id: "persona-1",
            type: "PROFESSIONAL",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: PrismaPersonaAccessMode.OPEN,
            verifiedOnly: false,
            emailVerified: true,
            phoneVerified: true,
            businessVerified: false,
            sharingMode: PrismaPersonaSharingMode.SMART_CARD,
            smartCardConfig: {
              primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
              allowCall: false,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: true,
              source: "user_custom",
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          }),
        },
        qRAccessToken: {
          findMany: async () => [
            {
              code: "exhausted-quick-share",
              maxUses: 1,
              usedCount: 1,
            },
          ],
        },
      } as any,
    );

    const result = await service.getPersonaShareMode("user-1", "persona-1");

    assert.equal(result.preferredShareType, "smart_card");
    assert.equal(result.hasQuickConnect, false);
    assert.equal(result.quickConnectUrl, null);
    assert.equal(result.shareUrl, "https://dotly.one/u/alice");
    assert.equal(result.qrValue, "https://dotly.one/u/alice");
    assert.equal(result.primaryAction, "request_access");
    assert.deepEqual(result.effectiveActions, {
      canCall: false,
      canWhatsapp: false,
      canEmail: false,
      canSaveContact: false,
    });
    assert.equal(result.trust.isStrongVerified, true);
  });

  it("prefers the last used persona before primary and fallback ordering", async () => {
    const service = new PersonasService(
      {
        user: {
          findUnique: async () => ({ lastUsedPersonaId: "persona-2" }),
          update: async () => ({ id: "user-1" }),
        },
        persona: {
          findFirst: async ({ where }: { where: { id?: string; userId: string } }) => {
            if (where.id === "persona-2") {
              return {
                id: "persona-2",
                username: "alice-ops",
                fullName: "Alice Ops",
                profilePhotoUrl: null,
                accessMode: PrismaPersonaAccessMode.OPEN,
                sharingMode: PrismaPersonaSharingMode.CONTROLLED,
                smartCardConfig: null,
                publicPhone: null,
                publicWhatsappNumber: null,
                publicEmail: null,
                createdAt: new Date("2026-03-23T10:00:00.000Z"),
                updatedAt: new Date("2026-03-23T11:00:00.000Z"),
              };
            }

            return null;
          },
        },
        qRAccessToken: {
          findMany: async () => [],
        },
      } as any,
      {
        get: (key: string, fallback?: string) => {
          if (key === "mail.frontendVerificationUrlBase") {
            return "https://dotly.one/verify-email";
          }

          return fallback;
        },
      } as any,
    );

    const result = await service.getMyFastSharePayload("user-1");

    assert.deepEqual(result, {
      persona: {
        id: "persona-2",
        username: "alice-ops",
        fullName: "Alice Ops",
        profilePhotoUrl: null,
      },
      share: {
        shareUrl: "https://dotly.one/u/alice-ops",
        qrValue: "https://dotly.one/u/alice-ops",
        primaryAction: "request_access",
        effectiveActions: {
          canCall: false,
          canWhatsapp: false,
          canEmail: false,
          canSaveContact: false,
        },
        preferredShareType: "smart_card",
      },
    });
  });

  it("falls back to a controlled request-access share when smart-card config is invalid", async () => {
    const service = new PersonasService(
      {
        user: {
          update: async () => ({ id: "user-1" }),
        },
        persona: {
          findFirst: async () => ({
            id: "persona-1",
            type: "PROFESSIONAL",
            username: "alice",
            publicUrl: "https://dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: PrismaPersonaAccessMode.OPEN,
            verifiedOnly: false,
            emailVerified: true,
            phoneVerified: true,
            businessVerified: false,
            sharingMode: PrismaPersonaSharingMode.SMART_CARD,
            smartCardConfig: {
              primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
              allowCall: true,
              allowWhatsapp: false,
              allowEmail: false,
              allowVcard: false,
              source: "user_custom",
            },
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          }),
        },
        qRAccessToken: {
          findMany: async () => [],
        },
      } as any,
      {
        get: (key: string, fallback?: string) => {
          if (key === "mail.frontendVerificationUrlBase") {
            return "https://dotly.one/verify-email";
          }

          return fallback;
        },
      } as any,
    );

    const result = await service.getPersonaShareMode("user-1", "persona-1");

    assert.equal(result.sharingMode, "controlled");
    assert.equal(result.primaryAction, "request_access");
    assert.deepEqual(result.effectiveActions, {
      canCall: false,
      canWhatsapp: false,
      canEmail: false,
      canSaveContact: false,
    });
    assert.equal(result.shareUrl, "https://dotly.one/u/alice");
    assert.equal(result.qrValue, "https://dotly.one/u/alice");
  });

  it("keeps owner-only share reads scoped by user id", async () => {
    const service = new PersonasService(
      {
        persona: {
          findFirst: async () => null,
        },
        qRAccessToken: {
          findMany: async () => [],
        },
      } as any,
    );

    await assert.rejects(
      service.getPersonaShareMode("user-1", "persona-foreign"),
      NotFoundException,
    );
  });
});