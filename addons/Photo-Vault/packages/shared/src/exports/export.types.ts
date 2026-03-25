export enum ExportScopeType {
  VAULT = 'VAULT',
  ALBUM = 'ALBUM',
  DATE_RANGE = 'DATE_RANGE',
}

export enum ExportStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  READY = 'READY',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export interface ExportManifestItem {
  mediaId: string;
  objectKey: string;
  originalFilename?: string;
  contentType: string;
  byteSize: number;
  /**
   * Encryption metadata required for offline/local decryption tools.
   * These fields are safe to export because they do not include any keys.
   */
  encAlgo?: string;
  encMeta?: import('../crypto/enc-meta.types').VaultEncMeta;
  takenAt?: Date;
  locationText?: string;
  title?: string;
  note?: string;
}

export interface ExportManifest {
  exportId: string;
  /** Owner userId needed for v2 AAD-bound decrypt. */
  ownerUserId: string;
  createdAt: Date;
  items: ExportManifestItem[];
  albums?: Array<{
    albumId: string;
    name: string;
    description?: string;
  }>;
}

export interface ExportResponse {
  id: string;
  userId: string;
  scopeType: ExportScopeType;
  scopeAlbumId?: string;
  scopeFrom?: Date;
  scopeTo?: Date;
  status: ExportStatus;
  errorMessage?: string;
  outputObjectKey?: string;
  outputByteSize?: number;
  readyAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedExportsResponse {
  items: ExportResponse[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ExportDownloadUrlResponse {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
  method: 'GET';
}