import { Injectable } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";

export interface Mailer {
  sendVerificationEmail(to: string, verificationUrl: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
  sendLifeDocReminderEmail(
    to: string,
    args: {
      lifeDocId: string;
      title: string;
      expiryDateIso?: string | null;
      kind: string;
      daysBeforeExpiry?: number | null;
      masked?: boolean;
      maskedHideExpiry?: boolean;
      docUrl: string;
    },
  ): Promise<void>;
  
  sendContinuityReleaseEmail(
    to: string,
    args: {
        recipientName: string;
        ownerName: string;
        packName: string;
        accessCode: string; // The "key" or "access code"
        portalUrl: string;
    }
  ): Promise<void>;
}

@Injectable()
export class MailService implements Mailer {
  private readonly mailer: Mailer;

  private readonly logger: LoggerService;

  constructor(
    private readonly configService: ConfigService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService.child({ context: MailService.name });
    const provider = this.configService.mailerProvider;

    switch (provider) {
      case "console":
        this.mailer = new ConsoleMailer(this.logger);
        break;
      case "mailgun":
        this.mailer = new MailgunMailer(this.configService, this.logger);
        break;
      // Add other providers here (e.g., 'sendgrid', 'smtp', etc.)
      default:
        this.logger.warn(
          `Unknown mailer provider: ${provider}, falling back to console`,
        );
        this.mailer = new ConsoleMailer(this.logger);
    }

    this.logger.log(`Using mailer provider: ${provider}`);
  }

  async sendVerificationEmail(
    to: string,
    verificationUrl: string,
  ): Promise<void> {
    try {
      await this.mailer.sendVerificationEmail(to, verificationUrl);
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send verification email to ${to}: ${message}`,
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    try {
      await this.mailer.sendPasswordResetEmail(to, resetUrl);
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send password reset email to ${to}: ${message}`,
      );
      throw error;
    }
  }

  async sendLifeDocReminderEmail(
    to: string,
    args: {
      lifeDocId: string;
      title: string;
      expiryDateIso?: string | null;
      kind: string;
      daysBeforeExpiry?: number | null;
      masked?: boolean;
      maskedHideExpiry?: boolean;
      docUrl: string;
    },
  ): Promise<void> {
    try {
      await this.mailer.sendLifeDocReminderEmail(to, args);
      this.logger.log({ msg: "Life Doc reminder email sent", to, lifeDocId: args.lifeDocId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send Life Doc reminder email to ${to}: ${message}`,
      );
      throw error;
    }
  }

  async sendContinuityReleaseEmail(
    to: string,
    args: {
        recipientName: string;
        ownerName: string;
        packName: string;
        accessCode: string;
        portalUrl: string;
    }
  ): Promise<void> {
    try {
        await this.mailer.sendContinuityReleaseEmail(to, args);
        this.logger.log({ msg: "Continuity release email sent", to, packName: args.packName });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send continuity release email to ${to}: ${message}`);
        throw error;
    }
  }
}

class ConsoleMailer implements Mailer {
  constructor(private readonly logger: LoggerService) {}

  async sendContinuityReleaseEmail(
    to: string,
    args: any,
  ): Promise<void> {
    this.logger.log({
      msg: "[DEV MAILER] Continuity Release",
      to,
      subject: `[Continuity] ${args.ownerName} shared ${args.packName}`,
      ...args,
    });
  }

