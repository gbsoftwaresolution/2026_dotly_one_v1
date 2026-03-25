import React, { useState, useRef } from "react";
import { flushSync } from "react-dom";
import { mediaApi } from "../api/media";
import { ApiError } from "../api/client";
import { useAuth } from "../app/AuthProvider";
import {
  prepareUploadIntentAesGcmV2,
  prepareUploadChunkedV2,
  extractFileMetadata,
  checkFileSizeWarning,
  storeMediaKey,
  createAesGcmIv,
  toAesGcmEncMetaV2,
  encryptFileWithKeyIvAndAad,
  encryptPlaintextWithKeyIvAndAad,
  encryptChunkFromFile,
  getChunkCount,
} from "../crypto/encrypt";
import { arrayBufferToBase64 } from "../crypto/webcrypto";
import { buildVaultMediaAadBytes } from "../crypto/aad";
import { isMasterKeyCached } from "../crypto/vaultKey";
import { useOffline } from "../hooks/useOffline";
import { generateThumbnail } from "../media/thumbnails";
import {
  extractVideoDurationSecondsFromFile,
  setCachedVideoDurationSeconds,
} from "../utils/videoDurationCache";
import { Modal } from "./Modal";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void; // called when upload completes successfully
  onNeedUnlock: () => void; // called when vault needs unlocking
}

