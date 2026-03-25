import type { VaultEncMeta } from '../crypto/enc-meta.types';

export enum MediaType {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export interface SignedUploadUrlResponse {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
  method: 'PUT';
}

export interface SignedDownloadUrlResponse {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
  method: 'GET';
}

export interface MultipartUploadSupport {
  supported: boolean;
  /** Recommended part size in bytes for client uploads. */
  partSize: number;
  /** Minimum part size in bytes (S3 requires 5MiB, except last part). */
  minPartSize: number;
  /** Maximum number of parts (S3 limit is 10,000). */
  maxParts: number;
  /** Suggested threshold (bytes) to switch from single PUT to multipart. */
  threshold: number;
}

export interface MultipartUploadInitResponse {
  uploadId: string;
  partSize: number;
}

export interface MultipartUploadedPart {
  partNumber: number;
  etag: string;
  size?: number;
}

export interface MultipartUploadStatusResponse {
  parts: MultipartUploadedPart[];
}

export interface MultipartUploadPartUrlResponse {
  partNumber: number;
  uploadUrl: SignedUploadUrlResponse;
}

export interface MultipartCompleteRequest {
  parts: Array<{ partNumber: number; etag: string }>;
}

export interface UploadIntentResponse {
  media: MediaResponse;
  signedUploadUrl: SignedUploadUrlResponse;
  signedThumbnailUploadUrl?: SignedUploadUrlResponse;
  multipart?: MultipartUploadSupport;
}

// Note: thumbnail upload completion uses the same payload shape as complete-upload.
export interface CompleteUploadRequest {
  etag?: string;
  sha256CiphertextB64?: string;
  encMeta?: VaultEncMeta;
}

export interface MediaResponse {
  id: string;
  type: MediaType;
  objectKey: string;
  byteSize: number;
  contentType: string;
  encAlgo: string;
  encMeta: VaultEncMeta;

  // Optional encrypted thumbnail (client-generated, uploaded as separate encrypted blob)
  thumbObjectKey?: string;
  thumbByteSize?: number;
  thumbContentType?: string;
  thumbEncMeta?: VaultEncMeta;
  thumbUploadedAt?: Date;

  originalFilename?: string;
  sha256Ciphertext?: string;
  exifTakenAt?: Date;
  exifLat?: number;
  exifLng?: number;
  title?: string;
  note?: string;
  takenAt?: Date;
  locationText?: string;
  isTrashed: boolean;
  trashedAt?: Date;
  purgeAfter?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedMediaResponse {
  items: MediaResponse[];
  nextCursor?: string;
  hasMore: boolean;
}
