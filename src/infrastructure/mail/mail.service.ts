import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppLoggerService } from "../logging/logging.service";

import { buildEmailVerificationTemplate } from "./templates/email-verification.template";

type MailConfigurationKey =
  | "MAILGUN_API_KEY"
  | "MAILGUN_DOMAIN"
  | "MAIL_FROM_EMAIL"
  | "FRONTEND_VERIFICATION_URL_BASE";

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
    return this.getConfigurationStatus().configured;
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
    if (!this.isConfigured()) {
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

  private buildVerificationUrl(token: string): string {
    const url = new URL(this.getFrontendVerificationUrlBase());
    url.searchParams.set("token", token);
    return url.toString();
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
}
