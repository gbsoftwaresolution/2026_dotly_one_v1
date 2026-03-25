import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import type {
  ApproveCardContactRequestDto,
  ApproveCardContactRequestResponse,
  CardAttachmentResponse,
  CardModeAnalyticsResponse,
  CardContactRequestStatus,
  CreateCardModeResponse,
  DeleteCardAttachmentResponse,
  ListCardAttachmentsResponse,
  ListCardModeAnalyticsResponse,
  ListCardContactRequestsResponse,
  ListCardModesResponse,
  ReorderCardAttachmentsResponse,
  UpdateCardUsernameResponse,
  RevokeCardAttachmentResponse,
  UpdateCardAttachmentResponse,
} from "@booster-vault/shared";
import {
  CreateCardAttachmentDto,
  CreateCardModeDto,
  ReorderCardAttachmentsDto,
  ReorderCardAttachmentsOrderedDto,
  UpdateCardAttachmentDto,
  UpdateCardUsernameDto,
} from "@booster-vault/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CardService } from "./card.service";

@Controller("card")
@UseGuards(JwtAuthGuard)
export class CardOwnerController {
  constructor(private readonly cardService: CardService) {}

  @Get("modes")
  async listMyModes(
    @Request() req: ExpressRequest,
  ): Promise<ListCardModesResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.listMyModes({ userId });
  }

  @Post("modes")
  @HttpCode(HttpStatus.CREATED)
  async createMode(
    @Request() req: ExpressRequest,
    @Body() dto: CreateCardModeDto,
  ): Promise<CreateCardModeResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.createMode({ userId, dto });
  }

  @Put("username")
  async updateUsername(
    @Request() req: ExpressRequest,
    @Body() dto: UpdateCardUsernameDto,
  ): Promise<UpdateCardUsernameResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.updateMyUsername({ userId, dto });
  }

  @Get("analytics")
  async listMyModeAnalytics(
    @Request() req: ExpressRequest,
  ): Promise<ListCardModeAnalyticsResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.listMyModeAnalytics({ userId });
  }

  @Get("modes/:modeId/analytics")
  async getModeAnalytics(
    @Request() req: ExpressRequest,
    @Param("modeId", ParseUUIDPipe) modeId: string,
  ): Promise<CardModeAnalyticsResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.getModeAnalytics({ userId, modeId });
  }

  @Post("modes/:modeId/attachments")
  @HttpCode(HttpStatus.CREATED)
  async createModeAttachment(
    @Request() req: ExpressRequest,
    @Param("modeId", ParseUUIDPipe) modeId: string,
    @Body() dto: CreateCardAttachmentDto,
  ): Promise<{ attachment: CardAttachmentResponse }> {
    const userId = (req as any).user?.sub;

    const attachment = await this.cardService.createModeAttachment({
      userId,
      modeId,
      dto,
    });

    return { attachment };
  }

  @Get("modes/:modeId/attachments")
  async listModeAttachments(
    @Request() req: ExpressRequest,
    @Param("modeId", ParseUUIDPipe) modeId: string,
  ): Promise<ListCardAttachmentsResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.listModeAttachments({ userId, modeId });
  }

  @Post("modes/:modeId/attachments/reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderModeAttachments(
    @Request() req: ExpressRequest,
    @Param("modeId", ParseUUIDPipe) modeId: string,
    @Body() dto: ReorderCardAttachmentsDto,
  ): Promise<void> {
    const userId = (req as any).user?.sub;
    await this.cardService.reorderModeAttachments({ userId, modeId, dto });
  }

  @Put("modes/:modeId/attachments/reorder")
  async reorderModeAttachmentsOrdered(
    @Request() req: ExpressRequest,
    @Param("modeId", ParseUUIDPipe) modeId: string,
    @Body() dto: ReorderCardAttachmentsOrderedDto,
  ): Promise<ReorderCardAttachmentsResponse> {
    const userId = (req as any).user?.sub;
    return this.cardService.reorderModeAttachmentsOrdered({ userId, modeId, dto });
  }

  @Put("attachments/:attachmentId")
  async updateAttachment(
    @Request() req: ExpressRequest,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Body() dto: UpdateCardAttachmentDto,
  ): Promise<UpdateCardAttachmentResponse> {
    const userId = (req as any).user?.sub;
    const attachment = await this.cardService.updateAttachment({
      userId,
      attachmentId,
      dto,
    });
    return { attachment };
  }

  @Post("attachments/:attachmentId/revoke")
  async revokeAttachment(
    @Request() req: ExpressRequest,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ): Promise<RevokeCardAttachmentResponse> {
    const userId = (req as any).user?.sub;
    await this.cardService.revokeAttachment({ userId, attachmentId });
    return { success: true };
  }

  @Delete("attachments/:attachmentId")
  async deleteAttachment(
    @Request() req: ExpressRequest,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ): Promise<DeleteCardAttachmentResponse> {
    const userId = (req as any).user?.sub;
    await this.cardService.deleteAttachment({ userId, attachmentId });
    return { success: true };
  }

  @Get("modes/:modeId/contact-requests")
  async listModeContactRequests(
    @Request() req: ExpressRequest,
    @Param("modeId", ParseUUIDPipe) modeId: string,
    @Query("status") status?: CardContactRequestStatus,
    @Query("limit") limit?: string,
  ): Promise<ListCardContactRequestsResponse> {
    const userId = (req as any).user?.sub;

    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    return this.cardService.listModeContactRequests({
      userId,
      modeId,
      status,
      limit: parsedLimit,
    });
  }

  @Post("contact-requests/:requestId/approve")
  @HttpCode(HttpStatus.CREATED)
  async approveContactRequest(
    @Request() req: ExpressRequest,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: ApproveCardContactRequestDto,
  ): Promise<{ grant: ApproveCardContactRequestResponse }> {
    const userId = (req as any).user?.sub;

    const grant = await this.cardService.approveContactRequest({
      userId,
      requestId,
      dto,
    });

    return { grant };
  }

  @Post("contact-requests/:requestId/deny")
  @HttpCode(HttpStatus.OK)
  async denyContactRequest(
    @Request() req: ExpressRequest,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ): Promise<{ success: true }> {
    const userId = (req as any).user?.sub;

    await this.cardService.denyContactRequest({ userId, requestId });
    return { success: true };
  }

  @Post("contact-grants/:grantId/revoke")
  @HttpCode(HttpStatus.OK)
  async revokeContactGrant(
    @Request() req: ExpressRequest,
    @Param("grantId", ParseUUIDPipe) grantId: string,
  ): Promise<{ success: true }> {
    const userId = (req as any).user?.sub;

    await this.cardService.revokeContactGrant({ userId, grantId });
    return { success: true };
  }
}
