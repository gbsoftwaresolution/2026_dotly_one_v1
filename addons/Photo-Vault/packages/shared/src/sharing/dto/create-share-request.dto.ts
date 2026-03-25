import { IsBase64, IsObject, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class EncryptedMediaKeyDto {
  @IsString()
  mediaId!: string;

  @IsBase64()
  encryptedKey!: string;

  @IsBase64()
  iv!: string;
}

export class CreateShareRequestDto {
  @IsBase64()
  encryptedAlbumKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EncryptedMediaKeyDto)
  encryptedMediaKeys!: EncryptedMediaKeyDto[];

  @IsBase64()
  iv!: string;

  @IsObject()
  kdfParams!: {
    iterations: number;
    hash: string;
    salt: string;
  };

  @IsObject()
  createShareDto!: {
    expiresInDays?: number;
  };
}