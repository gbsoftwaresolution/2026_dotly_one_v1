import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppLoggerService } from "../logging/logging.service";

@Injectable()
export class SmsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.getAccountSid() && this.getAuthToken() && this.getFromPhoneNumber(),
    );
  }

  async sendOtp(options: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }) {
    if (!this.isConfigured()) {
      this.logger.warn(
        "SMS delivery skipped because Twilio is not fully configured",
        "SmsService",
      );
      return false;
    }

    const body = new URLSearchParams({
      To: options.to,
      From: this.getFromPhoneNumber(),
      Body: `Your Dotly verification code is ${options.code}. It expires in ${options.expiresInMinutes} minutes. If you did not request this code, ignore this message.`,
    });

    try {
      const response = await fetch(this.getMessagesUrl(), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.getAccountSid()}:${this.getAuthToken()}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const failureBody = await response.text();
        this.logger.errorWithMeta(
          "Twilio SMS delivery failed",
          {
            status: response.status,
            responseBody: failureBody.slice(0, 500),
          },
          undefined,
          "SmsService",
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.errorWithMeta(
        "Twilio SMS delivery request failed",
        {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: "Unknown SMS delivery error" },
        },
        error instanceof Error ? error.stack : undefined,
        "SmsService",
      );
      return false;
    }
  }

  private getMessagesUrl(): string {
    return `https://api.twilio.com/2010-04-01/Accounts/${this.getAccountSid()}/Messages.json`;
  }

  private getAccountSid(): string {
    return this.configService.get<string>("sms.twilioAccountSid", "");
  }

  private getAuthToken(): string {
    return this.configService.get<string>("sms.twilioAuthToken", "");
  }

  private getFromPhoneNumber(): string {
    return this.configService.get<string>("sms.twilioFromPhoneNumber", "");
  }
}
