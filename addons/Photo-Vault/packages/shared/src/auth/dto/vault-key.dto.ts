import { IsBase64, IsObject, IsString } from 'class-validator';

export class UpsertVaultKeyBundleDto {
  @IsBase64()
  encryptedMasterKey!: string;

  @IsBase64()
  iv!: string;

  @IsObject()
  kdfParams!: {
    iterations: number;
    hash: string;
    salt: string;
  };
}

export class VaultKeyBundleStatusResponse {
  enabled!: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(partial: Partial<VaultKeyBundleStatusResponse>) {
    Object.assign(this, partial);
  }
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  newPassword!: string;
}

export class ResetVaultKeyBundleDto {
  @IsString()
  password!: string;
}
