import { DateTime } from "luxon";
import { LifeDocStatus } from "@prisma/client";

export function toUserDateIso(date: Date, timezone: string): string {
  const iso = DateTime.fromJSDate(date, { zone: "utc" })
    .setZone(timezone)
    .toISODate();
  if (!iso) throw new Error("Failed to format date");
  return iso;
}

export function parseIsoDateToUtcStart(isoDate: string, timezone: string): Date {
  // Treat incoming YYYY-MM-DD as a date in the user's timezone, stored as UTC instant.
  const dt = DateTime.fromISO(isoDate, { zone: timezone }).startOf("day");
  if (!dt.isValid) throw new Error("Invalid date");
  return dt.toUTC().toJSDate();
}

export function computeDaysUntilExpiry(
  nowUtc: Date,
  expiryDateUtc: Date,
  timezone: string,
): number {
  const today = DateTime.fromJSDate(nowUtc, { zone: "utc" }).setZone(timezone).startOf("day");
  const expiry = DateTime.fromJSDate(expiryDateUtc, { zone: "utc" }).setZone(timezone).startOf("day");
  return Math.trunc(expiry.diff(today, "days").days);
}

export function computeAutoStatus(
  nowUtc: Date,
  expiryDateUtc: Date | null,
  timezone: string,
): LifeDocStatus {
  if (!expiryDateUtc) return LifeDocStatus.ACTIVE;

  const daysUntil = computeDaysUntilExpiry(nowUtc, expiryDateUtc, timezone);
  if (daysUntil < 0) return LifeDocStatus.EXPIRED;
  if (daysUntil <= 90) return LifeDocStatus.EXPIRING_SOON;
  return LifeDocStatus.ACTIVE;
}
