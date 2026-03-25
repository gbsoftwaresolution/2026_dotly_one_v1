/**
 * File encryption for uploads.
 * Generates per‑file AES‑GCM key, encrypts file, returns ciphertext and metadata.
 */

import {
  fileToArrayBuffer,
  generateAesGcmKey,
  encryptData,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  exportKeyRaw,
  wrapKey,
  randomBytes,
} from "./webcrypto";
import { getCachedMasterKey } from "./vaultKey";
import { storeWrappedKey } from "./keyStore";
import type { VaultMediaVariant } from "./aad";

export interface EncryptResult {
  ciphertext: ArrayBuffer;
  ivB64: string;
  mediaKeyRaw: ArrayBuffer; // raw AES key bytes (to be wrapped)
  mediaKey: CryptoKey; // CryptoKey for immediate use if needed
}

export const CHUNKED_ENC_ALGO_V1 = "aes-256-gcm-chunked-v1" as const;
export const CHUNKED_ENC_ALGO_V2 = "aes-256-gcm-chunked-v2" as const;

export type AesGcmEncMetaV1 = {
  // v is intentionally optional to support legacy metadata that omitted it.
  v?: 1;
  alg: "AES-256-GCM";
  /** Base64 IV (preferred field). */
  ivB64: string;
};

export type AesGcmEncMetaV2 = {
  v: 2;
  alg: "AES-256-GCM";
  /** Base64 IV. */
  ivB64: string;
  /** Human-readable fields so decryptors can recompute AAD deterministically. */
  aad?: {
    purpose: "vault-media";
    metaVersion: 2;
    userId: string;
    mediaId: string;
    variant: VaultMediaVariant;
  };
};

export type ChunkedEncMetaV1 = {
  v: 1;
  alg: "AES-256-GCM-CHUNKED";
  /** 8-byte random prefix; chunk IV = prefix(8) || chunkIndex(uint32be) */
  ivPrefixB64: string;
  /** Plaintext chunk size in bytes (except last chunk). */
  chunkSize: number;
  /** AES-GCM tag bytes appended to each ciphertext chunk. */
  tagBytes: 16;
  /** Original plaintext size in bytes. */
  originalByteSize: number;
};

export type ChunkedEncMetaV2 = Omit<ChunkedEncMetaV1, "v"> & { v: 2 };

const AES_GCM_TAG_BYTES = 16 as const;
const IV_PREFIX_BYTES = 8 as const;

export function isChunkedEncMetaV1(encMeta: any): encMeta is ChunkedEncMetaV1 {
  return (
    !!encMeta &&
    encMeta.v === 1 &&
    encMeta.alg === "AES-256-GCM-CHUNKED" &&
    typeof encMeta.ivPrefixB64 === "string" &&
    typeof encMeta.chunkSize === "number" &&
    encMeta.chunkSize > 0 &&
    encMeta.tagBytes === 16 &&
    typeof encMeta.originalByteSize === "number" &&
    encMeta.originalByteSize >= 0
  );
}

export function isChunkedEncMetaV2(encMeta: any): encMeta is ChunkedEncMetaV2 {
  return (
    !!encMeta &&
    encMeta.v === 2 &&
    encMeta.alg === "AES-256-GCM-CHUNKED" &&
    typeof encMeta.ivPrefixB64 === "string" &&
    typeof encMeta.chunkSize === "number" &&
    encMeta.chunkSize > 0 &&
    encMeta.tagBytes === 16 &&
    typeof encMeta.originalByteSize === "number" &&
    encMeta.originalByteSize >= 0
  );
}

export function estimateChunkedCiphertextByteSize(args: {
  originalByteSize: number;
  chunkSize: number;
  tagBytes?: number;
}): number {
  const tagBytes =
    typeof args.tagBytes === "number" ? args.tagBytes : AES_GCM_TAG_BYTES;
  if (args.originalByteSize <= 0) return 0;
  const chunkCount = Math.ceil(args.originalByteSize / args.chunkSize);
  return args.originalByteSize + chunkCount * tagBytes;
}

export async function createChunkedIvPrefixB64(): Promise<string> {
  const prefix = crypto.getRandomValues(new Uint8Array(IV_PREFIX_BYTES));
  return arrayBufferToBase64(prefix.buffer);
}

