import { createHash, randomBytes } from "crypto";

const CARD_PUBLIC_ID_BYTES = 16; // 128-bit entropy

export function makeCardPublicId(bytes: number = CARD_PUBLIC_ID_BYTES): string {
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new Error("bytes must be an integer >= 16 (128-bit entropy)");
  }

  // Node supports base64url output without padding.
  return randomBytes(bytes).toString("base64url");
}

export function hashCardToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export type GrantLike = {
  expiresAt: Date;
  revokedAt: Date | null;
};

export function isGrantActive(grant: GrantLike, now: Date = new Date()): boolean {
  if (grant.revokedAt) return false;
  return grant.expiresAt.getTime() > now.getTime();
}
