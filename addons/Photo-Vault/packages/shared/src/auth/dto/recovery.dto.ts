import { IsBase64, IsObject, IsString } from 'class-validator';

export class EnableRecoveryDto {
  @IsBase64()
  encryptedMasterKey!: string;

  @IsBase64()
  iv!: string;

  @IsObject()
  kdfParams!: {
    iterations: number;
    hash: string;
    // Base64-encoded random per-user salt
    salt: string;
  };
}

export class DisableRecoveryDto {
  @IsString()
  password!: string;
}

export class RecoveryStatusResponse {
  enabled!: boolean;
  createdAt?: Date;

  constructor(partial: Partial<RecoveryStatusResponse>) {
    Object.assign(this, partial);
  }
}