export function buildChunkedEncMetaV1(args: {
  ivPrefixB64: string;
  chunkSize: number;
  originalByteSize: number;
}): ChunkedEncMetaV1 {
  return {
    v: 1,
    alg: "AES-256-GCM-CHUNKED",
    ivPrefixB64: args.ivPrefixB64,
    chunkSize: args.chunkSize,
    tagBytes: AES_GCM_TAG_BYTES,
    originalByteSize: args.originalByteSize,
  };
}

export function buildChunkedEncMetaV2(args: {
  ivPrefixB64: string;
  chunkSize: number;
  originalByteSize: number;
  aad?: {
    purpose: "vault-media";
    metaVersion: 2;
    userId: string;
    mediaId: string;
    variant: VaultMediaVariant;
  };
}): ChunkedEncMetaV2 {
  return {
    ...buildChunkedEncMetaV1(args),
    v: 2,
    ...(args.aad ? { aad: args.aad } : {}),
  };
}

export function getChunkCount(
  encMeta: ChunkedEncMetaV1 | ChunkedEncMetaV2,
): number {
  if (encMeta.originalByteSize <= 0) return 0;
  return Math.ceil(encMeta.originalByteSize / encMeta.chunkSize);
}

export function getPlainChunkByteSize(
  encMeta: ChunkedEncMetaV1 | ChunkedEncMetaV2,
  chunkIndex: number,
): number {
  const chunkCount = getChunkCount(encMeta);
  if (chunkCount === 0) return 0;
  if (chunkIndex < 0 || chunkIndex >= chunkCount) return 0;
  const start = chunkIndex * encMeta.chunkSize;
  const remaining = encMeta.originalByteSize - start;
  return Math.max(0, Math.min(encMeta.chunkSize, remaining));
}

export function getCipherChunkByteSize(
  encMeta: ChunkedEncMetaV1 | ChunkedEncMetaV2,
  chunkIndex: number,
): number {
  return getPlainChunkByteSize(encMeta, chunkIndex) + encMeta.tagBytes;
}

export function getCipherChunkOffset(
  encMeta: ChunkedEncMetaV1 | ChunkedEncMetaV2,
  chunkIndex: number,
): number {
  // Ciphertext layout is a simple concatenation of (cipherChunk = plainChunk + tagBytes).
  // All chunks before chunkIndex are full-sized except potentially the last chunk, but
  // that doesn't affect offsets *before* the last chunk.
  return chunkIndex * (encMeta.chunkSize + encMeta.tagBytes);
}

export async function encryptChunkFromFile(args: {
  file: File;
  mediaKey: CryptoKey;
  encMeta: ChunkedEncMetaV1 | ChunkedEncMetaV2;
  chunkIndex: number;
  additionalData?: Uint8Array;
}): Promise<ArrayBuffer> {
  const plainSize = getPlainChunkByteSize(args.encMeta, args.chunkIndex);
  const start = args.chunkIndex * args.encMeta.chunkSize;
  const end = start + plainSize;
  const slice = args.file.slice(start, end);
  const plaintext = await slice.arrayBuffer();

  // Derive IV = prefix(8) || chunkIndex(uint32be)
  const prefix = new Uint8Array(base64ToArrayBuffer(args.encMeta.ivPrefixB64));
  if (prefix.byteLength !== IV_PREFIX_BYTES) {
    throw new Error("Invalid ivPrefixB64 length for chunked encryption");
  }
  const iv = new Uint8Array(12);
  iv.set(prefix, 0);
  const view = new DataView(iv.buffer);
  view.setUint32(8, args.chunkIndex >>> 0, false);

  // WebCrypto AES-GCM returns ciphertext||tag.
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      ...(args.additionalData ? { additionalData: args.additionalData } : {}),
    },
    args.mediaKey,
    plaintext,
  );

  return ciphertext;
}

export function estimateAesGcmCiphertextByteSize(
  plainByteSize: number,
): number {
  if (!Number.isFinite(plainByteSize) || plainByteSize < 0) return 0;
  return plainByteSize + AES_GCM_TAG_BYTES;
}

export function createAesGcmIv(): ArrayBuffer {
  return randomBytes(12);
}

