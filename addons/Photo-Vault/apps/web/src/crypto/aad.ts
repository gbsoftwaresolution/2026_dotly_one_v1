export type VaultMediaVariant = "original" | "thumb";

export type VaultMediaAadFieldsV2 = {
  purpose: "vault-media";
  metaVersion: 2;
  userId: string;
  mediaId: string;
  variant: VaultMediaVariant;
};

const VAULT_MEDIA_AAD_PREFIX = "booster:vault-media" as const;

export function buildVaultMediaAadString(args: {
  v: 2;
  userId: string;
  mediaId: string;
  variant: VaultMediaVariant;
}): string {
  // IMPORTANT: Keep this deterministic and stable.
  // Do not use JSON.stringify (key ordering is not guaranteed across runtimes).
  return [
    VAULT_MEDIA_AAD_PREFIX,
    `v=${args.v}`,
    `userId=${args.userId}`,
    `mediaId=${args.mediaId}`,
    `variant=${args.variant}`,
  ].join("|");
}

export function buildVaultMediaAadBytes(args: {
  v: 2;
  userId: string;
  mediaId: string;
  variant: VaultMediaVariant;
}): Uint8Array {
  return new TextEncoder().encode(buildVaultMediaAadString(args));
}

function isVaultMediaVariant(value: unknown): value is VaultMediaVariant {
  return value === "original" || value === "thumb";
}

export function getVaultMediaAadFieldsV2FromEncMeta(
  encMeta: unknown,
): VaultMediaAadFieldsV2 | null {
  if (!encMeta || typeof encMeta !== "object") return null;
  const meta: any = encMeta as any;
  const aad: any = meta.aad;
  if (!aad || typeof aad !== "object") return null;

  if (aad.purpose !== "vault-media") return null;
  if (aad.metaVersion !== 2) return null;
  if (typeof aad.userId !== "string" || aad.userId.length === 0) return null;
  if (typeof aad.mediaId !== "string" || aad.mediaId.length === 0) return null;
  if (!isVaultMediaVariant(aad.variant)) return null;

  return {
    purpose: "vault-media",
    metaVersion: 2,
    userId: aad.userId,
    mediaId: aad.mediaId,
    variant: aad.variant,
  };
}

export function resolveVaultMediaAadBytesForV2Decrypt(args: {
  encMeta: unknown;
  userId?: string;
  mediaId: string;
  variant?: VaultMediaVariant;
}): Uint8Array {
  const fromMeta = getVaultMediaAadFieldsV2FromEncMeta(args.encMeta);

  if (fromMeta && fromMeta.mediaId !== args.mediaId) {
    throw new Error("AAD context mismatch: mediaId does not match encMeta.aad");
  }
  if (args.userId && fromMeta && fromMeta.userId !== args.userId) {
    throw new Error("AAD context mismatch: userId does not match encMeta.aad");
  }
  if (args.variant && fromMeta && fromMeta.variant !== args.variant) {
    throw new Error("AAD context mismatch: variant does not match encMeta.aad");
  }

  const userId = args.userId ?? fromMeta?.userId;
  const variant = args.variant ?? fromMeta?.variant;
  if (!userId || !variant) {
    throw new Error("Missing AAD context for v2 decrypt");
  }

  return buildVaultMediaAadBytes({
    v: 2,
    userId,
    mediaId: args.mediaId,
    variant,
  });
}
