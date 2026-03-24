import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from "class-validator";
import { BadRequestException } from "@nestjs/common";

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function toTrimmedNullableString(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function toTrimmedString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

export function toBooleanQueryValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new BadRequestException("upcoming must be a boolean value");
}

export function IsFutureDateString(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isFutureDateString",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") {
            return false;
          }

          if (!ISO_DATE_TIME_PATTERN.test(value)) {
            return false;
          }

          const remindAt = new Date(value);

          return (
            !Number.isNaN(remindAt.getTime()) &&
            remindAt.getTime() > Date.now()
          );
        },
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? "value"} must be a future ISO 8601 datetime`;
        },
      },
    });
  };
}