  async sendVerificationEmail(
    to: string,
    verificationUrl: string,
  ): Promise<void> {
    this.logger.log({
      msg: "[DEV MAILER] Email verification",
      to,
      subject: "Verify your Booster Vault account",
      verificationUrl,
      expiresIn: "24h",
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    this.logger.log({
      msg: "[DEV MAILER] Password reset",
      to,
      subject: "Reset your Booster Vault password",
      resetUrl,
      expiresIn: "1h",
    });
  }

  async sendLifeDocReminderEmail(
    to: string,
    args: {
      lifeDocId: string;
      title: string;
      expiryDateIso?: string | null;
      kind: string;
      daysBeforeExpiry?: number | null;
      masked?: boolean;
      maskedHideExpiry?: boolean;
      docUrl: string;
    },
  ): Promise<void> {
    this.logger.log({
      msg: "[DEV MAILER] Life Doc reminder",
      to,
      subject: "Life Doc reminder",
      ...args,
    });
  }
}

class MailgunMailer implements Mailer {
  private readonly apiKey: string | undefined;
  private readonly domain: string | undefined;
  private readonly baseUrl: string;
  private readonly fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.apiKey = this.configService.mailgunApiKey;
    this.domain = this.configService.mailgunDomain;
    this.baseUrl = this.configService.mailgunBaseUrl.replace(/\/$/, "");
    this.fromEmail = this.configService.mailerFromEmail;

    if (!this.apiKey || !this.domain) {
      this.logger.warn(
        "MAILER_PROVIDER=mailgun but MAILGUN_API_KEY/MAILGUN_DOMAIN not set; falling back to console mailer behavior",
      );
    }
  }

  async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    await this.sendMessage({
      to,
      subject: "Verify your Booster Vault account",
      text: `Verify your email address by visiting:\n\n${verificationUrl}\n\nThis link expires in 24 hours.`,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.sendMessage({
      to,
      subject: "Reset your Booster Vault password",
      text: `Reset your password by visiting:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
    });
  }

  async sendContinuityReleaseEmail(
    to: string,
    args: {
        recipientName: string;
        ownerName: string;
        packName: string;
        accessCode: string;
        portalUrl: string;
    }
  ): Promise<void> {
      const subject = `Booster Vault: ${args.ownerName} has released a Continuity Pack for you`;
      const text = `Hello ${args.recipientName},\n\n` +
        `${args.ownerName} has executed a release for the Continuity Pack: "${args.packName}".\n` +
        `This automated message provides you with the access details required to view the shared documents.\n\n` +
        `Portal URL: ${args.portalUrl}\n` +
        `Access Code: ${args.accessCode}\n\n` +
        `Please navigate to the portal and enter your email address along with this access code.\n\n` +
        `Important: Keep this access code secure.`;
      
      await this.sendMessage({
          to,
          subject,
          text,
          tags: ["continuity-release"]
      });
  }

  async sendLifeDocReminderEmail(
    to: string,
    args: {
      lifeDocId: string;
      title: string;
      expiryDateIso?: string | null;
      kind: string;
      daysBeforeExpiry?: number | null;
      masked?: boolean;
      maskedHideExpiry?: boolean;
      docUrl: string;
    },
  ): Promise<void> {
    const masked = !!args.masked;
    const hideExpiry = !!args.maskedHideExpiry;
    const safeTitle = args.title;

    const subject = masked
      ? "Booster Vault: Life Doc reminder"
      : `Booster Vault: ${args.title} reminder`;

    const lines: string[] = [];
    lines.push(`Reminder for: ${safeTitle}`);
    if (!masked && !hideExpiry && args.expiryDateIso) {
      lines.push(`Expiry date: ${args.expiryDateIso}`);
    } else if (hideExpiry) {
      lines.push("Expiry date: hidden");
    }
    if (typeof args.daysBeforeExpiry === "number" && Number.isFinite(args.daysBeforeExpiry)) {
      lines.push(`Days before expiry: ${args.daysBeforeExpiry}`);
    }
    lines.push("");
    lines.push(`Open in app: ${args.docUrl}`);
    lines.push("");
    lines.push("Reminder assistance only. You remain responsible for renewals.");

    await this.sendMessage({
      to,
      subject,
      text: lines.join("\n"),
      tags: ["life-doc-reminder"],
    });
  }

  private async sendMessage(args: {
    to: string;
    subject: string;
    text: string;
    tags?: string[];
  }): Promise<void> {
    // If Mailgun isn't configured, behave like console mailer (don't throw).
    if (!this.apiKey || !this.domain) {
      this.logger.log({
        msg: "[DEV MAILER] Mailgun not configured; logging instead",
        provider: "mailgun",
        from: this.fromEmail,
        to: args.to,
        subject: args.subject,
        text: args.text,
      });
      return;
    }

    const url = `${this.baseUrl}/v3/${this.domain}/messages`;

    const body = new URLSearchParams({
      from: this.fromEmail,
      to: args.to,
      subject: args.subject,
      text: args.text,
    });

    for (const tag of args.tags ?? []) {
      body.append("o:tag", tag);
    }

    const auth = Buffer.from(`api:${this.apiKey}`, "utf8").toString("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Mailgun send failed (${res.status}): ${text || res.statusText}`);
    }
  }
}
