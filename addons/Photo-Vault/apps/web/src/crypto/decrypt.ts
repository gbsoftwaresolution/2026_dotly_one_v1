/**
 * File decryption for viewing/downloading.
 * Retrieves wrapped key from IndexedDB, unwraps with master key, decrypts ciphertext.
 */

import { base64ToArrayBuffer, decryptData, unwrapKey } from "./webcrypto";
import {
  resolveVaultMediaAadBytesForV2Decrypt,
  type VaultMediaVariant,
} from "./aad";
import { getCachedMasterKey } from "./vaultKey";
import { getWrappedKey } from "./keyStore";
import {
  CHUNKED_ENC_ALGO_V1,
  CHUNKED_ENC_ALGO_V2,
  isChunkedEncMetaV1,
  isChunkedEncMetaV2,
  type ChunkedEncMetaV1,
  type ChunkedEncMetaV2,
  getChunkCount,
  getPlainChunkByteSize,
  getCipherChunkByteSize,
  getCipherChunkOffset,
} from "./encrypt";

export interface DecryptResult {
  originalBlob: Blob;
  mediaKey: CryptoKey;
}

async function getUnwrappedMediaKey(mediaId: string): Promise<CryptoKey> {
  const wrapped = await getWrappedKey(mediaId);
  if (!wrapped) {
    throw new Error(
      `No decryption key found for media ${mediaId}. The vault may not be unlocked on this device.`,
    );
  }
  const masterKey = getCachedMasterKey();
  return await unwrapKey(wrapped.wrappedKey, masterKey, wrapped.wrapIv);
}

function deriveChunkIv(
  encMeta: ChunkedEncMetaV1 | ChunkedEncMetaV2,
  chunkIndex: number,
): Uint8Array<ArrayBuffer> {
  const prefix = new Uint8Array(
    base64ToArrayBuffer(encMeta.ivPrefixB64) as ArrayBuffer,
  );
  if (prefix.byteLength !== 8) {
    throw new Error("Invalid ivPrefixB64 length");
  }
  const iv = new Uint8Array(12) as Uint8Array<ArrayBuffer>;
  iv.set(prefix, 0);
  new DataView(iv.buffer).setUint32(8, chunkIndex >>> 0, false);
  return iv;
}

function isAesGcmEncMetaV2(encMeta: unknown): encMeta is {
  v: 2;
  alg?: unknown;
  ivB64: string;
} {
  if (!encMeta || typeof encMeta !== "object") return false;
  const meta = encMeta as any;
  return meta.v === 2 && typeof meta.ivB64 === "string";
}

function buildAdditionalDataForV2(args: {
  encMeta: unknown;
  userId?: string;
  mediaId: string;
  variant?: VaultMediaVariant;
}): Uint8Array {
  return resolveVaultMediaAadBytesForV2Decrypt({
    encMeta: args.encMeta,
    userId: args.userId,
    mediaId: args.mediaId,
    variant: args.variant,
  });
}

/**
 * Decrypt ciphertext bytes to a Blob, using the locally-stored wrapped media key.
 * Supports both single-shot AES-GCM and the chunked AES-GCM scheme.
 */
