import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { PersonaSharingMode } from "../src/common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../src/common/enums/persona-smart-card-primary-action.enum";
import {
  buildCallLink,
  buildPublicSmartCardActions,
  buildSmartCardActionState,
  buildWhatsappLink,
} from "../src/modules/personas/persona-sharing";
import { PersonasService } from "../src/modules/personas/personas.service";

describe("PersonasService sharing mode", () => {
  it("builds action-ready public smart card links only for enabled safe actions", () => {
    assert.deepEqual(
      buildPublicSmartCardActions({
        username: "alice",
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
    assert.deepEqual(buildPublicSmartCardActions({ username: "alice", ...persona }), {
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
    });
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

  it("returns 403 when the caller does not own the persona", async () => {
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
      ForbiddenException,
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