import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

export const AUTH_ERROR_MESSAGES = {
  emailAlreadyRegistered: "That email is already registered.",
  invalidCredentials: "Invalid email or password.",
  loginTemporarilyLocked:
    "Too many failed sign-in attempts. Please try again later.",
  signupRateLimit: "Too many sign-up attempts. Please try again later.",
  invalidAuthenticationToken: "Invalid authentication token",
  invalidVerificationLink: "Verification link is invalid or expired",
  verificationEmailCooldown:
    "Please wait before requesting another verification email",
  verificationEmailRateLimit:
    "Too many verification emails requested. Please try again later",
  verificationAttemptRateLimit:
    "Too many verification attempts. Please try again later.",
  currentPasswordIncorrect: "Current password is incorrect.",
  invalidResetLink: "Reset link is invalid or expired",
  mobileNumberAlreadyVerified:
    "That mobile number is already verified on another Dotly account.",
  mobileOtpRequestRequired: "Request a verification code before trying again.",
  mobileOtpInactive:
    "This verification code is no longer active. Request a new one.",
  mobileOtpExpired: "This verification code expired. Request a new one.",
  mobileOtpInvalid: "The verification code you entered is invalid.",
  mobileOtpAttemptCooldown:
    "Please wait before trying another verification code.",
  mobileOtpAttemptRateLimit:
    "Too many incorrect verification codes. Request a new one.",
  mobileOtpVerificationRateLimit:
    "Too many verification attempts. Please request a new code or try again later.",
  passwordResetCooldown:
    "Please wait before requesting another password reset email.",
  passwordResetRateLimit:
    "Too many password reset requests. Please try again later.",
  mobileOtpRequestCooldown:
    "Please wait before requesting another verification code.",
  mobileOtpRequestRateLimit:
    "Too many verification codes requested. Please try again later.",
  currentSessionRevokeBlocked:
    "Use sign out if you want to leave the current device.",
  sessionNotFound: "Session not found.",
} as const;

export function authBadRequest(message: string) {
  return new BadRequestException(message);
}

export function authConflict(message: string) {
  return new ConflictException(message);
}

export function authNotFound(message: string) {
  return new NotFoundException(message);
}

export function authTooManyRequests(message: string) {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

export function authUnauthorized(
  message: string = AUTH_ERROR_MESSAGES.invalidAuthenticationToken,
) {
  return new UnauthorizedException(message);
}