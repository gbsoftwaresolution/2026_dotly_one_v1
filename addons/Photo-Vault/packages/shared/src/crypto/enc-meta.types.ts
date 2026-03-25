export type VaultMediaVariant = "original" | "thumb";

export type VaultMediaAadFieldsV2 = {
  purpose: "vault-media";
  metaVersion: 2;
  userId: string;
  mediaId: string;
  variant: VaultMediaVariant;
};

export type AesGcmEncMetaV1 = {
  /** Legacy metadata: no AAD binding. */
  v?: 1;
  alg?: "AES-256-GCM" | string;
  /** Base64 IV (preferred field). */
  ivB64: string;
  /** Some older clients used `iv` instead of `ivB64`. */
  iv?: string;
};

export type AesGcmEncMetaV2 = {
  /** v2 metadata: ciphertext is AAD-bound (userId + mediaId + variant). */
  v: 2;
  alg?: "AES-256-GCM" | string;
  ivB64: string;
  /** Optional human-readable fields so decryptors can recompute AAD. */
  aad?: VaultMediaAadFieldsV2;
};

export type ChunkedEncMetaV1 = {
  v?: 1;
  alg?: "AES-256-GCM-CHUNKED" | string;
  ivPrefixB64: string;
  /** Plaintext chunk size in bytes. */
  chunkSize: number;
  /** Original plaintext byte size (pre-encryption). */
  originalByteSize: number;
  /** AES-GCM tag bytes appended to every chunk. */
  tagBytes: number;
};

export type ChunkedEncMetaV2 = {
  v: 2;
  alg?: "AES-256-GCM-CHUNKED" | string;
  ivPrefixB64: string;
  chunkSize: number;
  originalByteSize: number;
  tagBytes: number;
  /** Optional human-readable fields so decryptors can recompute AAD. */
  aad?: VaultMediaAadFieldsV2;
};

export type VaultEncMeta =
  | AesGcmEncMetaV1
  | AesGcmEncMetaV2
  | ChunkedEncMetaV1
  | ChunkedEncMetaV2;