export async function decryptCiphertextToBlob(args: {
  userId?: string;
  mediaId: string;
  ciphertext: ArrayBuffer;
  encAlgo?: string;
  encMeta?: unknown;
  /** AAD binding variant for v2 (required when encMeta.v===2). */
  variant?: VaultMediaVariant;
  mimeType: string;
}): Promise<Blob> {
  const getIvB64 = (encMeta: unknown): string => {
    if (!encMeta || typeof encMeta !== "object") return "";
    const meta = encMeta as { ivB64?: unknown; iv?: unknown };
    if (typeof meta.ivB64 === "string") return meta.ivB64;
    if (typeof meta.iv === "string") return meta.iv;
    return "";
  };

  // Chunked downloads/uploads
  if (
    args.encAlgo === CHUNKED_ENC_ALGO_V1 ||
    args.encAlgo === CHUNKED_ENC_ALGO_V2
  ) {
    const isV2 = args.encAlgo === CHUNKED_ENC_ALGO_V2;
    if (isV2) {
      if (!isChunkedEncMetaV2(args.encMeta)) {
        throw new Error("Missing/invalid chunked encryption metadata");
      }
    } else {
      if (!isChunkedEncMetaV1(args.encMeta)) {
        throw new Error("Missing/invalid chunked encryption metadata");
      }
    }

    const mediaKey = await getUnwrappedMediaKey(args.mediaId);
    const encMeta = args.encMeta;
    const chunkCount = getChunkCount(encMeta);

    const additionalData = isV2
      ? buildAdditionalDataForV2({
          encMeta: args.encMeta,
          userId: args.userId,
          mediaId: args.mediaId,
          variant: args.variant,
        })
      : undefined;

    const plaintextParts: BlobPart[] = [];
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const offset = getCipherChunkOffset(encMeta, chunkIndex);
      const cipherSize = getCipherChunkByteSize(encMeta, chunkIndex);
      const end = offset + cipherSize;

      const chunkCipher = args.ciphertext.slice(offset, end);
      const iv = deriveChunkIv(encMeta, chunkIndex);
      const chunkPlain = await decryptData(
        chunkCipher,
        mediaKey,
        iv.buffer,
        additionalData,
      );

      // For safety, trim to expected plain size (AES-GCM returns exact, but keep deterministic).
      const expectedPlainSize = getPlainChunkByteSize(encMeta, chunkIndex);
      const plainBytesView = new Uint8Array(chunkPlain);
      const plainBytes: Uint8Array<ArrayBuffer> = new Uint8Array(
        plainBytesView.byteLength,
      );
      plainBytes.set(plainBytesView);
      const trimmed: Uint8Array<ArrayBuffer> = plainBytes.slice(
        0,
        Math.max(0, expectedPlainSize),
      );
      plaintextParts.push(trimmed);
    }

    return new Blob(plaintextParts, { type: args.mimeType });
  }

  // Default: single-shot AES-GCM (uses ivB64)
  const ivB64 = getIvB64(args.encMeta);
  if (!ivB64) {
    // Best effort: if older exports omitted encMeta, we can't decrypt.
    throw new Error(
      "Missing encryption metadata (ivB64). Re-create the export with a newer version.",
    );
  }

  const additionalData = isAesGcmEncMetaV2(args.encMeta)
    ? (() => {
        return buildAdditionalDataForV2({
          encMeta: args.encMeta,
          userId: args.userId,
          mediaId: args.mediaId,
          variant: args.variant,
        });
      })()
    : undefined;

  const { originalBlob } = await decryptMedia(
    args.mediaId,
    args.ciphertext,
    ivB64,
    additionalData,
  );
  return new Blob([originalBlob], { type: args.mimeType });
}

/**
 * Decrypt a media item given its mediaId and ciphertext.
 * Assumes vault is unlocked and key is stored locally.
 * @param mediaId Media ID from server
 * @param ciphertext Encrypted data (ArrayBuffer)
 * @param ivB64 Base64 IV from encMeta
 * @returns DecryptResult with decrypted Blob and media CryptoKey
 */
export async function decryptMedia(
  mediaId: string,
  ciphertext: ArrayBuffer,
  ivB64: string,
  additionalData?: Uint8Array,
): Promise<DecryptResult> {
  // 1. Retrieve wrapped key from IndexedDB
  const wrapped = await getWrappedKey(mediaId);
  if (!wrapped) {
    throw new Error(
      `No decryption key found for media ${mediaId}. The vault may not be unlocked on this device.`,
    );
  }

  // 2. Unwrap media key with master key
  const masterKey = getCachedMasterKey();
  const mediaKey = await unwrapKey(
    wrapped.wrappedKey,
    masterKey,
    wrapped.wrapIv,
  );

  // 3. Decrypt ciphertext
  const iv = base64ToArrayBuffer(ivB64);
  const decrypted = await decryptData(ciphertext, mediaKey, iv, additionalData);

  // 4. Convert to Blob (mime type unknown here, caller should provide)
  const blob = new Blob([decrypted]);

  return {
    originalBlob: blob,
    mediaKey,
  };
}

