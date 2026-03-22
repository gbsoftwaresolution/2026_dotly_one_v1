import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsObject,
  IsOptional,
  ValidationArguments,
  ValidationOptions,
  ValidateIf,
  ValidateNested,
  registerDecorator,
} from "class-validator";

import { PersonaSharingMode } from "../../../common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../../../common/enums/persona-smart-card-primary-action.enum";

function RequiresSmartCardConfig(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "requiresSmartCardConfig",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_: unknown, args: ValidationArguments) {
          const dto = args.object as UpdatePersonaSharingDto;

          return (
            dto.sharingMode !== PersonaSharingMode.SmartCard ||
            dto.smartCardConfig !== undefined
          );
        },
        defaultMessage() {
          return "smartCardConfig is required when sharingMode is smart_card";
        },
      },
    });
  };
}

class SmartCardConfigDto {
  @IsDefined()
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
  @RequiresSmartCardConfig()
  sharingMode?: PersonaSharingMode;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => SmartCardConfigDto)
  smartCardConfig?: SmartCardConfigDto | null;
}

export type UpdatePersonaSmartCardConfigDto = SmartCardConfigDto;