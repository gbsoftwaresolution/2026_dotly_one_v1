function redactAuthorizationHeader(value: string): string {
  return value.length <= 12
    ? "[REDACTED]"
    : `${value.slice(0, 6)}...[REDACTED]`;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(key, entry));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childKey, childValue),
      ]),
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalizedKey = key.trim().toLowerCase();

  if (normalizedKey === "authorization") {
    return redactAuthorizationHeader(value);
  }

  if (normalizedKey.includes("cookie") || normalizedKey.endsWith("token")) {
    return "[REDACTED]";
  }

  return value;
}

export function writeStructuredObservabilityError(
  message: string,
  metadata: Record<string, unknown>,
): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      context: "FrontendObservability",
      message,
      metadata: sanitizeValue("metadata", metadata),
    }),
  );
}