/**
 * Decrypt media and create an object URL for preview (image/video).
 * Caller must revoke the URL when done.
 * @param mediaId Media ID
 * @param ciphertext Encrypted data
 * @param ivB64 Base64 IV
 * @param mimeType Original content type (e.g., 'image/jpeg')
 * @returns Object URL pointing to decrypted Blob
 */
export async function decryptToObjectUrl(
  mediaId: string,
  ciphertext: ArrayBuffer,
  ivB64: string,
  mimeType: string,
  additionalData?: Uint8Array,
): Promise<string> {
  const { originalBlob } = await decryptMedia(
    mediaId,
    ciphertext,
    ivB64,
    additionalData,
  );
  // Create a new Blob with correct MIME type
  const typedBlob = new Blob([originalBlob], { type: mimeType });
  return URL.createObjectURL(typedBlob);
}

/**
 * Decrypt media and trigger download as original file.
 * @param mediaId Media ID
 * @param ciphertext Encrypted data
 * @param ivB64 Base64 IV
 * @param filename Original filename
 * @param mimeType Original content type
 */
export async function decryptAndDownload(
  mediaId: string,
  ciphertext: ArrayBuffer,
  ivB64: string,
  filename: string,
  mimeType: string,
  additionalData?: Uint8Array,
): Promise<void> {
  const { originalBlob } = await decryptMedia(
    mediaId,
    ciphertext,
    ivB64,
    additionalData,
  );
  const typedBlob = new Blob([originalBlob], { type: mimeType });
  const url = URL.createObjectURL(typedBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if a media item can be decrypted (key exists locally).
 */
export async function canDecryptMedia(mediaId: string): Promise<boolean> {
  const wrapped = await getWrappedKey(mediaId);
  return wrapped !== null;
}

/**
 * Decrypt a blob directly with a given CryptoKey and IV.
 * Lower-level utility for cases where key is already available.
 */
export async function decryptBlob(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: ArrayBuffer,
): Promise<Blob> {
  const decrypted = await decryptData(ciphertext, key, iv);
  return new Blob([decrypted]);
}

function getIvB64FromEncMeta(encMeta: unknown): string {
  if (!encMeta || typeof encMeta !== "object") return "";
  const meta = encMeta as { ivB64?: unknown; iv?: unknown };
  if (typeof meta.ivB64 === "string") return meta.ivB64;
  if (typeof meta.iv === "string") return meta.iv;
  return "";
}

/**
 * Fetch ciphertext from a signed download URL and decrypt it.
 * Combines network fetch and decryption.
 * @param mediaId Media ID
 * @param downloadUrl Signed URL from server
 * @param ivB64 Base64 IV
 * @param mimeType Content type
 * @returns Object URL for the decrypted media
 */
export async function fetchAndDecrypt(args: {
  userId: string;
  mediaId: string;
  downloadUrl: string;
  encMeta: unknown;
  variant: VaultMediaVariant;
  mimeType: string;
}): Promise<string> {
  // Fetch ciphertext
  const response = await fetch(args.downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ciphertext: ${response.status} ${response.statusText}`,
    );
  }
  const ciphertext = await response.arrayBuffer();

  const ivB64 = getIvB64FromEncMeta(args.encMeta);
  if (!ivB64) {
    throw new Error("Missing encryption metadata (ivB64)");
  }

  const additionalData = isAesGcmEncMetaV2(args.encMeta)
    ? buildAdditionalDataForV2({
        encMeta: args.encMeta,
        userId: args.userId,
        mediaId: args.mediaId,
        variant: args.variant,
      })
    : undefined;

  // Decrypt and create object URL
  return decryptToObjectUrl(
    args.mediaId,
    ciphertext,
    ivB64,
    args.mimeType,
    additionalData,
  );
}

type SaveFilePicker = (options?: any) => Promise<any>;

const getSaveFilePicker = (): SaveFilePicker | null => {
  const fn = (globalThis as any).showSaveFilePicker as
    | SaveFilePicker
    | undefined;
  return typeof fn === "function" ? fn : null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRangeStrict(
  url: string,
  start: number,
  end: number,
): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: {
      Range: `bytes=${start}-${end}`,
    },
  });

  // We require Range support for memory-safe downloads.
  if (res.status !== 206) {
    throw new Error(
      `Server/storage does not support ranged downloads (expected 206, got ${res.status}).`,
    );
  }

  return await res.arrayBuffer();
}

// (deriveChunkIv + getUnwrappedMediaKey live above so they can be reused.)

export async function downloadDecryptedChunked(args: {
  userId: string;
  mediaId: string;
  downloadUrl: string;
  encAlgo: string;
  encMeta: unknown;
  filename: string;
  mimeType: string;
  /** If provided, use this key (shared media) instead of unwrapping from local store. */
  decryptionKey?: CryptoKey;
  onProgress?: (done: number, total: number) => void;
}): Promise<void> {
  if (
    args.encAlgo !== CHUNKED_ENC_ALGO_V1 &&
    args.encAlgo !== CHUNKED_ENC_ALGO_V2
  ) {
    throw new Error("Chunked download requested for non-chunked encryption");
  }

  const isV2 = args.encAlgo === CHUNKED_ENC_ALGO_V2;
  if (isV2) {
    if (!isChunkedEncMetaV2(args.encMeta)) {
      throw new Error("Missing/invalid chunked encryption metadata");
    }
  } else {
    if (!isChunkedEncMetaV1(args.encMeta)) {
      throw new Error("Missing/invalid chunked encryption metadata");
    }
  }

  const picker = getSaveFilePicker();
  if (!picker) {
    throw new Error(
      "Streaming download requires the File System Access API (supported in Chromium-based browsers).",
    );
  }

  const fileHandle: any = await picker({
    suggestedName: args.filename,
  });
  const writable: any = await fileHandle.createWritable({
    keepExistingData: true,
  });

  const mediaKey =
    args.decryptionKey ?? (await getUnwrappedMediaKey(args.mediaId));
  const encMeta = args.encMeta;
  const chunkCount = getChunkCount(encMeta);

  const additionalData = isV2
    ? buildAdditionalDataForV2({
        encMeta: args.encMeta,
        userId: args.userId,
        mediaId: args.mediaId,
        variant: "original",
      })
    : undefined;

  const totalCiphertextBytes =
    encMeta.originalByteSize + chunkCount * encMeta.tagBytes;
  let downloaded = 0;
  let startChunkIndex = 0;

  // Best-effort manual resume:
  // If the user selects an existing partial file, continue from the last full
  // chunk boundary (truncate back to the boundary if needed).
  try {
    const existingFile: any = await fileHandle.getFile?.();
    const existingSize = Number(existingFile?.size ?? 0);

    if (Number.isFinite(existingSize) && existingSize > 0) {
      if (existingSize > encMeta.originalByteSize) {
        await writable.truncate(0);
        await writable.seek(0);
      } else {
        let plainBoundary = 0;
        while (startChunkIndex < chunkCount) {
          const nextPlain = getPlainChunkByteSize(encMeta, startChunkIndex);
          if (plainBoundary + nextPlain <= existingSize) {
            plainBoundary += nextPlain;
            downloaded += getCipherChunkByteSize(encMeta, startChunkIndex);
            startChunkIndex += 1;
          } else {
            break;
          }
        }

        if (plainBoundary !== existingSize) {
          await writable.truncate(plainBoundary);
        }
        await writable.seek(plainBoundary);
      }
    }
  } catch {
    // Ignore resume failures; start from the beginning.
    startChunkIndex = 0;
    downloaded = 0;
    try {
      await writable.truncate(0);
      await writable.seek(0);
    } catch {
      // ignore
    }
  }

  try {
    for (
      let chunkIndex = startChunkIndex;
      chunkIndex < chunkCount;
      chunkIndex++
    ) {
      const start = getCipherChunkOffset(encMeta, chunkIndex);
      const size = getCipherChunkByteSize(encMeta, chunkIndex);
      const end = start + size - 1;

      // Retry each chunk to support flaky networks.
      let ciphertextChunk: ArrayBuffer | null = null;
      let attempt = 0;
      while (!ciphertextChunk) {
        attempt += 1;
        try {
          ciphertextChunk = await fetchRangeStrict(
            args.downloadUrl,
            start,
            end,
          );
        } catch (e) {
          if (attempt >= 4) throw e;
          await sleep(250 * attempt);
        }
      }

      const iv = deriveChunkIv(encMeta, chunkIndex);
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          ...(additionalData ? { additionalData } : {}),
        },
        mediaKey,
        ciphertextChunk,
      );

      await writable.write(new Uint8Array(plaintext));

      downloaded += size;
      args.onProgress?.(downloaded, totalCiphertextBytes);
    }
  } finally {
    await writable.close();
  }
}

/**
 * Fetch ciphertext from a share-scoped download URL and decrypt with provided key.
 * For shared media where decryption key is already available.
 * @param mediaId Media ID
 * @param downloadUrl Share-scoped signed URL
 * @param decryptionKey Already-unwrapped media key
 * @param mimeType Content type
 * @returns Object URL for the decrypted media
 */
export async function fetchAndDecryptShared(args: {
  ownerUserId: string;
  mediaId: string;
  downloadUrl: string;
  decryptionKey: CryptoKey;
  encMeta: unknown;
  variant: VaultMediaVariant;
  mimeType: string;
}): Promise<string> {
  // mediaId is kept for logging / future telemetry (shared decrypt failures)
  void args.mediaId;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Fetch ciphertext (retry on 429)
  const maxAttempts = 4;
  let response: Response | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    response = await fetch(args.downloadUrl);

    if (response.ok) break;

    if (response.status === 429 && i < maxAttempts - 1) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? Number(retryAfterHeader)
        : NaN;
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(0, retryAfterSeconds) * 1000
        : null;
      const base = retryAfterMs ?? 300 * Math.pow(2, i);
      const jitter = Math.floor(Math.random() * 150);
      await sleep(base + jitter);
      continue;
    }

    throw new Error(
      `Failed to fetch ciphertext: ${response.status} ${response.statusText}`,
    );
  }

  if (!response || !response.ok) {
    throw new Error("Failed to fetch ciphertext");
  }

  const ciphertext = await response.arrayBuffer();

  const ivB64 = getIvB64FromEncMeta(args.encMeta);
  if (!ivB64) {
    throw new Error("Missing encryption metadata (ivB64)");
  }

  const additionalData = isAesGcmEncMetaV2(args.encMeta)
    ? buildAdditionalDataForV2({
        encMeta: args.encMeta,
        userId: args.ownerUserId,
        mediaId: args.mediaId,
        variant: args.variant,
      })
    : undefined;

  // Decrypt ciphertext with the media's encryption IV (stored in encMeta)
  const iv = base64ToArrayBuffer(ivB64);
  const decrypted = await decryptData(
    ciphertext,
    args.decryptionKey,
    iv,
    additionalData,
  );
  const blob = new Blob([decrypted], { type: args.mimeType });
  return URL.createObjectURL(blob);
}