export function toAesGcmEncMetaV2(
  iv: ArrayBuffer,
  aad?: {
    purpose: "vault-media";
    metaVersion: 2;
    userId: string;
    mediaId: string;
    variant: VaultMediaVariant;
  },
): AesGcmEncMetaV2 {
  return {
    v: 2,
    alg: "AES-256-GCM",
    ivB64: arrayBufferToBase64(iv),
    ...(aad ? { aad } : {}),
  };
}

export async function encryptFileWithKeyIvAndAad(args: {
  file: File;
  mediaKey: CryptoKey;
  iv: ArrayBuffer;
  additionalData?: Uint8Array;
}): Promise<ArrayBuffer> {
  const fileBuffer = await fileToArrayBuffer(args.file);
  const { ciphertext } = await encryptData(
    fileBuffer,
    args.mediaKey,
    args.iv,
    args.additionalData,
  );
  return ciphertext;
}

export async function encryptPlaintextWithKeyIvAndAad(args: {
  plaintext: ArrayBuffer;
  mediaKey: CryptoKey;
  iv: ArrayBuffer;
  additionalData?: Uint8Array;
}): Promise<ArrayBuffer> {
  const { ciphertext } = await encryptData(
    args.plaintext,
    args.mediaKey,
    args.iv,
    args.additionalData,
  );
  return ciphertext;
}

/**
 * Encrypt a file for upload.
 * Generates random AES‑GCM key and IV, encrypts file, returns result.
 * @param file The File to encrypt
 * @returns EncryptResult with ciphertext, IV (base64), raw media key, and CryptoKey
 */
export async function encryptFile(file: File): Promise<EncryptResult> {
  // 1. Generate random per‑media key
  const mediaKey = await generateAesGcmKey();
  const mediaKeyRaw = await exportKeyRaw(mediaKey);

  // 2. Read file as ArrayBuffer
  const fileBuffer = await fileToArrayBuffer(file);

  // 3. Encrypt with AES‑GCM (random IV)
  const { ciphertext, iv } = await encryptData(fileBuffer, mediaKey);

  // 4. Return result
  return {
    ciphertext,
    ivB64: arrayBufferToBase64(iv),
    mediaKeyRaw,
    mediaKey,
  };
}

/**
 * Encrypt and wrap key for storage.
 * This is the full upload preparation flow:
 * 1. Encrypt file
 * 2. Wrap media key with master key
 * 3. Store wrapped key in IndexedDB (after receiving mediaId from server)
 * @param file The File to upload
 * @returns Object with ciphertext, encryption metadata, and wrapped key info
 */
export async function prepareUpload(file: File): Promise<{
  ciphertext: ArrayBuffer;
  encAlgo: string;
  encMeta: {
    alg: string;
    ivB64: string;
  };
  mediaKeyRaw: ArrayBuffer;
  mediaKey: CryptoKey;
  wrapInfo: {
    wrappedKey: ArrayBuffer;
    wrapIv: ArrayBuffer;
  };
}> {
  // Ensure vault is unlocked
  const masterKey = getCachedMasterKey();

  // Encrypt file
  const { ciphertext, ivB64, mediaKeyRaw, mediaKey } = await encryptFile(file);

  // Wrap media key with master key
  const { wrappedKey, iv: wrapIv } = await wrapKey(mediaKey, masterKey);

  return {
    ciphertext,
    encAlgo: "aes-256-gcm",
    encMeta: {
      alg: "AES-256-GCM",
      ivB64,
    },
    mediaKeyRaw,
    mediaKey,
    wrapInfo: {
      wrappedKey,
      wrapIv,
    },
  };
}

/**
 * Prepare upload *intent* metadata for v2 AES-GCM (AAD binding).
 *
 * This intentionally does NOT encrypt any bytes; encryption must happen
 * after the server returns the mediaId so AAD can bind to (userId, mediaId, variant).
 */
