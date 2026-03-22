import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppLoggerService } from "../logging/logging.service";
import {
  AuthMetricsService,
  noopAuthMetricsService,
} from "../../modules/auth/auth-metrics.service";

type SmsConfigurationKey =
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_AUTH_TOKEN"
  | "TWILIO_FROM_PHONE_NUMBER";

export interface SmsConfigurationStatus {
  configured: boolean;
  missingSettings: SmsConfigurationKey[];
}

@Injectable()
export class SmsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    @Optional()
    private readonly authMetricsService: AuthMetricsService = noopAuthMetricsService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.getAccountSid() && this.getAuthToken() && this.getFromPhoneNumber(),
    );
  }

  getConfigurationStatus(): SmsConfigurationStatus {
    const missingSettings: SmsConfigurationKey[] = [];

    if (!this.getAccountSid()) {
      missingSettings.push("TWILIO_ACCOUNT_SID");
    }

    if (!this.getAuthToken()) {
      missingSettings.push("TWILIO_AUTH_TOKEN");
    }

    if (!this.getFromPhoneNumber()) {
      missingSettings.push("TWILIO_FROM_PHONE_NUMBER");
    }

    return {
      configured: missingSettings.length === 0,
      missingSettings,
    };
  }

  async sendOtp(options: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }) {
    if (!this.isConfigured()) {
      this.authMetricsService.recordDelivery(
        "sms",
        "mobile_otp",
        "twilio",
        "provider_unavailable",
      );
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
        await response.text();
        this.authMetricsService.recordDelivery(
          "sms",
          "mobile_otp",
          "twilio",
          "provider_error",
        );
        this.logger.errorWithMeta(
          "Twilio SMS delivery failed",
          {
            status: response.status,
            statusText: response.statusText,
            providerRequestId: this.getProviderRequestId(response),
          },
          undefined,
          "SmsService",
        );
        return false;
      }

      this.authMetricsService.recordDelivery(
        "sms",
        "mobile_otp",
        "twilio",
        "sent",
      );

      return true;
    } catch (error) {
      this.authMetricsService.recordDelivery(
        "sms",
        "mobile_otp",
        "twilio",
        "provider_error",
      );
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

  private getProviderRequestId(response: Response): string | null {
    return (
      response.headers.get("twilio-request-id") ??
      response.headers.get("x-request-id") ??
      response.headers.get("request-id")
    );
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
