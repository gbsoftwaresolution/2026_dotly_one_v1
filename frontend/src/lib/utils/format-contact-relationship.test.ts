import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatRelationshipAge,
  formatSourceLabel,
  getRecentActivityLabel,
  getRelationshipAgeDays,
} from "./format-contact-relationship";

describe("format-contact-relationship", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers the stored source label when present", () => {
    expect(formatSourceLabel("Coffee chat", "profile")).toBe("Coffee chat");
    expect(formatSourceLabel(null, "qr")).toBe("QR");
  });

  it("resolves relationship age from metadata or createdAt", () => {
    expect(getRelationshipAgeDays(14, "2026-03-01T12:00:00.000Z")).toBe(14);
    expect(
      getRelationshipAgeDays(undefined, "2026-03-20T12:00:00.000Z"),
    ).toBe(2);
    expect(formatRelationshipAge(undefined, "not-a-date")).toBe("today");
  });

  it("returns a subtle recent activity label only when the contact is recent", () => {
    expect(
      getRecentActivityLabel(true, "2026-03-21T12:00:00.000Z"),
    ).toBe("1d");
    expect(getRecentActivityLabel(true, null)).toBe("Active recently");
    expect(getRecentActivityLabel(false, "2026-03-21T12:00:00.000Z")).toBe(
      null,
    );
  });
});