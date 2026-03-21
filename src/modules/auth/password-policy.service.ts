import { BadRequestException, Injectable } from "@nestjs/common";

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 72;

@Injectable()
export class PasswordPolicyService {
  validate(password: string, options?: { currentPassword?: string }) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        "Use at least 10 characters for your password.",
      );
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        "Use 72 characters or fewer for your password.",
      );
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
      throw new BadRequestException(
        "Use both uppercase and lowercase letters in your password.",
      );
    }

    if (!/\d/.test(password)) {
      throw new BadRequestException(
        "Add at least one number to strengthen your password.",
      );
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new BadRequestException(
        "Add at least one symbol to strengthen your password.",
      );
    }

    if (options?.currentPassword && password === options.currentPassword) {
      throw new BadRequestException(
        "Choose a new password that is different from your current one.",
      );
    }
  }
}
