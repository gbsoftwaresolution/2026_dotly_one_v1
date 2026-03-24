import { createHash, randomUUID } from "node:crypto";

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AppLoggerService } from "../../infrastructure/logging/logging.service";
import { MailService } from "../../infrastructure/mail/mail.service";

import { CreateSupportRequestDto } from "./dto/create-support-request.dto";
import { ListSupportRequestsQueryDto } from "./dto/list-support-requests-query.dto";
import { UpdateSupportRequestDto } from "./dto/update-support-request.dto";
import { SupportBotProtectionService } from "./support-bot-protection.service";
import { SupportRateLimitService } from "./support-rate-limit.service";

const SUPPORT_INBOX_EMAIL = "support@dotly.one";
const SUPPORT_REQUEST_STATUS_OPEN = "OPEN";
const SUPPORT_REQUEST_STATUS_RESOLVED = "RESOLVED";
const SUPPORT_DELIVERY_STATUS_SENT = "SENT";
const SUPPORT_DELIVERY_STATUS_LOGGED = "LOGGED";
const SUPPORT_DELIVERY_STATUS_FAILED = "FAILED";
export interface SupportRequestContext {
  requestId?: string;
  userAgent?: string;
  ipAddress?: string | null;
}

export interface SupportRequestResult {
  accepted: true;
  delivery: "sent" | "logged";
  referenceId: string;
}

export interface SupportInboxItem {
  id: string;
  referenceId: string;
  requesterName: string | null;
  requesterEmailMasked: string;
  topic: string;
  details: string;
  status: "open" | "resolved";
  delivery: "sent" | "logged" | "failed";
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface SupportInboxResult {
  requests: SupportInboxItem[];
}

@Injectable()
export class SupportService {
  constructor(
    private readonly mailService: MailService,
    private readonly logger: AppLoggerService,
    private readonly configService: ConfigService,
    private readonly supportRateLimitService: SupportRateLimitService,
    private readonly supportBotProtectionService: SupportBotProtectionService,
    private readonly prismaService: PrismaService,
  ) {}

  async createRequest(
    input: CreateSupportRequestDto,
    context: SupportRequestContext,
  ): Promise<SupportRequestResult> {
    if (input.website?.trim()) {
      throw new ForbiddenException("Support request was rejected");
    }

    const challengePassed = await this.supportBotProtectionService.verify(
      input.challengeToken,
    );

    if (!challengePassed) {
      throw new ForbiddenException("Support request verification failed");
    }

    await this.supportRateLimitService.consume(input.email, context.ipAddress);

    const referenceId = context.requestId?.trim() || randomUUID();
    const delivery = await this.mailService.sendSupportRequest({
      to: SUPPORT_INBOX_EMAIL,
      replyTo: input.email,
      subject: `Dotly support: ${input.topic}`,
      text: this.buildTextBody(input, context, referenceId),
      html: this.buildHtmlBody(input, context, referenceId),
    });

    this.logger.logWithMeta(
      delivery === "sent" ? "log" : "warn",
      delivery === "sent"
        ? "Support request submitted"
        : "Support request logged without email delivery",
      {
        referenceId,
        topic: input.topic,
        replyEmail: input.email,
        hasName: Boolean(input.name),
        detailsLength: input.details.length,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        nodeEnv: this.configService.get<string>("app.nodeEnv", "development"),
      },
      "SupportService",
    );

    if (delivery === "failed") {
      await this.persistRequest(input, context, referenceId, "failed");
      throw new ServiceUnavailableException(
        "Support is temporarily unavailable. Please email support@dotly.one directly.",
      );
    }

    await this.persistRequest(
      input,
      context,
      referenceId,
      delivery === "sent" ? "sent" : "logged",
    );

    return {
      accepted: true,
      delivery: delivery === "sent" ? "sent" : "logged",
      referenceId,
    };
  }

