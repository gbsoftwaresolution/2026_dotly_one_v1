import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from "class-validator";

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

  return value;
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

          const remindAt = new Date(value);

          return (
            !Number.isNaN(remindAt.getTime()) &&
            remindAt.getTime() > Date.now()
          );
        },
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? "value"} must be a future ISO datetime`;
        },
      },
    });
  };
}