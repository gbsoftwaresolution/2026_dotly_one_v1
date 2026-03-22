import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContactRequestStatus as PrismaContactRequestStatus } from "@prisma/client";

import { ContactRequestStatus } from "../../common/enums/contact-request-status.enum";
import { NotificationType } from "../../common/enums/notification-type.enum";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { BlocksService } from "../blocks/blocks.service";
import { ContactMemoryService } from "../contact-memory/contact-memory.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RelationshipsService } from "../relationships/relationships.service";

import { toSourceLabel } from "./contact-request.shared";

@Injectable()
export class ContactRequestRespondService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly relationshipsService: RelationshipsService,
    private readonly contactMemoryService: ContactMemoryService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async approve(userId: string, requestId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const contactRequest = await tx.contactRequest.findUnique({
        where: {
          id: requestId,
        },
        select: {
          id: true,
          status: true,
          fromUserId: true,
          toUserId: true,
          fromPersonaId: true,
          toPersonaId: true,
          sourceType: true,
          sourceId: true,
          toPersona: {
            select: {
              fullName: true,
            },
          },
        },
      });

      if (!contactRequest) {
        throw new NotFoundException("Contact request not found");
      }

      if (contactRequest.toUserId !== userId) {
        throw new ForbiddenException(
          "You are not allowed to approve this contact request",
        );
      }

      if (contactRequest.status !== PrismaContactRequestStatus.PENDING) {
        throw new ConflictException(
          "Only pending contact requests can be approved",
        );
      }

      await this.blocksService.assertNoInteractionBlock(
        userId,
        contactRequest.fromUserId,
      );

      const respondedAt = new Date();
      const updateResult = await tx.contactRequest.updateMany({
        where: {
          id: contactRequest.id,
          toUserId: userId,
          status: PrismaContactRequestStatus.PENDING,
        },
        data: {
          status: PrismaContactRequestStatus.APPROVED,
          respondedAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          "Only pending contact requests can be approved",
        );
      }

      const relationship =
        await this.relationshipsService.createApprovedRelationship(tx, {
          ownerUserId: contactRequest.toUserId,
          targetUserId: contactRequest.fromUserId,
          ownerPersonaId: contactRequest.toPersonaId,
          targetPersonaId: contactRequest.fromPersonaId,
          sourceType: contactRequest.sourceType,
          sourceId: contactRequest.sourceId,
        });

      await Promise.all([
        this.contactMemoryService.createInitialMemory(tx, {
          relationshipId: relationship.id,
          metAt: respondedAt,
          sourceLabel: toSourceLabel(contactRequest.sourceType),
        }),
        this.relationshipsService.updateInteractionMetadata(
          tx,
          relationship.id,
          respondedAt,
        ),
        relationship.reciprocalRelationshipId
          ? this.relationshipsService.updateInteractionMetadata(
              tx,
              relationship.reciprocalRelationshipId,
              respondedAt,
            )
          : Promise.resolve(null),
      ]);

      await Promise.all([
        this.analyticsService.trackRequestApproved(
          {
            actorUserId: userId,
            personaId: contactRequest.toPersonaId,
            requestId: contactRequest.id,
          },
          tx,
        ),
        this.analyticsService.trackContactCreated(
          {
            actorUserId: userId,
            personaId: contactRequest.toPersonaId,
            relationshipId: relationship.id,
            sourceType: contactRequest.sourceType.toLowerCase(),
            sourceId: contactRequest.sourceId,
          },
          tx,
        ),
      ]);

      await this.notificationsService.createSafe(
        {
          userId: contactRequest.fromUserId,
          type: NotificationType.RequestApproved,
          title: "Request approved",
          body: `${contactRequest.toPersona.fullName} approved your request`,
          data: {
            requestId: contactRequest.id,
            relationshipId: relationship.id,
            toPersonaId: contactRequest.toPersonaId,
          },
        },
        tx,
      );

      return {
        requestId: contactRequest.id,
        status: ContactRequestStatus.Approved,
        relationshipId: relationship.id,
      };
    });
  }

  async reject(userId: string, requestId: string) {
    const contactRequest = await this.prismaService.contactRequest.findUnique({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        toUserId: true,
        status: true,
      },
    });

    if (!contactRequest) {
      throw new NotFoundException("Contact request not found");
    }

    if (contactRequest.toUserId !== userId) {
      throw new ForbiddenException(
        "You are not allowed to reject this contact request",
      );
    }

    if (contactRequest.status !== PrismaContactRequestStatus.PENDING) {
      throw new ConflictException(
        "Only pending contact requests can be rejected",
      );
    }

    const respondedAt = new Date();
    const updateResult = await this.prismaService.contactRequest.updateMany({
      where: {
        id: contactRequest.id,
        toUserId: userId,
        status: PrismaContactRequestStatus.PENDING,
      },
      data: {
        status: PrismaContactRequestStatus.REJECTED,
        respondedAt,
      },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException(
        "Only pending contact requests can be rejected",
      );
    }

    return {
      requestId: contactRequest.id,
      status: ContactRequestStatus.Rejected,
    };
  }
}
