export const FOLLOW_UP_PRESETS = ["TOMORROW", "NEXT_WEEK", "ONE_MONTH"] as const;

export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function resolveFollowUpPreset(preset: FollowUpPreset, now: Date): Date {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid follow-up preset reference time");
  }

  switch (preset) {
    case "TOMORROW":
      return new Date(now.getTime() + DAY_IN_MS);
    case "NEXT_WEEK":
      return new Date(now.getTime() + 7 * DAY_IN_MS);
    case "ONE_MONTH":
      return new Date(now.getTime() + 30 * DAY_IN_MS);
  }
}