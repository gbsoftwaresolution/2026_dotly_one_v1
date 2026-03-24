export function buildRequestKey(
  prefix: string,
  ...parts: Array<string | null | undefined>
) {
  const normalizedParts = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return [prefix, ...normalizedParts, randomPart].join(":");
}
