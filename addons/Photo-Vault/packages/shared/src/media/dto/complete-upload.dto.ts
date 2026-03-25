import { IsObject, IsOptional, IsString } from 'class-validator';
import type { VaultEncMeta } from '../../crypto/enc-meta.types';

export class CompleteUploadDto {
  @IsString()
  @IsOptional()
  etag?: string;

  /** Base64-encoded SHA-256 of ciphertext bytes (optional integrity hint). */
  @IsString()
  @IsOptional()
  sha256CiphertextB64?: string;

  /** Optional update of encMeta at completion (e.g., to include v2 AAD fields). */
  @IsObject()
  @IsOptional()
  encMeta?: VaultEncMeta;
}