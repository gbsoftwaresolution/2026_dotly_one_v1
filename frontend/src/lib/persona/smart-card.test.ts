import { describe, expect, it } from "vitest";

import {
  normalizeSmartCardPrimaryAction,
  resolvePublicSmartCardPrimaryAction,
} from "./smart-card";

describe("smart-card primary action helpers", () => {
  it("normalizes invalid public primary actions to request access", () => {
    expect(normalizeSmartCardPrimaryAction("invalid_action")).toBe(
      "request_access",
    );
  });

  it("degrades instant connect to request access when no public QR target exists", () => {
    expect(
      resolvePublicSmartCardPrimaryAction("instant_connect", {
        instantConnectUrl: null,
      }),
    ).toBe("request_access");
  });

  it("keeps instant connect when a public QR target exists", () => {
    expect(
      resolvePublicSmartCardPrimaryAction("instant_connect", {
        instantConnectUrl: "https://dotly.id/q/profile-qr-1",
      }),
    ).toBe("instant_connect");
  });
});