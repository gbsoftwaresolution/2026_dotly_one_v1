import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { PersonaSharingMode } from "../src/common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../src/common/enums/persona-smart-card-primary-action.enum";
import { buildSmartCardActionState } from "../src/modules/personas/persona-sharing";
import { PersonasService } from "../src/modules/personas/personas.service";

describe("PersonasService sharing mode", () => {
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
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
    } as any);

    const result = await service.updateSharingMode("user-1", "persona-1", {
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
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
          updatedAt: new Date("2026-03-22T10:05:00.000Z"),
        }),
      },
    } as any);

    const result = await service.updateSharingMode("user-1", "persona-1", {
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
});