  async listInbox(
    actorEmail: string,
    query: ListSupportRequestsQueryDto,
  ): Promise<SupportInboxResult> {
    this.assertSupportInboxAccess(actorEmail);

    const requests = await (this.prismaService as any).supportRequest.findMany({
      where: {
        ...(query.status
          ? {
              status:
                query.status === "open"
                  ? SUPPORT_REQUEST_STATUS_OPEN
                  : SUPPORT_REQUEST_STATUS_RESOLVED,
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        referenceId: true,
        requesterName: true,
        requesterEmail: true,
        topic: true,
        details: true,
        status: true,
        deliveryStatus: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    return {
      requests: requests.map((request: any) => ({
        id: request.id,
        referenceId: request.referenceId,
        requesterName: request.requesterName,
        requesterEmailMasked: this.maskEmailAddress(request.requesterEmail),
        topic: request.topic,
        details: request.details,
        status:
          request.status === SUPPORT_REQUEST_STATUS_OPEN ? "open" : "resolved",
        delivery: this.toDeliveryResponse(request.deliveryStatus),
        createdAt: request.createdAt,
        resolvedAt: request.resolvedAt,
      })),
    };
  }

  async updateInboxStatus(
    actor: { id: string; email: string },
    supportRequestId: string,
    input: UpdateSupportRequestDto,
  ): Promise<SupportInboxItem> {
    this.assertSupportInboxAccess(actor.email);

    const existing = await (
      this.prismaService as any
    ).supportRequest.findUnique({
      where: { id: supportRequestId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Support request not found");
    }

    const updated = await (this.prismaService as any).supportRequest.update({
      where: { id: supportRequestId },
      data: {
        status:
          input.status === "resolved"
            ? SUPPORT_REQUEST_STATUS_RESOLVED
            : SUPPORT_REQUEST_STATUS_OPEN,
        resolvedAt: input.status === "resolved" ? new Date() : null,
        resolvedByUserId: input.status === "resolved" ? actor.id : null,
      },
      select: {
        id: true,
        referenceId: true,
        requesterName: true,
        requesterEmail: true,
        topic: true,
        details: true,
        status: true,
        deliveryStatus: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    return {
      id: updated.id,
      referenceId: updated.referenceId,
      requesterName: updated.requesterName,
      requesterEmailMasked: this.maskEmailAddress(updated.requesterEmail),
      topic: updated.topic,
      details: updated.details,
      status:
        updated.status === SUPPORT_REQUEST_STATUS_OPEN ? "open" : "resolved",
      delivery: this.toDeliveryResponse(updated.deliveryStatus),
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
    };
  }

  private buildTextBody(
    input: CreateSupportRequestDto,
    context: SupportRequestContext,
    referenceId: string,
  ): string {
    return [
      "New Dotly support request",
      "",
      `Reference ID: ${referenceId}`,
      `Topic: ${input.topic}`,
      `Reply email: ${input.email}`,
      `Name: ${input.name || "Not provided"}`,
      `IP address: ${context.ipAddress || "Unavailable"}`,
      `User agent: ${context.userAgent || "Unavailable"}`,
      "",
      "Details:",
      input.details,
    ].join("\n");
  }

  private buildHtmlBody(
    input: CreateSupportRequestDto,
    context: SupportRequestContext,
    referenceId: string,
  ): string {
    return [
      "<h1>New Dotly support request</h1>",
      "<ul>",
      `<li><strong>Reference ID:</strong> ${escapeHtml(referenceId)}</li>`,
      `<li><strong>Topic:</strong> ${escapeHtml(input.topic)}</li>`,
      `<li><strong>Reply email:</strong> ${escapeHtml(input.email)}</li>`,
      `<li><strong>Name:</strong> ${escapeHtml(input.name || "Not provided")}</li>`,
      `<li><strong>IP address:</strong> ${escapeHtml(context.ipAddress || "Unavailable")}</li>`,
      `<li><strong>User agent:</strong> ${escapeHtml(context.userAgent || "Unavailable")}</li>`,
      "</ul>",
      "<h2>Details</h2>",
      `<pre>${escapeHtml(input.details)}</pre>`,
    ].join("");
  }

  private async persistRequest(
    input: CreateSupportRequestDto,
    context: SupportRequestContext,
    referenceId: string,
    delivery: "sent" | "logged" | "failed",
  ): Promise<void> {
    await (this.prismaService as any).supportRequest.create({
      data: {
        referenceId,
        requesterName: input.name?.trim() || null,
        requesterEmail: input.email,
        topic: input.topic,
        details: input.details,
        deliveryStatus:
          delivery === "sent"
            ? SUPPORT_DELIVERY_STATUS_SENT
            : delivery === "failed"
              ? SUPPORT_DELIVERY_STATUS_FAILED
              : SUPPORT_DELIVERY_STATUS_LOGGED,
        ipAddressHash: context.ipAddress
          ? createHash("sha256").update(context.ipAddress).digest("hex")
          : null,
        userAgent: context.userAgent?.trim() || null,
      },
      select: {
        id: true,
      },
    });
  }

  private assertSupportInboxAccess(email: string): void {
    const allowedEmails = this.configService
      .get<string>("support.inboxAllowedEmails", "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedEmails.includes(email.trim().toLowerCase())) {
      throw new ForbiddenException("Support inbox access is not allowed");
    }
  }

  private maskEmailAddress(email: string): string {
    const [localPart, domain = ""] = email.split("@");

    if (!localPart) {
      return email;
    }

    const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
    const maskedLocalPart =
      localPart.length <= 2
        ? `${visiblePrefix}***`
        : `${visiblePrefix}${"*".repeat(Math.max(2, localPart.length - visiblePrefix.length))}`;

    return domain ? `${maskedLocalPart}@${domain}` : maskedLocalPart;
  }

  private toDeliveryResponse(value: string): "sent" | "logged" | "failed" {
    switch (value) {
      case SUPPORT_DELIVERY_STATUS_SENT:
        return "sent";
      case SUPPORT_DELIVERY_STATUS_FAILED:
        return "failed";
      case SUPPORT_DELIVERY_STATUS_LOGGED:
      default:
        return "logged";
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
