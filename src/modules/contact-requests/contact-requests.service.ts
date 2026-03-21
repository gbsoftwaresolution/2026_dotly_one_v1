import { Injectable, Optional } from "@nestjs/common";
import { ContactRequestStatus as PrismaContactRequestStatus } from "@prisma/client";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  AnalyticsService,
  noopAnalyticsService,
} from "../analytics/analytics.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { EventsService } from "../events/events.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PersonasService } from "../personas/personas.service";
import { RelationshipsService } from "../relationships/relationships.service";
import { VerificationPolicyService } from "../auth/verification-policy.service";

import { ContactRequestCreateService } from "./contact-request-create.service";
import { ContactRequestRecipientPolicyService } from "./contact-request-recipient-policy.service";
import { ContactRequestRespondService } from "./contact-request-respond.service";
import { ContactRequestRetryPolicyService } from "./contact-request-retry-policy.service";
import { ContactRequestSourcePolicyService } from "./contact-request-source-policy.service";
import {
  incomingContactRequestSelect,
  outgoingContactRequestSelect,
  toApiContactRequestSourceType,
  toApiContactRequestStatus,
} from "./contact-request.shared";
import { CreateContactRequestDto } from "./dto/create-contact-request.dto";
import { RequestRateLimitService } from "./request-rate-limit.service";

const noopEventsService: Pick<EventsService, "validateEventRequestAccess"> = {
  validateEventRequestAccess: async () => undefined,
};

const noopNotificationsService: Pick<NotificationsService, "createSafe"> = {
  createSafe: async () => undefined,
};

const noopVerificationPolicyService: Pick<
  VerificationPolicyService,
  "assertUserIsVerified"
> = {
  assertUserIsVerified: async () => undefined,
};

@Injectable()
export class ContactRequestsService {
  private readonly createContactRequestService: Pick<
    ContactRequestCreateService,
    "create"
  >;
  private readonly contactRequestRespondService: Pick<
    ContactRequestRespondService,
    "approve" | "reject"
  >;

  constructor(
    private readonly prismaService: PrismaService,
    personasService: PersonasService,
    private readonly blocksService: BlocksService,
    private readonly relationshipsService: RelationshipsService,
    private readonly contactMemoryService: ContactMemoryService,
    requestRateLimitService: RequestRateLimitService,
    eventsService: EventsService = noopEventsService as EventsService,
    private readonly notificationsService: NotificationsService = noopNotificationsService as NotificationsService,
    private readonly analyticsService: AnalyticsService = noopAnalyticsService as AnalyticsService,
    @Optional()
    recipientPolicyService?: ContactRequestRecipientPolicyService,
    @Optional()
    retryPolicyService?: ContactRequestRetryPolicyService,
    @Optional()
    sourcePolicyService?: ContactRequestSourcePolicyService,
    @Optional()
    createContactRequestService?: ContactRequestCreateService,
    @Optional()
    contactRequestRespondService?: ContactRequestRespondService,
    verificationPolicyService: VerificationPolicyService =
      noopVerificationPolicyService as VerificationPolicyService,
  ) {
    this.createContactRequestService =
      createContactRequestService ??
      new ContactRequestCreateService(
        this.prismaService,
        recipientPolicyService ??
          new ContactRequestRecipientPolicyService(
            this.prismaService,
            personasService,
            this.blocksService,
          ),
        retryPolicyService ??
          new ContactRequestRetryPolicyService(this.prismaService),
        sourcePolicyService ??
          new ContactRequestSourcePolicyService(eventsService),
        requestRateLimitService,
        this.notificationsService,
        this.analyticsService,
        verificationPolicyService,
      );
    this.contactRequestRespondService =
      contactRequestRespondService ??
      new ContactRequestRespondService(
        this.prismaService,
        this.blocksService,
        this.relationshipsService,
        this.contactMemoryService,
        this.notificationsService,
        this.analyticsService,
      );
  }

  async create(
    userId: string,
    createContactRequestDto: CreateContactRequestDto,
  ) {
    return this.createContactRequestService.create(
      userId,
      createContactRequestDto,
    );
  }

  async findIncoming(userId: string) {
    const requests = await this.prismaService.contactRequest.findMany({
      where: {
        toUserId: userId,
        status: PrismaContactRequestStatus.PENDING,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: incomingContactRequestSelect,
    });

    return requests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      reason: request.reason,
      sourceType: toApiContactRequestSourceType(request.sourceType),
      fromPersona: request.fromPersona,
    }));
  }

  async findOutgoing(userId: string) {
    const requests = await this.prismaService.contactRequest.findMany({
      where: {
        fromUserId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: outgoingContactRequestSelect,
    });

    return requests.map((request) => ({
      id: request.id,
      createdAt: request.createdAt,
      status: toApiContactRequestStatus(request.status),
      reason: request.reason,
      toPersona: request.toPersona,
    }));
  }

  async approve(userId: string, requestId: string) {
    return this.contactRequestRespondService.approve(userId, requestId);
  }

  async reject(userId: string, requestId: string) {
    return this.contactRequestRespondService.reject(userId, requestId);
  }
}
