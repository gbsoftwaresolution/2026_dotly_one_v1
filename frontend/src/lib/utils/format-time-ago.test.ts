import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatDaysAgo,
  formatTimeAgo,
  formatTimeAgoShort,
  isRecentTimestamp,
} from "./format-time-ago";

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an empty-state label when no timestamp exists", () => {
    expect(formatTimeAgo(null)).toBe("No interactions yet");
  });

  it("formats very recent timestamps as just now", () => {
    expect(formatTimeAgo("2026-03-22T11:59:40.000Z")).toBe("just now");
  });

  it("formats hours, days, and weeks in a human-readable form", () => {
    expect(formatTimeAgo("2026-03-22T10:00:00.000Z")).toBe("2 hours ago");
    expect(formatTimeAgo("2026-03-19T12:00:00.000Z")).toBe("3 days ago");
    expect(formatTimeAgo("2026-03-08T12:00:00.000Z")).toBe("2 weeks ago");
  });

  it("returns compact labels for list surfaces", () => {
    expect(formatTimeAgoShort("2026-03-22T10:00:00.000Z")).toBe("2h");
    expect(formatTimeAgoShort("2026-03-20T12:00:00.000Z")).toBe("2d");
  });

  it("formats relationship age text in long and compact variants", () => {
    expect(formatDaysAgo(0)).toBe("today");
    expect(formatDaysAgo(3)).toBe("3 days ago");
    expect(formatDaysAgo(10, "compact")).toBe("1w");
    expect(formatDaysAgo(65, "compact")).toBe("2mo");
  });

  it("treats invalid and future timestamps as missing data", () => {
    expect(formatTimeAgo("not-a-date")).toBe("No interactions yet");
    expect(formatTimeAgo("2026-03-22T12:05:00.000Z")).toBe(
      "No interactions yet",
    );
    expect(formatTimeAgoShort("not-a-date")).toBe(null);
    expect(formatTimeAgoShort("2026-03-22T12:05:00.000Z")).toBe(null);
  });

  it("flags only recent timestamps within the configured window", () => {
    expect(isRecentTimestamp("2026-03-16T12:00:00.000Z")).toBe(true);
    expect(isRecentTimestamp("2026-03-01T12:00:00.000Z")).toBe(false);
    expect(isRecentTimestamp("2026-03-22T12:05:00.000Z")).toBe(false);
  });
});