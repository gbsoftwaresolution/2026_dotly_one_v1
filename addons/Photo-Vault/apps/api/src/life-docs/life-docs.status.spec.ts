import { LifeDocStatus } from "@prisma/client";
import {
  computeAutoStatus,
  computeDaysUntilExpiry,
  parseIsoDateToUtcStart,
} from "./life-docs.status";

describe("life-docs.status", () => {
  it("computes boundary statuses around 90-day window", () => {
    const tz = "Asia/Kolkata";
    const now = parseIsoDateToUtcStart("2026-02-11", tz);

    const expiry91 = parseIsoDateToUtcStart("2026-05-13", tz); // 91 days after 2026-02-11
    expect(computeDaysUntilExpiry(now, expiry91, tz)).toBe(91);
    expect(computeAutoStatus(now, expiry91, tz)).toBe(LifeDocStatus.ACTIVE);

    const expiry90 = parseIsoDateToUtcStart("2026-05-12", tz);
    expect(computeDaysUntilExpiry(now, expiry90, tz)).toBe(90);
    expect(computeAutoStatus(now, expiry90, tz)).toBe(LifeDocStatus.EXPIRING_SOON);

    const expiryToday = parseIsoDateToUtcStart("2026-02-11", tz);
    expect(computeDaysUntilExpiry(now, expiryToday, tz)).toBe(0);
    expect(computeAutoStatus(now, expiryToday, tz)).toBe(LifeDocStatus.EXPIRING_SOON);

    const expired = parseIsoDateToUtcStart("2026-02-10", tz);
    expect(computeDaysUntilExpiry(now, expired, tz)).toBe(-1);
    expect(computeAutoStatus(now, expired, tz)).toBe(LifeDocStatus.EXPIRED);
  });

  it("treats input ISO dates as user-local dates (timezone correctness)", () => {
    const tz = "America/Los_Angeles";
    const issue = parseIsoDateToUtcStart("2026-02-11", tz);

    // Stored as a UTC instant, but should represent start of day in user tz.
    // In LA, 2026-02-11T00:00:00-08:00 => 2026-02-11T08:00:00Z.
    expect(issue.toISOString().startsWith("2026-02-11T08:00:00")).toBe(true);
  });
});
