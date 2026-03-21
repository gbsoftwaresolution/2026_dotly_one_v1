import { ConflictException, Injectable } from "@nestjs/common";
import {
  ContactRequestStatus as PrismaContactRequestStatus,
  Prisma,
} from "@prisma/client";

import { ContactRequestSourceType } from "../../common/enums/contact-request-source-type.enum";
import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { NotificationsService } from "../notifications/notifications.service";
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

const noopVerificationPolicyService: Pick<
  VerificationPolicyService,
  "assertUserIsVerified"
> = {
  assertUserIsVerified: async () => undefined,
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
    private readonly verificationPolicyService: VerificationPolicyService =
      noopVerificationPolicyService as VerificationPolicyService,
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
        createContactRequestDto.toPersonaId,
      );

    await this.retryPolicyService.assertCanCreateRequest(
      userId,
      targetPersona.userId,
    );

    await this.sourcePolicyService.assertSourceAccess(
      userId,
      fromPersona.id,
      targetPersona.id,
      createContactRequestDto,
    );

    const reason = createContactRequestDto.reason ?? null;

    try {
      const sourceType = toPrismaContactRequestSourceType(
        createContactRequestDto.sourceType,
      );

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
                sourceId: createContactRequestDto.sourceId ?? null,
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
        sourceId: createContactRequestDto.sourceId ?? null,
      });

      await this.notificationsService.createSafe({
        userId: targetPersona.userId,
        type:
          createContactRequestDto.sourceType === ContactRequestSourceType.Event
            ? NotificationType.EventRequest
            : NotificationType.RequestReceived,
        title:
          createContactRequestDto.sourceType === ContactRequestSourceType.Event
            ? "Event request"
            : "New request",
        body: buildRequestReceivedBody(
          createContactRequestDto.sourceType,
          fromPersona.fullName ?? "Someone",
        ),
        data: {
          requestId: contactRequest.id,
          fromPersonaId: fromPersona.id,
          sourceType: createContactRequestDto.sourceType,
          ...(createContactRequestDto.sourceId
            ? { sourceId: createContactRequestDto.sourceId }
            : {}),
        },
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
}
