import { Transform, Type } from "class-transformer";
import {
  IsEmail,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidationArguments,
  ValidationOptions,
  ValidateIf,
  ValidateNested,
  registerDecorator,
} from "class-validator";

import { PersonaSharingMode } from "../../../common/enums/persona-sharing-mode.enum";
import { PersonaSmartCardPrimaryAction } from "../../../common/enums/persona-smart-card-primary-action.enum";
import { isPhoneLikeValue } from "../persona-sharing";

function toTrimmedNullableString(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function IsPhoneLike(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isPhoneLike",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === "string" && isPhoneLikeValue(value);
        },
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? "value"} must be a valid phone-like string`;
        },
      },
    });
  };
}

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
  @Transform(({ value }) => toTrimmedNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsPhoneLike()
  @MaxLength(32)
  publicPhone?: string | null;

  @IsOptional()
  @Transform(({ value }) => toTrimmedNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsPhoneLike()
  @MaxLength(32)
  publicWhatsappNumber?: string | null;

  @IsOptional()
  @Transform(({ value }) => toTrimmedNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsEmail()
  @MaxLength(254)
  publicEmail?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => SmartCardConfigDto)
  smartCardConfig?: SmartCardConfigDto | null;
}

export type UpdatePersonaSmartCardConfigDto = SmartCardConfigDto;