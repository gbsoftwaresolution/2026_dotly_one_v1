import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MediaType } from '../media.types';
import type { VaultEncMeta } from '../../crypto/enc-meta.types';

export class UploadThumbnailDto {
  @IsNumber()
  @Min(1)
  byteSize!: number;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsNotEmpty()
  @IsObject()
  encMeta!: VaultEncMeta;
}

export class UploadIntentDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsNumber()
  @Min(1)
  byteSize!: number;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsOptional()
  @IsString()
  originalFilename?: string;

  @IsOptional()
  @IsString()
  sha256CiphertextB64?: string;

  @IsString()
  @IsNotEmpty()
  encAlgo!: string;

  @IsNotEmpty()
  encMeta!: VaultEncMeta; // JSON object

  @IsOptional()
  @ValidateNested()
  @Type(() => UploadThumbnailDto)
  thumbnail?: UploadThumbnailDto;

  @IsOptional()
  @Type(() => Date)
  exifTakenAt?: Date;

  @IsOptional()
  @IsNumber()
  exifLat?: number;

  @IsOptional()
  @IsNumber()
  exifLng?: number;

  @IsOptional()
  @Type(() => Date)
  takenAt?: Date;

  @IsOptional()
  @IsString()
  locationText?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  note?: string;
}