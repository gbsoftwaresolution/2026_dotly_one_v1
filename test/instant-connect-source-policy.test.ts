import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { ContactRequestSourceType } from "../src/common/enums/contact-request-source-type.enum";
import { InstantConnectSourcePolicyService } from "../src/modules/relationships/instant-connect-source-policy.service";

describe("InstantConnectSourcePolicyService", () => {
  it("rejects QR provenance on the direct instant-connect endpoints", async () => {
    const service = new InstantConnectSourcePolicyService({} as any);

    await assert.rejects(
      service.assertSourceAccess(
        "actor-user",
        "actor-persona",
        "target-persona",
        ContactRequestSourceType.Qr,
      ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "QR provenance requires scanning a QR code",
        );
        return true;
      },
    );
  });

  it("rejects event ids when the source is not event-backed", async () => {
    const service = new InstantConnectSourcePolicyService({} as any);

    await assert.rejects(
      service.assertSourceAccess(
        "actor-user",
        "actor-persona",
        "target-persona",
        ContactRequestSourceType.Profile,
        "event-id",
      ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(
          error.message,
          "eventId is only allowed for event instant connect",
        );
        return true;
      },
    );
  });

  it("requires an event id for event-backed instant connect", async () => {
    const service = new InstantConnectSourcePolicyService({} as any);

    await assert.rejects(
      service.assertSourceAccess(
        "actor-user",
        "actor-persona",
        "target-persona",
        ContactRequestSourceType.Event,
      ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.message, "Event source requires an event id");
        return true;
      },
    );
  });

  it("delegates event-backed provenance checks to EventsService", async () => {
    let validateEventRequestAccessArgs: Array<string> | null = null;

    const service = new InstantConnectSourcePolicyService({
      validateEventRequestAccess: async (...args: string[]) => {
        validateEventRequestAccessArgs = args;
      },
    } as any);

    await service.assertSourceAccess(
      "actor-user",
      "actor-persona",
      "target-persona",
      ContactRequestSourceType.Event,
      "event-id",
    );

    assert.deepEqual(validateEventRequestAccessArgs, [
      "actor-user",
      "event-id",
      "actor-persona",
      "target-persona",
    ]);
  });
});