import { IsBase64, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EncryptedMediaKeyDto } from './create-share-request.dto';

export class UploadShareBundleDto {
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
}