const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp) || timestamp > Date.now()) {
    return null;
  }

  return timestamp;
}

export function formatTimeAgo(value: string | null | undefined): string {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return "No interactions yet";
  }

  const elapsed = Date.now() - timestamp;

  if (elapsed < MINUTE) {
    return "just now";
  }

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (elapsed < WEEK) {
    const days = Math.floor(elapsed / DAY);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  const weeks = Math.floor(elapsed / WEEK);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function formatTimeAgoShort(value: string | null | undefined): string | null {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return null;
  }

  const elapsed = Date.now() - timestamp;

  if (elapsed < MINUTE) {
    return "now";
  }

  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)}m`;
  }

  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)}h`;
  }

  if (elapsed < WEEK) {
    return `${Math.floor(elapsed / DAY)}d`;
  }

  return `${Math.floor(elapsed / WEEK)}w`;
}

export function isRecentTimestamp(
  value: string | null | undefined,
  maxAgeInDays = 7,
): boolean {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return false;
  }

  return Date.now() - timestamp <= maxAgeInDays * DAY;
}