export const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  onSuccess,
  onNeedUnlock,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [statusText, setStatusText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const isOffline = useOffline();
  const { user } = useAuth();

  if (!open) return null;

  const getFileExt = (name: string): string => {
    const ext = name.split(".").pop();
    return ext ? ext.toLowerCase() : "";
  };

  const isTier1Document = (file: File): boolean => {
    const ct = String(file.type || "").toLowerCase();
    const ext = getFileExt(file.name);

    if (ct === "application/pdf" || ext === "pdf") return true;
    if (ct === "application/msword" || ext === "doc") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return true;
    }
    if (ct === "application/vnd.ms-excel" || ext === "xls") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      ext === "xlsx"
    ) {
      return true;
    }
    if (ct === "application/vnd.ms-powerpoint" || ext === "ppt") return true;
    if (
      ct ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      ext === "pptx"
    ) {
      return true;
    }
    if (ct === "text/plain" || ext === "txt") return true;
    if (ct === "text/csv" || ext === "csv") return true;
    if (ct === "application/zip" || ext === "zip") return true;

    return false;
  };

  const isLegacyOffice = (file: File): boolean => {
    const ct = String(file.type || "").toLowerCase();
    const ext = getFileExt(file.name);
    return (
      ct === "application/msword" ||
      ext === "doc" ||
      ct === "application/vnd.ms-excel" ||
      ext === "xls" ||
      ct === "application/vnd.ms-powerpoint" ||
      ext === "ppt"
    );
  };

  const isPreviewSupportedDocument = (file: File): boolean => {
    const ct = String(file.type || "").toLowerCase();
    const ext = getFileExt(file.name);

    // Tier-1 + previewable
    if (isTier1Document(file)) {
      // Legacy Office previews are not supported yet.
      if (isLegacyOffice(file)) return false;
      return true;
    }

    // Tier-2 (common, safe)
    if (ct === "text/markdown" || ext === "md" || ext === "markdown")
      return true;
    if (ct === "text/html" || ext === "html" || ext === "htm") return true;
    if (ct === "application/rtf" || ct === "text/rtf" || ext === "rtf")
      return true;
    if (ct === "application/json" || ext === "json") return true;
    if (ct === "application/xml" || ct === "text/xml" || ext === "xml")
      return true;
    if (
      ct === "application/yaml" ||
      ct === "text/yaml" ||
      ext === "yml" ||
      ext === "yaml"
    ) {
      return true;
    }
    if (ext === "log") return true;

    // Tier-3: thumbnails only (download-only; no in-app preview)
    if (ct === "application/vnd.oasis.opendocument.text" || ext === "odt")
      return false;
    if (
      ct === "application/vnd.oasis.opendocument.spreadsheet" ||
      ext === "ods"
    )
      return false;
    if (
      ct === "application/vnd.oasis.opendocument.presentation" ||
      ext === "odp"
    )
      return false;

    // Tier-4: download-only (no in-app preview)
    if (ct === "application/epub+zip" || ext === "epub") return false;

    return false;
  };

  const getSupportTierLabel = (file: File): string => {
    const ct = String(file.type || "").toLowerCase();
    const ext = getFileExt(file.name);
    if (isTier1Document(file)) return "Tier-1";

    if (
      ct === "text/markdown" ||
      ext === "md" ||
      ext === "markdown" ||
      ct === "application/json" ||
      ext === "json" ||
      ct === "application/xml" ||
      ct === "text/xml" ||
      ext === "xml" ||
      ct === "application/yaml" ||
      ct === "text/yaml" ||
      ext === "yml" ||
      ext === "yaml" ||
      ext === "log" ||
      ct === "application/rtf" ||
      ct === "text/rtf" ||
      ext === "rtf" ||
      ct === "text/html" ||
      ext === "html" ||
      ext === "htm"
    ) {
      return "Tier-2";
    }

    if (
      ct.startsWith("application/vnd.oasis.opendocument") ||
      ext === "odt" ||
      ext === "ods" ||
      ext === "odp"
    ) {
      return "Tier-3";
    }

    if (
      ct === "application/epub+zip" ||
      ext === "epub" ||
      ext === "mobi" ||
      ct === "message/rfc822" ||
      ext === "eml" ||
      ext === "msg" ||
      ext === "7z" ||
      ext === "rar" ||
      ext === "tar" ||
      ext === "gz" ||
      ext === "tgz"
    ) {
      return "Tier-4";
    }

    return "Tier-2";
  };

  const isAllowedUploadFile = (_file: File): boolean => {
    // Tier-2 uploads: allow any file type. Preview support is best-effort.
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newWarnings: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file) => {
      if (!isAllowedUploadFile(file)) {
        newWarnings.push(`Unsupported file type: ${file.name}.`);
        return;
      }

      const ct = String(file.type || "").toLowerCase();
      const ext = getFileExt(file.name);
      const isImage = ct.startsWith("image/");
      const isVideo = ct.startsWith("video/");
      const isTier1 = isTier1Document(file);
      const isPreviewableDoc =
        !isImage && !isVideo && isPreviewSupportedDocument(file);

      // Tier-2 hint: file can be uploaded, but preview may not be available.
      if (!isImage && !isVideo && !isTier1) {
        const label = ext ? ext.toUpperCase() : "FILE";
        const tier = getSupportTierLabel(file);
        const previewNote = isPreviewableDoc
          ? "Basic in-app preview is available."
          : tier === "Tier-3"
            ? "Thumbnail is available, but there is no in-app preview."
            : tier === "Tier-4"
              ? "No in-app preview is available (download-only)."
              : "It may not have an in-app preview.";
        newWarnings.push(
          `${tier} upload: ${file.name} (${label}) will be stored securely. ${previewNote} Use Download to open it.`,
        );
      }

      if (!isImage && !isVideo && isLegacyOffice(file)) {
        newWarnings.push(
          `Preview note: ${file.name} is a legacy Office format (.doc/.xls/.ppt). In-app preview isn’t supported yet—convert to .docx/.xlsx/.pptx or use Download.`,
        );
      }

      const sizeCheck = checkFileSizeWarning(file);
      if (!sizeCheck.ok && sizeCheck.warning) {
        newWarnings.push(sizeCheck.warning);
      }
      validFiles.push(file);
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setWarnings((prev) => [...prev, ...newWarnings]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (!isMasterKeyCached()) {
      onNeedUnlock();
      return;
    }

    const startedAt = Date.now();

    flushSync(() => {
      setUploading(true);
      setError(null);
      setSuccess(null);
      setProgress(0);
      setCurrentFileIndex(0);
      setStatusText("Preparing…");
    });

    const totalBytes = selectedFiles.reduce(
      (sum, f) => sum + (f?.size ?? 0),
      0,
    );
    let completedBytes = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      setCurrentFileIndex(i);
      const file = selectedFiles[i];
      if (!file) continue;
      try {
        await uploadSingleFile(file, {
          onPhase: (phase) => {
            flushSync(() => {
              setStatusText(`${phase}: ${file.name}`);
            });
          },
          onUploadProgress: (loaded, total) => {
            const currentTotal = total > 0 ? total : file.size;
            const clampedLoaded = Math.max(0, Math.min(loaded, currentTotal));
            const overall =
              totalBytes > 0
                ? ((completedBytes + clampedLoaded) / totalBytes) * 100
                : ((i + 0.5) / selectedFiles.length) * 100;
            setProgress(Math.max(0, Math.min(100, overall)));
          },
        });

        completedBytes += file.size;
        const overall =
          totalBytes > 0
            ? (completedBytes / totalBytes) * 100
            : ((i + 1) / selectedFiles.length) * 100;
        setProgress(Math.max(0, Math.min(100, overall)));
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          setError("Your session expired. Please sign in again and retry.");
        } else {
          setError(
            `Failed to upload "${file.name}": ${err?.message || "Unknown error"}`,
          );
        }
        setUploading(false);
        setStatusText("");
        return;
      }
    }

    setProgress(100);
    setStatusText("Upload complete");
    const minVisibleMs = 600;
    const elapsed = Date.now() - startedAt;
    if (elapsed < minVisibleMs) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, minVisibleMs - elapsed),
      );
    }

    setUploading(false);
    setStatusText("");
    setSelectedFiles([]);
    setSuccess("Upload complete");
    onSuccess();
  };

  const uploadSingleFile = async (
    file: File,
    callbacks?: {
      onPhase?: (
        phase: "Encrypting" | "Requesting upload" | "Uploading" | "Finalizing",
      ) => void;
      onUploadProgress?: (loaded: number, total: number) => void;
    },
  ) => {
    const userId = user?.id;
    if (!userId) {
      throw new Error("Missing user session");
    }

    const metadata = extractFileMetadata(file);
    const normalizedContentType = String(
      metadata.contentType || file.type || "",
    ).toLowerCase();
    const type: "PHOTO" | "VIDEO" | "DOCUMENT" =
      normalizedContentType.startsWith("video/")
        ? "VIDEO"
        : normalizedContentType.startsWith("image/")
          ? "PHOTO"
          : "DOCUMENT";

    const CHUNKED_DOWNLOAD_THRESHOLD_BYTES = 64 * 1024 * 1024; // 64MiB
    const tagBytes = 16;

    // Decide whether to use chunked AES-GCM so large downloads can be resumed/retried per-chunk
    // and decrypted without loading the full file into RAM.
    let useChunked = false;
    let multipartSupport: {
      supported: boolean;
      partSize: number;
      minPartSize: number;
      maxParts: number;
      threshold: number;
    } | null = null;

    if (file.size >= CHUNKED_DOWNLOAD_THRESHOLD_BYTES) {
      try {
        multipartSupport = await mediaApi.getMultipartSupport();
        useChunked = !!multipartSupport?.supported;
      } catch {
        multipartSupport = null;
        useChunked = false;
      }
    }

    // Encryption intent preparation (no ciphertext yet; we need mediaId for AAD)
    let ciphertext: ArrayBuffer | null = null;
    let byteSizeForIntent = 0;
    let encAlgo: string;
    let encMeta: any;
    let wrapInfo: { wrappedKey: ArrayBuffer; wrapIv: ArrayBuffer };
    let mediaKey: CryptoKey;
    let originalIv: ArrayBuffer | null = null;

    if (useChunked && multipartSupport) {
      // Align chunk sizes to the server's recommended multipart part size.
      const targetPartSize = Math.max(
        multipartSupport.partSize,
        multipartSupport.minPartSize,
      );
      let plainChunkSize = Math.max(1, targetPartSize - tagBytes);

      // Ensure we don't exceed maxParts.
      const minPlainChunkSizeByMaxParts = Math.ceil(
        file.size / multipartSupport.maxParts,
      );
      if (plainChunkSize < minPlainChunkSizeByMaxParts) {
        plainChunkSize = minPlainChunkSizeByMaxParts;
      }

      const prepared = await prepareUploadChunkedV2(file, {
        chunkSize: plainChunkSize,
      });

      encAlgo = prepared.encAlgo;
      encMeta = prepared.encMeta;
      wrapInfo = prepared.wrapInfo;
      mediaKey = prepared.mediaKey;
      byteSizeForIntent = prepared.ciphertextByteSize;
    } else {
      const prepared = await prepareUploadIntentAesGcmV2(file);
      encAlgo = prepared.encAlgo;
      encMeta = prepared.encMeta;
      wrapInfo = prepared.wrapInfo;
      mediaKey = prepared.mediaKey;
      originalIv = prepared.iv;
      byteSizeForIntent = prepared.ciphertextByteSize;
    }

    const intentData = {
      type,
      byteSize: byteSizeForIntent,
      contentType: metadata.contentType,
      originalFilename: metadata.originalFilename,
      encAlgo,
      encMeta,
      takenAt: metadata.takenAt,
      title: metadata.title,
    };

    callbacks?.onPhase?.("Requesting upload");
    const intent = await mediaApi.createUploadIntent(intentData);
    const { media, signedUploadUrl, multipart } = intent;

    const encMetaForPersist =
      encMeta && typeof encMeta === "object" && (encMeta as any).v === 2
        ? {
            ...(encMeta as any),
            aad: {
              purpose: "vault-media" as const,
              metaVersion: 2 as const,
              userId,
              mediaId: media.id,
              variant: "original" as const,
            },
          }
        : encMeta;

    const originalAad = buildVaultMediaAadBytes({
      v: 2,
      userId,
      mediaId: media.id,
      variant: "original",
    });

    // Encrypt original bytes now that we have mediaId for AAD.
    callbacks?.onPhase?.("Encrypting");
    if (originalIv) {
      ciphertext = await encryptFileWithKeyIvAndAad({
        file,
        mediaKey,
        iv: originalIv,
        additionalData: originalAad,
      });
    }

    // Integrity hash (SHA-256 of ciphertext) for tamper detection.
    // For the chunked/multipart path, we currently omit this because ciphertext is streamed.
    let sha256CiphertextB64: string | undefined;
    if (ciphertext) {
      try {
        const digest = await crypto.subtle.digest("SHA-256", ciphertext);
        sha256CiphertextB64 = arrayBufferToBase64(digest);
      } catch {
        sha256CiphertextB64 = undefined;
      }
    }

    // Best-effort: cache duration for video tiles (no extra downloads required).
    if (type === "VIDEO") {
      void (async () => {
        const seconds = await extractVideoDurationSecondsFromFile(file);
        if (typeof seconds === "number") {
          setCachedVideoDurationSeconds(media.id, seconds);
        }
      })();
    }

    const uploadCiphertextSinglePut = async () => {
      if (!ciphertext) {
        throw new Error(
          "This upload requires multipart support (large-file streaming encryption is enabled).",
        );
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(signedUploadUrl.method, signedUploadUrl.url, true);

        if (signedUploadUrl.headers) {
          for (const [key, value] of Object.entries(signedUploadUrl.headers)) {
            const lower = key.toLowerCase();
            if (lower === "content-length") continue;
            try {
              xhr.setRequestHeader(key, String(value));
            } catch {}
          }
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            callbacks?.onUploadProgress?.(e.loaded, e.total);
          } else {
            callbacks?.onUploadProgress?.(e.loaded, ciphertext.byteLength);
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed: network error"));

        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            return;
          }
          resolve();
        };

        xhr.send(ciphertext);
      });
    };

    const uploadCiphertextMultipart = async () => {
      const init = await mediaApi.initMultipartUpload(media.id);
      const uploadId = init.uploadId;
      const partSize = init.partSize;

      const completedParts: Array<{ partNumber: number; etag: string }> = [];
      let uploadedSoFar = 0;

      // Chunked encryption path: encrypt & upload per part without buffering the whole ciphertext.
      if (!ciphertext) {
        if (!multipart?.supported) {
          throw new Error(
            "Multipart upload is required for large-file downloads, but storage does not support it.",
          );
        }

        const chunkCount = getChunkCount(encMeta);
        if (chunkCount > 10_000) {
          throw new Error(
            `File is too large for multipart upload with current part size (needs ${chunkCount} parts).`,
          );
        }

        const total = byteSizeForIntent;

        try {
          for (let i = 0; i < chunkCount; i++) {
            const partNumber = i + 1;

            const part = await mediaApi.getMultipartPartUrl({
              mediaId: media.id,
              uploadId,
              partNumber,
            });

            const encryptedChunk = await encryptChunkFromFile({
              file,
              mediaKey,
              encMeta,
              chunkIndex: i,
              additionalData: originalAad,
            });

            // Optional sanity check: keep parts roughly aligned to server recommendation.
            // (S3 allows variable part sizes; this is mostly for avoiding surprises.)
            if (i < chunkCount - 1 && encryptedChunk.byteLength < partSize) {
              // no-op (smaller parts are allowed by S3-compatible storages, but may be inefficient)
            }

            const etag = await new Promise<string>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open(part.uploadUrl.method, part.uploadUrl.url, true);

              if (part.uploadUrl.headers) {
                for (const [key, value] of Object.entries(
                  part.uploadUrl.headers,
                )) {
                  const lower = key.toLowerCase();
                  if (lower === "content-length") continue;
                  try {
                    xhr.setRequestHeader(key, String(value));
                  } catch {}
                }
              }

              const partTotal = encryptedChunk.byteLength;
              xhr.upload.onprogress = (e) => {
                const loaded = typeof e.loaded === "number" ? e.loaded : 0;
                const clamped = Math.max(0, Math.min(partTotal, loaded));
                callbacks?.onUploadProgress?.(uploadedSoFar + clamped, total);
              };

              xhr.onerror = () =>
                reject(new Error("Upload failed: network error"));

              xhr.onload = () => {
                if (xhr.status < 200 || xhr.status >= 300) {
                  reject(
                    new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`),
                  );
                  return;
                }

                const raw =
                  xhr.getResponseHeader("ETag") ||
                  xhr.getResponseHeader("etag");
                if (!raw) {
                  reject(
                    new Error(
                      "Multipart upload failed: missing ETag header (configure bucket CORS to expose ETag)",
                    ),
                  );
                  return;
                }
                resolve(raw);
              };

              xhr.send(encryptedChunk);
            });

            completedParts.push({ partNumber, etag });
            uploadedSoFar += encryptedChunk.byteLength;
            callbacks?.onUploadProgress?.(uploadedSoFar, total);
          }

          await mediaApi.completeMultipartUpload({
            mediaId: media.id,
            uploadId,
            body: { parts: completedParts },
          });
        } catch (err) {
          try {
            await mediaApi.abortMultipartUpload({
              mediaId: media.id,
              uploadId,
            });
          } catch {}
          throw err;
        }

        return;
      }

      // Legacy multipart path: slice precomputed ciphertext ArrayBuffer.
      const total = ciphertext.byteLength;
      const partCount = Math.ceil(total / partSize);

      try {
        for (let i = 0; i < partCount; i++) {
          const partNumber = i + 1;
          const start = i * partSize;
          const end = Math.min(total, start + partSize);
          const chunk = ciphertext.slice(start, end);

          const part = await mediaApi.getMultipartPartUrl({
            mediaId: media.id,
            uploadId,
            partNumber,
          });

          const etag = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(part.uploadUrl.method, part.uploadUrl.url, true);

            if (part.uploadUrl.headers) {
              for (const [key, value] of Object.entries(
                part.uploadUrl.headers,
              )) {
                const lower = key.toLowerCase();
                if (lower === "content-length") continue;
                try {
                  xhr.setRequestHeader(key, String(value));
                } catch {}
              }
            }

            const partTotal = end - start;
            xhr.upload.onprogress = (e) => {
              const loaded = typeof e.loaded === "number" ? e.loaded : 0;
              const clamped = Math.max(0, Math.min(partTotal, loaded));
              callbacks?.onUploadProgress?.(uploadedSoFar + clamped, total);
            };

            xhr.onerror = () =>
              reject(new Error("Upload failed: network error"));

            xhr.onload = () => {
              if (xhr.status < 200 || xhr.status >= 300) {
                reject(
                  new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`),
                );
                return;
              }

              // Needs CORS expose header: ETag
              const raw =
                xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag");
              if (!raw) {
                reject(
                  new Error(
                    "Multipart upload failed: missing ETag header (configure bucket CORS to expose ETag)",
                  ),
                );
                return;
              }
              resolve(raw);
            };

            xhr.send(chunk);
          });

          completedParts.push({ partNumber, etag });
          uploadedSoFar += end - start;
          callbacks?.onUploadProgress?.(uploadedSoFar, total);
        }

        await mediaApi.completeMultipartUpload({
          mediaId: media.id,
          uploadId,
          body: { parts: completedParts },
        });
      } catch (err) {
        // Best-effort abort so we don't leak dangling multipart uploads.
        try {
          await mediaApi.abortMultipartUpload({ mediaId: media.id, uploadId });
        } catch {
          // ignore
        }
        throw err;
      }
    };

    callbacks?.onPhase?.("Uploading");
    const shouldMultipart =
      !!multipart?.supported &&
      typeof multipart.threshold === "number" &&
      ((ciphertext && ciphertext.byteLength >= multipart.threshold) ||
        (!ciphertext && useChunked));

    if (shouldMultipart) {
      await uploadCiphertextMultipart();
    } else {
      await uploadCiphertextSinglePut();
    }

    // Optional thumbnail: now uses a dedicated upload intent so we can AAD-bind to mediaId.
    try {
      const thumb = await generateThumbnail(file, type);
      if (thumb) {
        const thumbPlain = await thumb.blob.arrayBuffer();
        const thumbIv = createAesGcmIv();
        const thumbEncMeta = toAesGcmEncMetaV2(thumbIv, {
          purpose: "vault-media",
          metaVersion: 2,
          userId,
          mediaId: media.id,
          variant: "thumb",
        });
        const thumbAad = buildVaultMediaAadBytes({
          v: 2,
          userId,
          mediaId: media.id,
          variant: "thumb",
        });

        const thumbCiphertext = await encryptPlaintextWithKeyIvAndAad({
          plaintext: thumbPlain,
          mediaKey,
          iv: thumbIv,
          additionalData: thumbAad,
        });

        const thumbIntent = await mediaApi.createThumbnailUploadIntent(
          media.id,
          {
            byteSize: thumbCiphertext.byteLength,
            contentType: thumb.contentType,
            encMeta: thumbEncMeta,
          },
        );

        const { signedThumbnailUploadUrl } = thumbIntent;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            signedThumbnailUploadUrl.method,
            signedThumbnailUploadUrl.url,
            true,
          );

          if (signedThumbnailUploadUrl.headers) {
            for (const [key, value] of Object.entries(
              signedThumbnailUploadUrl.headers,
            )) {
              const lower = key.toLowerCase();
              if (lower === "content-length") continue;
              try {
                xhr.setRequestHeader(key, String(value));
              } catch {}
            }
          }

          xhr.onerror = () =>
            reject(new Error("Thumbnail upload failed: network error"));

          xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(
                new Error(
                  `Thumbnail upload failed: ${xhr.status} ${xhr.statusText}`,
                ),
              );
              return;
            }
            resolve();
          };

          xhr.send(thumbCiphertext);
        });

        // Best-effort: notify API that thumbnail upload completed.
        try {
          await mediaApi.completeThumbnailUpload(media.id, {});
        } catch {
          // ignore
        }
      }
    } catch {
      // Ignore thumbnail failures
    }

    callbacks?.onPhase?.("Finalizing");
    await mediaApi.completeUpload(media.id, {
      ...(sha256CiphertextB64 ? { sha256CiphertextB64 } : {}),
      encMeta: encMetaForPersist,
    });

    await storeMediaKey(media.id, wrapInfo.wrappedKey, wrapInfo.wrapIv);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.borderColor = "var(--accent-primary)";
    e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.borderColor = "var(--border-primary)";
    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.02)";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.borderColor = "var(--border-primary)";
    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.02)";

    const files = Array.from(e.dataTransfer.files);
    const validFiles: File[] = [];
    const newWarnings: string[] = [];

    files.forEach((file) => {
      if (!isAllowedUploadFile(file)) {
        newWarnings.push(
          `Unsupported file type: ${file.name}. Supported documents: PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP.`,
        );
        return;
      }
      const sizeCheck = checkFileSizeWarning(file);
      if (!sizeCheck.ok && sizeCheck.warning) {
        newWarnings.push(sizeCheck.warning);
      }
      validFiles.push(file);
    });

    if (validFiles.length) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      setWarnings((prev) => [...prev, ...newWarnings]);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !uploading && onClose()}
      title={!uploading ? "Upload Media" : undefined}
      maxWidth="480px"
      showCloseButton={!uploading}
    >
      {!uploading ? (
        <>
          <p
            style={{
              fontSize: "0.875rem",
              marginTop: "-8px",
              marginBottom: "24px",
              color: "var(--text-secondary)",
            }}
          >
            Add photos, videos, and documents to your encrypted vault
          </p>

          {success && (
            <div
              className="banner banner-success"
              style={{
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                width: "auto",
                marginBottom: "var(--space-4)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
                <span>{success}</span>
              </div>
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: "2px dashed var(--border-primary)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: "var(--space-5)",
              transition: "all 0.2s ease",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              style={{
                margin: "0 auto var(--space-4)",
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "var(--bg-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p
              style={{
                marginBottom: "var(--space-2)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Drag & drop or click to browse
            </p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
              Photos, videos, and documents up to 200MB are supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-powerpoint,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,text/plain,.txt,text/csv,.csv,application/zip,.zip"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>

          {warnings.length > 0 && (
            <div
              className="banner banner-warning"
              style={{
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                width: "auto",
                marginBottom: "var(--space-4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <svg
                  style={{ flexShrink: 0, marginTop: "2px" }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                    Check file details
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "var(--space-4)",
                      lineHeight: "1.4",
                    }}
                  >
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div style={{ marginBottom: "var(--space-5)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-2)",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ fontWeight: 600 }}>Selected files</span>
                <span>
                  {selectedFiles.length} item
                  {selectedFiles.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-primary)",
                  backgroundColor: "var(--bg-tertiary)",
                }}
              >
                {selectedFiles.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderBottom:
                        i < selectedFiles.length - 1
                          ? "1px solid var(--border-primary)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          backgroundColor: "var(--bg-elevated)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {file.type.startsWith("image/") ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                              ry="2"
                            ></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect
                              x="1"
                              y="5"
                              width="15"
                              height="14"
                              rx="2"
                              ry="2"
                            ></rect>
                          </svg>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {file.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger)",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background-color var(--transition-fast)",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--danger-light)")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                      title="Remove file"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              className="banner banner-danger"
              style={{
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                width: "auto",
                marginBottom: "var(--space-4)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {isOffline && (
            <div
              className="banner banner-warning"
              style={{
                fontSize: "0.875rem",
                padding: "var(--space-3)",
                width: "auto",
                marginBottom: "var(--space-4)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>
                  Check your connection. Uploads are disabled offline.
                </span>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
              paddingTop: "var(--space-2)",
            }}
          >
            <button
              onClick={onClose}
              className="btn btn-secondary"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={startUpload}
              disabled={selectedFiles.length === 0 || isOffline}
              className="btn btn-primary"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span>Upload</span>
                {selectedFiles.length > 0 && (
                  <span
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      fontSize: "0.75rem",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {selectedFiles.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
          <div
            style={{
              marginBottom: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-4)",
            }}
          >
            <div
              className="loading-spinner"
              style={{ width: "40px", height: "40px" }}
            />
            <div>
              <h3
                style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}
              >
                Uploading...
              </h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.875rem",
                  marginBottom: "4px",
                }}
              >
                {currentFileIndex + 1} of {selectedFiles.length}:{" "}
                <span style={{ color: "var(--text-primary)" }}>
                  {selectedFiles[currentFileIndex]?.name}
                </span>
              </p>
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "0.75rem",
                  marginTop: 0,
                }}
              >
                {statusText || "Encrypting and syncing to secure storage"}
              </p>
            </div>
          </div>

          <div
            style={{
              height: "6px",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "var(--space-3)",
            }}
          >
            <div
              style={{
                height: "100%",
                backgroundColor: "var(--accent-primary)",
                width: `${progress}%`,
                transition: "width 0.3s ease-out",
              }}
            />
          </div>
          <p
            style={{
              textAlign: "right",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </Modal>
  );
};
