import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateLifeDocMaskedPrivacyDto {
  @IsBoolean()
  maskedMode!: boolean;

  @IsOptional()
  @IsBoolean()
  maskedHideExpiry?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  aliasTitle?: string | null;
}
