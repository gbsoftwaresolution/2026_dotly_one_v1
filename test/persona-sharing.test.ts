import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { PersonaSharingMode as PrismaPersonaSharingMode } from "../src/generated/prisma/client";
import { BadRequestException, NotFoundException } from "@nestjs/common";

import { PersonaAccessMode } from "../src/common/enums/persona-access-mode.enum";
import { PersonaSharingMode } from "../src/common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../src/common/enums/persona-smart-card-primary-action.enum";
import { PersonaType } from "../src/common/enums/persona-type.enum";
import {
  buildCallLink,
  buildPublicSmartCardActions,
  buildSmartCardActionState,
  buildWhatsappLink,
} from "../src/modules/personas/persona-sharing";
import { PersonasService } from "../src/modules/personas/personas.service";

describe("PersonasService sharing mode", () => {
  it("blocks reserved brand usernames from availability checks", async () => {
    const service = new PersonasService({
      persona: {
        findFirst: async () => null,
      },
    } as never);

    const result = await service.checkUsernameAvailability(
      "user-1",
      "kfc_uae",
    );

    assert.equal(result.available, false);
    assert.equal(result.code, "reserved_brand");
    assert.equal(result.requiresClaim, true);
  });

  it("builds action-ready public smart card links only for enabled safe actions", () => {
    assert.deepEqual(
      buildPublicSmartCardActions({
        username: "alice",
        sharingMode: PrismaPersonaSharingMode.SMART_CARD,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
          allowCall: true,
          allowWhatsapp: true,
          allowEmail: true,
          allowVcard: true,
        },
        publicPhone: "+1 (555) 123-4567",
        publicWhatsappNumber: "+1 (555) 999-0000",
        publicEmail: "Alice@Example.com",
      }),
      {
        actions: {
          call: true,
          whatsapp: true,
          email: true,
          vcard: true,
        },
        actionLinks: {
          call: "tel:+15551234567",
          whatsapp: "https://wa.me/15559990000",
          email: "mailto:alice@example.com",
          vcard: "/v1/public/personas/alice/vcard",
        },
      },
    );
  });

  it("fails closed with null direct-action links for malformed legacy values", () => {
    const persona = {
      smartCardConfig: {
        primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
        allowCall: true,
        allowWhatsapp: true,
        allowEmail: false,
        allowVcard: false,
      },
      publicPhone: "not-a-phone",
      publicWhatsappNumber: "still-not-a-phone",
      publicEmail: null,
    };

    assert.equal(buildCallLink(persona), null);
    assert.equal(buildWhatsappLink(persona), null);
    assert.deepEqual(
      buildPublicSmartCardActions({
        username: "alice",
        sharingMode: PrismaPersonaSharingMode.SMART_CARD,
        ...persona,
      }),
      {
        actions: {
          call: false,
          whatsapp: false,
          email: false,
          vcard: false,
        },
        actionLinks: {
          call: null,
          whatsapp: null,
          email: null,
          vcard: null,
        },
      },
    );
  });

  it("never exposes vcard actions outside smart card mode", () => {
    assert.deepEqual(
      buildPublicSmartCardActions({
        username: "alice",
        sharingMode: PrismaPersonaSharingMode.CONTROLLED,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
          allowCall: true,
          allowWhatsapp: true,
          allowEmail: true,
          allowVcard: true,
        },
        publicPhone: "+1 (555) 123-4567",
        publicWhatsappNumber: "+1 (555) 999-0000",
        publicEmail: "Alice@Example.com",
      }),
      {
        actions: {
          call: false,
          whatsapp: false,
          email: false,
          vcard: false,
        },
        actionLinks: {
          call: null,
          whatsapp: null,
          email: null,
          vcard: null,
        },
      },
    );
  });

  it("reports contact_me as unavailable on public cards without vcard", () => {
    assert.deepEqual(
      buildSmartCardActionState(
        {
          sharingMode: "SMART_CARD" as const,
          accessMode: "REQUEST" as const,
          hasActiveProfileQr: false,
        },
        {
          primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
          allowCall: true,
          allowWhatsapp: true,
          allowEmail: true,
          allowVcard: false,
        },
      ),
      {
        requestAccessEnabled: true,
        instantConnectEnabled: false,
        contactMeEnabled: false,
      },
    );
  });

  it("applies safe system defaults when a persona is created", async () => {
    let persistedConfig: any = null;
    let createdProfileQrCount = 0;
    let activeProfileQrId: string | null = null;

    const service = new PersonasService({
      persona: {
        create: async () => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice-demo",
          publicUrl: "dotly.id/alice-demo",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          emailVerified: true,
          phoneVerified: false,
          businessVerified: false,
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:00:00.000Z"),
        }),
        findUnique: async () => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice-demo",
          publicUrl: "dotly.id/alice-demo",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          emailVerified: true,
          phoneVerified: false,
          businessVerified: false,
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:00:00.000Z"),
        }),
        update: async (args: any) => {
          persistedConfig = args.data.smartCardConfig;

          return {
            id: "persona-1",
            type: "PERSONAL",
            username: "alice",
            publicUrl: "dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "REQUEST",
            verifiedOnly: false,
            emailVerified: true,
            phoneVerified: false,
            businessVerified: false,
            sharingMode: args.data.sharingMode,
            smartCardConfig: args.data.smartCardConfig,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            updatedAt: new Date("2026-03-22T10:05:00.000Z"),
          };
        },
      },
      qRAccessToken: {
        findFirst: async () =>
          activeProfileQrId
            ? {
                id: activeProfileQrId,
              }
            : null,
        findUnique: async () => null,
        create: async () => {
          createdProfileQrCount += 1;
          activeProfileQrId = `profile-qr-${createdProfileQrCount}`;

          return {
            id: activeProfileQrId,
          };
        },
      },
    } as any);

    const result = await service.create("user-1", {
      type: PersonaType.Personal,
      username: "alice-demo",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      accessMode: PersonaAccessMode.Request,
    });

    assert.equal(result.sharingMode, "controlled");
    assert.equal(result.sharingConfigSource, "system_default");
    assert.equal(result.smartCardConfig, null);
    assert.equal(persistedConfig, null);
    assert.equal(result.sharingCapabilities?.hasActiveProfileQr, true);
    assert.equal(
      result.sharingCapabilities?.primaryActions.instantConnect,
      true,
    );
    assert.equal(createdProfileQrCount, 1);
  });

  it("auto-provisions a profile QR when a trusted public persona is loaded", async () => {
    let createdProfileQrCount = 0;
    let activeProfileQrId: string | null = null;

    const service = new PersonasService({
      persona: {
        findFirst: async () => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          emailVerified: true,
          phoneVerified: false,
          businessVerified: false,
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
      qRAccessToken: {
        findFirst: async () =>
          activeProfileQrId
            ? {
                id: activeProfileQrId,
              }
            : null,
        findUnique: async () => null,
        create: async () => {
          createdProfileQrCount += 1;
          activeProfileQrId = `profile-qr-${createdProfileQrCount}`;

          return {
            id: activeProfileQrId,
          };
        },
      },
    } as any);

    const result = await service.findOneById("user-1", "persona-1");

    assert.equal(result.sharingCapabilities?.hasActiveProfileQr, true);
    assert.equal(
      result.sharingCapabilities?.primaryActions.instantConnect,
      true,
    );
    assert.equal(createdProfileQrCount, 1);
  });

  it("auto-provisions profile QR capability in persona listings for trusted public personas", async () => {
    let createdProfileQrCount = 0;

    const service = new PersonasService({
      persona: {
        findMany: async () => [
          {
            id: "persona-1",
            type: "PERSONAL",
            username: "alice",
            publicUrl: "dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "REQUEST",
            verifiedOnly: false,
            emailVerified: true,
            phoneVerified: false,
            businessVerified: false,
            sharingMode: "CONTROLLED",
            smartCardConfig: null,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: null,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            updatedAt: new Date("2026-03-22T10:05:00.000Z"),
          },
        ],
      },
      qRAccessToken: {
        findMany: async () => [],
        create: async () => {
          createdProfileQrCount += 1;

          return {
            id: `profile-qr-${createdProfileQrCount}`,
          };
        },
        findUnique: async () => null,
      },
    } as any);

    const result = await service.findAllByUser("user-1");

    assert.equal(result.length, 1);
    assert.equal(result[0].sharingCapabilities?.hasActiveProfileQr, true);
    assert.equal(
      result[0].sharingCapabilities?.primaryActions.instantConnect,
      true,
    );
    assert.equal(createdProfileQrCount, 1);
  });

  it("upgrades defaults to smart_card when public info is meaningful", async () => {
    const service = new PersonasService({
      qRAccessToken: {
        findFirst: async () => null,
      },
    } as any);

    const defaults = await service.buildSmartDefaultsForPersona({
      id: "persona-1",
      type: "PROFESSIONAL",
      accessMode: "REQUEST",
      fullName: "Alice Demo",
      publicPhone: null,
      publicWhatsappNumber: null,
      publicEmail: "alice@example.com",
    } as any);

    assert.equal(defaults.sharingMode, "SMART_CARD");
    assert.deepEqual(defaults.smartCardConfig, {
      primaryAction: "contact_me",
      allowCall: false,
      allowWhatsapp: false,
      allowEmail: true,
      allowVcard: true,
    });
  });

  it("falls back closed for private personas without a valid smart card default", async () => {
    const service = new PersonasService({
      qRAccessToken: {
        findFirst: async () => null,
      },
    } as any);

    const defaults = await service.buildSmartDefaultsForPersona({
      id: "persona-1",
      type: "PERSONAL",
      accessMode: "PRIVATE",
      fullName: "Alice Demo",
      publicPhone: null,
      publicWhatsappNumber: null,
      publicEmail: null,
    } as any);

    assert.equal(defaults.sharingMode, "CONTROLLED");
    assert.equal(defaults.smartCardConfig, null);
  });

  it("does not recompute over user-custom sharing defaults unless forced", async () => {
    let updateCalled = false;

    const existingPersona = {
      id: "persona-1",
      type: "PROFESSIONAL",
      username: "alice",
      publicUrl: "dotly.id/alice",
      fullName: "Alice Demo",
      jobTitle: "Founder",
      companyName: "Dotly",
      tagline: "Connect fast",
      profilePhotoUrl: null,
      accessMode: "REQUEST",
      verifiedOnly: false,
      sharingMode: "SMART_CARD",
      smartCardConfig: {
        primaryAction: "contact_me",
        allowCall: true,
        allowWhatsapp: false,
        allowEmail: false,
        allowVcard: false,
        _meta: {
          source: "user_custom",
        },
      },
      publicPhone: "+15551234567",
      publicWhatsappNumber: null,
      publicEmail: null,
      createdAt: new Date("2026-03-22T10:00:00.000Z"),
      updatedAt: new Date("2026-03-22T10:05:00.000Z"),
    };

    const service = new PersonasService({
      persona: {
        findFirst: async () => existingPersona,
        update: async () => {
          updateCalled = true;
          return existingPersona;
        },
      },
      qRAccessToken: {
        findFirst: async () => ({ id: "profile-qr-1" }),
      },
    } as any);

    const result = await service.recomputePersonaDefaults(
      "user-1",
      "persona-1",
    );

    assert.equal(updateCalled, false);
    assert.equal(result.sharingConfigSource, "user_custom");
    assert.deepEqual(result.smartCardConfig, {
      primaryAction: "contact_me",
      allowCall: true,
      allowWhatsapp: false,
      allowEmail: false,
      allowVcard: false,
    });
  });

  it("recomputes system-managed sharing defaults when access mode changes", async () => {
    const service = new PersonasService({
      persona: {
        findFirst: async () => ({
          id: "persona-1",
          type: "PROFESSIONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          sharingMode: "SMART_CARD",
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: true,
            allowVcard: true,
            _meta: {
              source: "system_default",
            },
          },
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: "alice@example.com",
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
        update: async (args: any) => ({
          id: "persona-1",
          type: "PROFESSIONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: args.data.accessMode,
          verifiedOnly: false,
          sharingMode: args.data.sharingMode,
          smartCardConfig: args.data.smartCardConfig,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: "alice@example.com",
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:10:00.000Z"),
        }),
      },
      qRAccessToken: {
        findFirst: async () => null,
      },
    } as any);

    const result = await service.update("user-1", "persona-1", {
      accessMode: PersonaAccessMode.Private,
    });

    assert.equal(result.accessMode, "private");
    assert.equal(result.sharingMode, "controlled");
    assert.equal(result.sharingConfigSource, "system_default");
    assert.equal(result.smartCardConfig, null);
  });

  it("rejects access mode changes that would invalidate user-custom smart card settings", async () => {
    let updateCalled = false;

    const service = new PersonasService({
      persona: {
        findFirst: async () => ({
          id: "persona-1",
          type: "PROFESSIONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          sharingMode: "SMART_CARD",
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
            _meta: {
              source: "user_custom",
            },
          },
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
        update: async () => {
          updateCalled = true;
          return null;
        },
      },
      qRAccessToken: {
        findFirst: async () => null,
      },
    } as any);

    await assert.rejects(
      service.update("user-1", "persona-1", {
        accessMode: PersonaAccessMode.Private,
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.primaryAction request_access is not supported for private personas",
        );

        return true;
      },
    );

    assert.equal(updateCalled, false);
  });

  it("normalizes legacy system-managed sharing when a persona is read", async () => {
    let updateCalled = false;

    const service = new PersonasService({
      persona: {
        findFirst: async () => ({
          id: "persona-1",
          type: "PROFESSIONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          sharingMode: "SMART_CARD",
          smartCardConfig: {
            legacy: true,
          },
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: "alice@example.com",
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
        update: async (args: any) => {
          updateCalled = true;

          return {
            id: "persona-1",
            type: "PROFESSIONAL",
            username: "alice",
            publicUrl: "dotly.id/alice",
            fullName: "Alice Demo",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Connect fast",
            profilePhotoUrl: null,
            accessMode: "REQUEST",
            verifiedOnly: false,
            sharingMode: args.data.sharingMode,
            smartCardConfig: args.data.smartCardConfig,
            publicPhone: null,
            publicWhatsappNumber: null,
            publicEmail: "alice@example.com",
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            updatedAt: new Date("2026-03-22T10:10:00.000Z"),
          };
        },
      },
      qRAccessToken: {
        findFirst: async () => null,
      },
    } as any);

    const result = await service.findOneById("user-1", "persona-1");

    assert.equal(updateCalled, false);
    assert.equal(result.sharingMode, "smart_card");
    assert.equal(result.sharingConfigSource, "system_default");
    assert.deepEqual(result.smartCardConfig, {
      primaryAction: "contact_me",
      allowCall: false,
      allowWhatsapp: false,
      allowEmail: true,
      allowVcard: true,
    });
  });

  it("updates smart card config and defaults missing flags to false", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
        update: async (args: any) => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          sharingMode: args.data.sharingMode,
          smartCardConfig: args.data.smartCardConfig,
          publicPhone: args.data.publicPhone,
          publicWhatsappNumber: args.data.publicWhatsappNumber,
          publicEmail: args.data.publicEmail,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
      qRAccessToken: {
        findFirst: async () => ({ id: "profile-qr-1" }),
      },
    } as any);

    const result = await service.updateSharingMode("user-1", "persona-1", {
      sharingMode: PersonaSharingMode.SmartCard,
      publicWhatsappNumber: " +1 555 123 4567 ",
      smartCardConfig: {
        primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
        allowCall: false,
        allowWhatsapp: true,
        allowEmail: false,
        allowVcard: false,
      },
    });

    assert.equal(result.sharingMode, "smart_card");
    assert.equal(result.sharingConfigSource, "user_custom");
    assert.deepEqual(result.smartCardConfig, {
      primaryAction: "instant_connect",
      allowCall: false,
      allowWhatsapp: true,
      allowEmail: false,
      allowVcard: false,
    });
    assert.equal(result.publicWhatsappNumber, "+1 555 123 4567");
  });

  it("returns 404 when the persona does not exist", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => null,
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.Controlled,
      }),
      NotFoundException,
    );
  });

  it("returns the same 404 when the caller does not own the persona", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-2",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.Controlled,
      }),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.equal(error.message, "Persona not found");
        return true;
      },
    );
  });

  it("rejects smart card mode without config", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.SmartCard,
      }),
      BadRequestException,
    );
  });

  it("rejects instant connect when no active profile QR exists", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          emailVerified: false,
          phoneVerified: false,
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
      qRAccessToken: {
        findFirst: async () => null,
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.SmartCard,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
          allowCall: false,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: false,
        },
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.primaryAction instant_connect requires an active profile QR",
        );

        return true;
      },
    );
  });

  it("auto-provisions a profile QR when enabling instant connect for a trusted persona", async () => {
    let createdProfileQrCount = 0;
    let activeProfileQrId: string | null = null;

    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          emailVerified: true,
          phoneVerified: false,
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
        update: async (args: any) => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          emailVerified: true,
          phoneVerified: false,
          businessVerified: false,
          sharingMode: args.data.sharingMode,
          smartCardConfig: args.data.smartCardConfig,
          publicPhone: args.data.publicPhone,
          publicWhatsappNumber: args.data.publicWhatsappNumber,
          publicEmail: args.data.publicEmail,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
      qRAccessToken: {
        findFirst: async () =>
          activeProfileQrId
            ? {
                id: activeProfileQrId,
              }
            : null,
        findUnique: async () => null,
        create: async () => {
          createdProfileQrCount += 1;
          activeProfileQrId = `profile-qr-${createdProfileQrCount}`;

          return {
            id: activeProfileQrId,
          };
        },
      },
    } as any);

    const result = await service.updateSharingMode("user-1", "persona-1", {
      sharingMode: PersonaSharingMode.SmartCard,
      smartCardConfig: {
        primaryAction: PersonaSmartCardPrimaryAction.InstantConnect,
        allowCall: false,
        allowWhatsapp: false,
        allowEmail: false,
        allowVcard: false,
      },
    });

    assert.equal(result.sharingMode, "smart_card");
    assert.equal(result.smartCardConfig?.primaryAction, "instant_connect");
    assert.equal(result.sharingCapabilities?.hasActiveProfileQr, true);
    assert.equal(createdProfileQrCount, 1);
  });

  it("reuses smart card mode when only the config is updated", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "SMART_CARD",
          smartCardConfig: {
            primaryAction: "request_access",
            allowCall: false,
            allowWhatsapp: true,
            allowEmail: false,
            allowVcard: false,
          },
          publicPhone: null,
          publicWhatsappNumber: "+15550001111",
          publicEmail: null,
        }),
        update: async (args: any) => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          sharingMode: args.data.sharingMode,
          smartCardConfig: args.data.smartCardConfig,
          publicPhone: args.data.publicPhone,
          publicWhatsappNumber: args.data.publicWhatsappNumber,
          publicEmail: args.data.publicEmail,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
    } as any);

    const result = await service.updateSharingMode("user-1", "persona-1", {
      publicPhone: "+1 (555) 222-3333",
      publicEmail: " ALICE@EXAMPLE.COM ",
      smartCardConfig: {
        primaryAction: PersonaSmartCardPrimaryAction.RequestAccess,
        allowCall: true,
        allowWhatsapp: false,
        allowEmail: true,
        allowVcard: false,
      },
    });

    assert.equal(result.sharingMode, "smart_card");
    assert.deepEqual(result.smartCardConfig, {
      primaryAction: "request_access",
      allowCall: true,
      allowWhatsapp: false,
      allowEmail: true,
      allowVcard: false,
    });
    assert.equal(result.publicPhone, "+1 (555) 222-3333");
    assert.equal(result.publicEmail, "alice@example.com");
  });

  it("sanitizes stored smart card config before returning it", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "SMART_CARD",
          smartCardConfig: {
            primaryAction: "contact_me",
            allowCall: true,
            internalFlag: true,
          },
          publicPhone: "+15551234567",
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
        update: async (args: any) => ({
          id: "persona-1",
          type: "PERSONAL",
          username: "alice",
          publicUrl: "dotly.id/alice",
          fullName: "Alice Demo",
          jobTitle: "Founder",
          companyName: "Dotly",
          tagline: "Connect fast",
          profilePhotoUrl: null,
          accessMode: "REQUEST",
          verifiedOnly: false,
          sharingMode: args.data.sharingMode,
          smartCardConfig: args.data.smartCardConfig,
          publicPhone: args.data.publicPhone,
          publicWhatsappNumber: args.data.publicWhatsappNumber,
          publicEmail: args.data.publicEmail,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
    } as any);

    const result = await service.updateSharingMode("user-1", "persona-1", {
      publicPhone: "+15551234567",
      smartCardConfig: {
        primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
        allowCall: true,
        allowWhatsapp: false,
        allowEmail: false,
        allowVcard: false,
      },
    });

    assert.deepEqual(result.smartCardConfig, {
      primaryAction: "contact_me",
      allowCall: true,
      allowWhatsapp: false,
      allowEmail: false,
      allowVcard: false,
    });
  });

  it("rejects request_access for private personas", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "PRIVATE",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.SmartCard,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.RequestAccess,
          allowCall: false,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: false,
        },
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.primaryAction request_access is not supported for private personas",
        );

        return true;
      },
    );
  });

  it("rejects contact_me when all direct actions are disabled", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.SmartCard,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
          allowCall: false,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: false,
        },
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.primaryAction contact_me requires at least one direct action to be enabled",
        );

        return true;
      },
    );
  });

  it("rejects call when publicPhone is missing", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.SmartCard,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.RequestAccess,
          allowCall: true,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: false,
        },
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.allowCall requires a valid publicPhone value",
        );

        return true;
      },
    );
  });

  it("rejects contact_me when only vcard is enabled", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "CONTROLLED",
          smartCardConfig: null,
          publicPhone: null,
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        sharingMode: PersonaSharingMode.SmartCard,
        smartCardConfig: {
          primaryAction: PersonaSmartCardPrimaryAction.ContactMe,
          allowCall: false,
          allowWhatsapp: false,
          allowEmail: false,
          allowVcard: true,
        },
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.primaryAction contact_me requires at least one direct action to be enabled",
        );

        return true;
      },
    );
  });

  it("rejects contact_me when a required public value is removed", async () => {
    const service = new PersonasService({
      persona: {
        findUnique: async () => ({
          userId: "user-1",
          accessMode: "REQUEST",
          sharingMode: "SMART_CARD",
          smartCardConfig: {
            primaryAction: "contact_me",
            allowCall: true,
            allowWhatsapp: false,
            allowEmail: false,
            allowVcard: false,
          },
          publicPhone: "+15551234567",
          publicWhatsappNumber: null,
          publicEmail: null,
        }),
      },
    } as any);

    await assert.rejects(
      service.updateSharingMode("user-1", "persona-1", {
        publicPhone: "   ",
      }),
      (error: unknown) => {
        assert(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "smartCardConfig.allowCall requires a valid publicPhone value",
        );

        return true;
      },
    );
  });
});
