import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  PersonaSharingMode as PrismaPersonaSharingMode,
  ContactRequestStatus as PrismaContactRequestStatus,
  QrStatus as PrismaQrStatus,
  QrType as PrismaQrType,
  Prisma,
} from "../../generated/prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { NotificationType } from "../../common/enums/notification-type.enum";
import { PersonaSmartCardPrimaryAction } from "../../common/enums/persona-smart-card-primary-action.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateRequestReceivedNotificationData } from "../notifications/notification-payloads";
import { VerificationPolicyService } from "../auth/verification-policy.service";

import {
  buildRequestReceivedBody,
  sendContactRequestSelect,
  toApiContactRequestStatus,
  toPrismaContactRequestSourceType,
} from "./contact-request.shared";
import { ContactRequestRecipientPolicyService } from "./contact-request-recipient-policy.service";
import { ContactRequestRetryPolicyService } from "./contact-request-retry-policy.service";
import { ContactRequestSourcePolicyService } from "./contact-request-source-policy.service";
import { CreateContactRequestDto } from "./dto/create-contact-request.dto";
import { RequestRateLimitService } from "./request-rate-limit.service";
import {
  supportsRequestAccessFlow,
  toSafeSmartCardConfig,
} from "../personas/persona-sharing";

function normalizeSharingMode(
  sharingMode: unknown,
): PrismaPersonaSharingMode | null {
  if (
    sharingMode === PrismaPersonaSharingMode.CONTROLLED ||
    sharingMode === PrismaPersonaSharingMode.CONTROLLED.toLowerCase()
  ) {
    return PrismaPersonaSharingMode.CONTROLLED;
  }

  if (
    sharingMode === PrismaPersonaSharingMode.SMART_CARD ||
    sharingMode === PrismaPersonaSharingMode.SMART_CARD.toLowerCase()
  ) {
    return PrismaPersonaSharingMode.SMART_CARD;
  }

  return null;
}

const failClosedVerificationPolicyService: Pick<
  VerificationPolicyService,
  "assertUserIsVerified"
> = {
  assertUserIsVerified: async () => {
    throw new Error("Verification policy service is not configured");
  },
};

@Injectable()
export class ContactRequestCreateService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly recipientPolicyService: ContactRequestRecipientPolicyService,
    private readonly retryPolicyService: ContactRequestRetryPolicyService,
    private readonly sourcePolicyService: ContactRequestSourcePolicyService,
    private readonly requestRateLimitService: RequestRateLimitService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
    private readonly verificationPolicyService: VerificationPolicyService = failClosedVerificationPolicyService as VerificationPolicyService,
  ) {}

  async create(
    userId: string,
    createContactRequestDto: CreateContactRequestDto,
  ) {
    await this.verificationPolicyService.assertUserIsVerified(
      userId,
      "send_contact_request",
    );

    const { fromPersona, targetPersona } =
      await this.recipientPolicyService.resolveEligibleParticipants(
        userId,
        createContactRequestDto.fromPersonaId,
        {
          toPersonaId: createContactRequestDto.toPersonaId,
          toUsername: createContactRequestDto.toUsername ?? null,
        },
      );

    const trustedSource = await this.sourcePolicyService.assertSourceAccess(
      userId,
      fromPersona.id,
      targetPersona.id,
      createContactRequestDto,
    );

    const targetSharingMode = normalizeSharingMode(targetPersona.sharingMode);

    if (
      trustedSource.sourceType === ContactRequestSourceType.Profile &&
      (targetSharingMode === null ||
        !supportsRequestAccessFlow(
          targetSharingMode,
          targetPersona.smartCardConfig,
          {
            hasActiveProfileQr: await this.hasActiveProfileQr(
              targetPersona.id,
              targetPersona.smartCardConfig,
            ),
          },
        ))
    ) {
      throw new ForbiddenException(
        "This profile is not accepting requests at this time.",
      );
    }

    await this.retryPolicyService.assertCanCreateRequest(
      fromPersona.id,
      targetPersona.id,
    );

    const reason = createContactRequestDto.reason ?? null;
    const sourceType = toPrismaContactRequestSourceType(
      trustedSource.sourceType,
    );
    const sourceId = trustedSource.sourceId;

    try {
      const contactRequest =
        await this.requestRateLimitService.reserveAndCreate(
          userId,
          async (tx: Prisma.TransactionClient) => {
            return tx.contactRequest.create({
              data: {
                fromUserId: userId,
                toUserId: targetPersona.userId,
                fromPersonaId: fromPersona.id,
                toPersonaId: targetPersona.id,
                reason,
                sourceType,
                sourceId,
                status: PrismaContactRequestStatus.PENDING,
              },
              select: sendContactRequestSelect,
            });
          },
        );

      await this.analyticsService.trackRequestSent({
        actorUserId: userId,
        personaId: targetPersona.id,
        requestId: contactRequest.id,
        sourceType: sourceType.toLowerCase(),
        sourceId,
      });

      const notificationData: CreateRequestReceivedNotificationData = {
        sourceType: trustedSource.sourceType,
      };

      await this.notificationsService.createSafe({
        userId: targetPersona.userId,
        type:
          trustedSource.sourceType === ContactRequestSourceType.Event
            ? NotificationType.EventRequest
            : NotificationType.RequestReceived,
        title:
          trustedSource.sourceType === ContactRequestSourceType.Event
            ? "Event request"
            : "New request",
        body: buildRequestReceivedBody(
          trustedSource.sourceType,
          fromPersona.fullName ?? "Someone",
        ),
        data: notificationData,
      });

      return {
        id: contactRequest.id,
        status: toApiContactRequestStatus(contactRequest.status),
        createdAt: contactRequest.createdAt,
        toPersona: contactRequest.toPersona,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A pending contact request already exists for this persona",
        );
      }

      throw error;
    }
  }

  private async hasActiveProfileQr(
    personaId: string,
    smartCardConfig: unknown,
  ): Promise<boolean> {
    const config = toSafeSmartCardConfig(smartCardConfig);

    if (
      config?.primaryAction !== PersonaSmartCardPrimaryAction.InstantConnect
    ) {
      return true;
    }

    const activeProfileQr = await this.prismaService.qRAccessToken.findFirst({
      where: {
        personaId,
        type: PrismaQrType.profile,
        status: PrismaQrStatus.active,
      },
      select: {
        id: true,
      },
    });

    return activeProfileQr !== null;
  }
}