export async function prepareUploadIntentAesGcmV2(file: File): Promise<{
  encAlgo: "aes-256-gcm";
  encMeta: AesGcmEncMetaV2;
  ciphertextByteSize: number;
  iv: ArrayBuffer;
  mediaKeyRaw: ArrayBuffer;
  mediaKey: CryptoKey;
  wrapInfo: {
    wrappedKey: ArrayBuffer;
    wrapIv: ArrayBuffer;
  };
}> {
  const masterKey = getCachedMasterKey();

  const mediaKey = await generateAesGcmKey();
  const mediaKeyRaw = await exportKeyRaw(mediaKey);

  const { wrappedKey, iv: wrapIv } = await wrapKey(mediaKey, masterKey);

  const iv = createAesGcmIv();
  const encMeta = toAesGcmEncMetaV2(iv);
  const ciphertextByteSize = estimateAesGcmCiphertextByteSize(file.size);

  return {
    encAlgo: "aes-256-gcm",
    encMeta,
    ciphertextByteSize,
    iv,
    mediaKeyRaw,
    mediaKey,
    wrapInfo: {
      wrappedKey,
      wrapIv,
    },
  };
}

/**
 * Prepare upload for large files without buffering full ciphertext in memory.
 * Uses per-chunk AES-GCM (tag per chunk) so downloads can be range-fetched and decrypted incrementally.
 */
export async function prepareUploadChunked(
  file: File,
  args: {
    chunkSize: number;
  },
): Promise<{
  encAlgo: typeof CHUNKED_ENC_ALGO_V1;
  encMeta: ChunkedEncMetaV1;
  ciphertextByteSize: number;
  mediaKeyRaw: ArrayBuffer;
  mediaKey: CryptoKey;
  wrapInfo: {
    wrappedKey: ArrayBuffer;
    wrapIv: ArrayBuffer;
  };
}> {
  if (!Number.isFinite(args.chunkSize) || args.chunkSize <= 0) {
    throw new Error("Invalid chunkSize");
  }

  const masterKey = getCachedMasterKey();

  // Per-media key
  const mediaKey = await generateAesGcmKey();
  const mediaKeyRaw = await exportKeyRaw(mediaKey);

  // Wrap media key
  const { wrappedKey, iv: wrapIv } = await wrapKey(mediaKey, masterKey);

  const ivPrefixB64 = await createChunkedIvPrefixB64();
  const encMeta = buildChunkedEncMetaV1({
    ivPrefixB64,
    chunkSize: args.chunkSize,
    originalByteSize: file.size,
  });

  const ciphertextByteSize = estimateChunkedCiphertextByteSize({
    originalByteSize: file.size,
    chunkSize: encMeta.chunkSize,
    tagBytes: encMeta.tagBytes,
  });

  return {
    encAlgo: CHUNKED_ENC_ALGO_V1,
    encMeta,
    ciphertextByteSize,
    mediaKeyRaw,
    mediaKey,
    wrapInfo: {
      wrappedKey,
      wrapIv,
    },
  };
}

export async function prepareUploadChunkedV2(
  file: File,
  args: {
    chunkSize: number;
  },
): Promise<{
  encAlgo: typeof CHUNKED_ENC_ALGO_V2;
  encMeta: ChunkedEncMetaV2;
  ciphertextByteSize: number;
  mediaKeyRaw: ArrayBuffer;
  mediaKey: CryptoKey;
  wrapInfo: {
    wrappedKey: ArrayBuffer;
    wrapIv: ArrayBuffer;
  };
}> {
  if (!Number.isFinite(args.chunkSize) || args.chunkSize <= 0) {
    throw new Error("Invalid chunkSize");
  }

  const masterKey = getCachedMasterKey();

  const mediaKey = await generateAesGcmKey();
  const mediaKeyRaw = await exportKeyRaw(mediaKey);

  const { wrappedKey, iv: wrapIv } = await wrapKey(mediaKey, masterKey);

  const ivPrefixB64 = await createChunkedIvPrefixB64();
  const encMeta = buildChunkedEncMetaV2({
    ivPrefixB64,
    chunkSize: args.chunkSize,
    originalByteSize: file.size,
  });

  const ciphertextByteSize = estimateChunkedCiphertextByteSize({
    originalByteSize: file.size,
    chunkSize: encMeta.chunkSize,
    tagBytes: encMeta.tagBytes,
  });

  return {
    encAlgo: CHUNKED_ENC_ALGO_V2,
    encMeta,
    ciphertextByteSize,
    mediaKeyRaw,
    mediaKey,
    wrapInfo: {
      wrappedKey,
      wrapIv,
    },
  };
}

/**
 * Encrypt arbitrary bytes with an existing per-media key.
 * Used for encrypting derived assets like thumbnails.
 */
