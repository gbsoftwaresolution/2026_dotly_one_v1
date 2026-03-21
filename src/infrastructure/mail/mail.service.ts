import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppLoggerService } from "../logging/logging.service";

import { buildEmailVerificationTemplate } from "./templates/email-verification.template";
import { buildPasswordResetTemplate } from "./templates/password-reset.template";

type MailConfigurationKey =
  | "MAILGUN_API_KEY"
  | "MAILGUN_DOMAIN"
  | "MAIL_FROM_EMAIL"
  | "FRONTEND_VERIFICATION_URL_BASE"
  | "FRONTEND_PASSWORD_RESET_URL_BASE";

export interface MailConfigurationStatus {
  configured: boolean;
  missingSettings: MailConfigurationKey[];
}

@Injectable()
export class MailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  isConfigured(): boolean {
    return this.isEmailVerificationConfigured();
  }

  getConfigurationStatus(): MailConfigurationStatus {
    const missingSettings: MailConfigurationKey[] = [];

    if (!this.getMailgunApiKey()) {
      missingSettings.push("MAILGUN_API_KEY");
    }

    if (!this.getMailgunDomain()) {
      missingSettings.push("MAILGUN_DOMAIN");
    }

    if (!this.getFromEmail()) {
      missingSettings.push("MAIL_FROM_EMAIL");
    }

    if (!this.getFrontendVerificationUrlBase()) {
      missingSettings.push("FRONTEND_VERIFICATION_URL_BASE");
    }

    if (!this.getFrontendPasswordResetUrlBase()) {
      missingSettings.push("FRONTEND_PASSWORD_RESET_URL_BASE");
    }

    return {
      configured: missingSettings.length === 0,
      missingSettings,
    };
  }

  async sendEmailVerification(options: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<boolean> {
    if (!this.isEmailVerificationConfigured()) {
      this.logger.warn(
        "Mail delivery skipped because Mailgun is not fully configured",
        "MailService",
      );
      return false;
    }

    const verificationUrl = this.buildVerificationUrl(options.token);
    const template = buildEmailVerificationTemplate({
      verificationUrl,
      expiresAt: options.expiresAt,
    });
    const form = new URLSearchParams({
      from: this.getFromEmail(),
      to: options.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    try {
      const response = await fetch(this.getMailgunMessagesUrl(), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.getMailgunApiKey()}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      if (!response.ok) {
        const failureBody = await response.text();

        this.logger.errorWithMeta(
          "Mailgun email delivery failed",
          {
            status: response.status,
            recipientDomain: this.getEmailDomain(options.to),
            responseBody: failureBody.slice(0, 500),
          },
          undefined,
          "MailService",
        );

        return false;
      }

      return true;
    } catch (error) {
      this.logger.errorWithMeta(
        "Mailgun email delivery request failed",
        {
          recipientDomain: this.getEmailDomain(options.to),
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: "Unknown mail delivery error" },
        },
        error instanceof Error ? error.stack : undefined,
        "MailService",
      );

      return false;
    }
  }

  async sendPasswordReset(options: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<boolean> {
    if (!this.isPasswordResetConfigured()) {
      this.logger.warn(
        "Password reset email skipped because mail delivery is not fully configured",
        "MailService",
      );
      return false;
    }

    const resetUrl = this.buildPasswordResetUrl(options.token);
    const template = buildPasswordResetTemplate({
      resetUrl,
      expiresAt: options.expiresAt,
    });

    return this.sendMail({
      to: options.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  isEmailVerificationConfigured(): boolean {
    return Boolean(
      this.getMailgunApiKey() &&
      this.getMailgunDomain() &&
      this.getFromEmail() &&
      this.getFrontendVerificationUrlBase(),
    );
  }

  isPasswordResetConfigured(): boolean {
    return Boolean(
      this.getMailgunApiKey() &&
      this.getMailgunDomain() &&
      this.getFromEmail() &&
      this.getFrontendPasswordResetUrlBase(),
    );
  }

  private buildVerificationUrl(token: string): string {
    const url = new URL(this.getFrontendVerificationUrlBase());
    url.searchParams.set("token", token);
    return url.toString();
  }

  private buildPasswordResetUrl(token: string): string {
    const url = new URL(this.getFrontendPasswordResetUrlBase());
    url.searchParams.set("token", token);
    return url.toString();
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<boolean> {
    const form = new URLSearchParams({
      from: this.getFromEmail(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    try {
      const response = await fetch(this.getMailgunMessagesUrl(), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.getMailgunApiKey()}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      if (!response.ok) {
        const failureBody = await response.text();

        this.logger.errorWithMeta(
          "Mailgun email delivery failed",
          {
            status: response.status,
            recipientDomain: this.getEmailDomain(options.to),
            responseBody: failureBody.slice(0, 500),
          },
          undefined,
          "MailService",
        );

        return false;
      }

      return true;
    } catch (error) {
      this.logger.errorWithMeta(
        "Mailgun email delivery request failed",
        {
          recipientDomain: this.getEmailDomain(options.to),
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: "Unknown mail delivery error" },
        },
        error instanceof Error ? error.stack : undefined,
        "MailService",
      );

      return false;
    }
  }

  private getMailgunMessagesUrl(): string {
    return `https://api.mailgun.net/v3/${this.getMailgunDomain()}/messages`;
  }

  private getEmailDomain(email: string): string {
    const parts = email.split("@");
    return parts[1] ?? "unknown";
  }

  private getMailgunApiKey(): string {
    return this.configService.get<string>("mail.mailgunApiKey", "");
  }

  private getMailgunDomain(): string {
    return this.configService.get<string>("mail.mailgunDomain", "");
  }

  private getFromEmail(): string {
    return this.configService.get<string>("mail.fromEmail", "");
  }

  private getFrontendVerificationUrlBase(): string {
    return this.configService.get<string>(
      "mail.frontendVerificationUrlBase",
      "",
    );
  }

  private getFrontendPasswordResetUrlBase(): string {
    return this.configService.get<string>(
      "mail.frontendPasswordResetUrlBase",
      "",
    );
  }
}
