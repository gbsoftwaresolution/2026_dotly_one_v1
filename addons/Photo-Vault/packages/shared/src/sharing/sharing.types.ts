import { AlbumResponse } from '../albums/album.types';
import type { VaultEncMeta } from '../crypto/enc-meta.types';

export interface SharedAlbumResponse {
  id: string;
  album: AlbumResponse;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShareResponse {
  shareId: string;
  shareLink: string;
  sharePassphrase: string;
  expiresAt: Date;
}

export interface SharedAlbumMetadataResponse {
  shareId: string;
  ownerUserId: string;
  album: AlbumResponse;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface EncryptedShareBundleResponse {
  shareId: string;
  encryptedAlbumKey: string; // base64
  encryptedMediaKeys: Array<{
    mediaId: string;
    encryptedKey: string; // base64
    iv: string; // base64
  }>;
  iv: string; // base64
  kdfParams: {
    iterations: number;
    hash: string;
    salt: string;
  };
  shareAccessToken?: string;
  tokenExpiresAt?: Date;
}

export interface UnlockShareDto {
  passphrase: string;
}

export interface CreateShareStubResponse {
  shareId: string;
  shareLink: string;
  sharePassphrase: string;
  expiresAt: Date;
}

export interface UploadShareBundlePayload {
  encryptedAlbumKey: string; // base64
  encryptedMediaKeys: Array<{
    mediaId: string;
    encryptedKey: string; // base64
    iv: string; // base64
  }>;
  iv: string; // base64
  kdfParams: {
    iterations: number;
    hash: string;
    salt: string;
  };
}

export interface ShareAccessTokenResponse {
  token: string;
  expiresAt: Date;
}

export interface SharedMediaDownloadUrlResponse {
  url: string;
  expiresAt: Date;
  method: string;
  headers?: Record<string, string>;
  media?: {
    id: string;
    ownerUserId: string;
    type: string;
    byteSize: number;
    contentType: string;
    encMeta: VaultEncMeta;
    thumbByteSize?: number;
    thumbContentType?: string;
    thumbEncMeta?: VaultEncMeta;
    thumbUploadedAt?: Date;
    originalFilename?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface SharedMediaMetadataItem {
  id: string;
  ownerUserId: string;
  type: string;
  byteSize: number;
  contentType: string;
  encMeta: VaultEncMeta;
  thumbByteSize?: number;
  thumbContentType?: string;
  thumbEncMeta?: VaultEncMeta;
  thumbUploadedAt?: Date;
  originalFilename?: string;
  exifTakenAt?: Date;
  takenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedMediaMetadataListResponse {
  items: SharedMediaMetadataItem[];
  nextCursor?: number;
}

export interface ShareAnalyticsResponse {
  shareId: string;
  viewCount: number;
  lastViewedAt?: Date;
}