export async function encryptWithMediaKey(
  mediaKey: CryptoKey,
  plaintext: ArrayBuffer,
): Promise<{
  ciphertext: ArrayBuffer;
  encMeta: { alg: string; ivB64: string };
}> {
  const { ciphertext, iv } = await encryptData(plaintext, mediaKey);
  return {
    ciphertext,
    encMeta: {
      alg: "AES-256-GCM",
      ivB64: arrayBufferToBase64(iv),
    },
  };
}

/**
 * Store wrapped key after receiving mediaId from server.
 * Call this after successful upload‑intent response.
 */
export async function storeMediaKey(
  mediaId: string,
  wrappedKey: ArrayBuffer,
  wrapIv: ArrayBuffer,
): Promise<void> {
  await storeWrappedKey(mediaId, wrappedKey, wrapIv);
}

/**
 * Estimate if a file is too large for browser memory.
 * Show warning for files > 200MB.
 */
export function checkFileSizeWarning(file: File): {
  ok: boolean;
  warning?: string;
} {
  const MAX_SIZE_MB = 200;
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_SIZE_MB) {
    return {
      ok: false,
      warning: `File size (${sizeMB.toFixed(1)} MB) exceeds the recommended limit of ${MAX_SIZE_MB} MB. Upload may fail due to browser memory constraints.`,
    };
  }
  return { ok: true };
}

/**
 * Extract basic metadata from a File.
 */
export function extractFileMetadata(file: File): {
  contentType: string;
  byteSize: number;
  originalFilename: string;
  takenAt?: Date;
  title?: string;
} {
  const takenAt = new Date(file.lastModified); // best effort
  const title = file.name.replace(/\.[^/.]+$/, ""); // strip extension

  const inferContentTypeFromFilename = (name: string): string | null => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (!ext) return null;

    // Tier 1 documents
    if (ext === "pdf") return "application/pdf";
    if (ext === "doc") return "application/msword";
    if (ext === "docx") {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (ext === "xls") return "application/vnd.ms-excel";
    if (ext === "xlsx") {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (ext === "ppt") return "application/vnd.ms-powerpoint";
    if (ext === "pptx") {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    if (ext === "txt") return "text/plain";
    if (ext === "csv") return "text/csv";
    if (ext === "md" || ext === "markdown") return "text/markdown";
    if (ext === "html" || ext === "htm") return "text/html";
    if (ext === "rtf") return "application/rtf";
    if (ext === "json") return "application/json";
    if (ext === "xml") return "application/xml";
    if (ext === "yml" || ext === "yaml") return "application/yaml";
    if (ext === "log") return "text/plain";
    if (ext === "odt") return "application/vnd.oasis.opendocument.text";
    if (ext === "ods") return "application/vnd.oasis.opendocument.spreadsheet";
    if (ext === "odp") return "application/vnd.oasis.opendocument.presentation";
    if (ext === "epub") return "application/epub+zip";
    if (ext === "mobi") return "application/x-mobipocket-ebook";
    if (ext === "eml") return "message/rfc822";
    if (ext === "msg") return "application/vnd.ms-outlook";
    if (ext === "zip") return "application/zip";
    if (ext === "7z") return "application/x-7z-compressed";
    if (ext === "rar") return "application/vnd.rar";
    if (ext === "tar") return "application/x-tar";
    if (ext === "gz" || ext === "tgz") return "application/gzip";

    // Common photos/videos (best-effort fallback when the browser provides an empty type)
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    if (ext === "webp") return "image/webp";
    if (ext === "bmp") return "image/bmp";
    if (ext === "tif" || ext === "tiff") return "image/tiff";
    if (ext === "heic") return "image/heic";
    if (ext === "heif") return "image/heif";

    if (ext === "mp4") return "video/mp4";
    if (ext === "webm") return "video/webm";
    if (ext === "mov") return "video/quicktime";
    if (ext === "m4v") return "video/x-m4v";

    return null;
  };

  const normalizedContentType = (() => {
    const ct = String(file.type || "").trim();
    if (ct && ct !== "application/octet-stream") return ct;
    return (
      inferContentTypeFromFilename(file.name) || "application/octet-stream"
    );
  })();

  return {
    contentType: normalizedContentType,
    byteSize: file.size,
    originalFilename: file.name,
    takenAt,
    title,
  };
}
