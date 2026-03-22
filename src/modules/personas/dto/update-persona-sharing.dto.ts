import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateIf,
  ValidateNested,
} from "class-validator";

import { PersonaSharingMode } from "../../../common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../../../common/enums/persona-smart-card-primary-action.enum";

class SmartCardConfigDto {
  @IsEnum(PersonaSmartCardPrimaryAction)
  primaryAction!: PersonaSmartCardPrimaryAction;

  @IsBoolean()
  allowCall = false;

  @IsBoolean()
  allowWhatsapp = false;

  @IsBoolean()
  allowEmail = false;

  @IsBoolean()
  allowVcard = false;
}

export class UpdatePersonaSharingDto {
  @IsOptional()
  @IsEnum(PersonaSharingMode)
  sharingMode?: PersonaSharingMode;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => SmartCardConfigDto)
  smartCardConfig?: SmartCardConfigDto | null;
}

export type UpdatePersonaSmartCardConfigDto = SmartCardConfigDto;