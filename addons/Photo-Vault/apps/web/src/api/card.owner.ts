import { del, get, post, put } from "./client";
import type {
  ApproveCardContactRequestDto,
  ApproveCardContactRequestResponse,
  CardAttachmentResponse,
  CardModeAnalyticsResponse,
  CardModePublicResponse,
  CreateCardAttachmentDto,
  CreateCardAttachmentResponse,
  CreateCardModeDto,
  ListCardAttachmentsResponse,
  ListCardContactRequestsResponse,
  ListCardModesResponse,
  ReorderCardAttachmentsOrderedDto,
  ReorderCardAttachmentsResponse,
  UpdateCardAttachmentDto,
  UpdateCardAttachmentResponse,
  UpdateCardUsernameDto,
  UpdateCardUsernameResponse,
} from "@booster-vault/shared";

export const cardOwnerApi = {
  async listModes(): Promise<ListCardModesResponse> {
    return get(`/v1/card/modes`);
  },

  async createMode(dto: CreateCardModeDto): Promise<CardModePublicResponse> {
    const res = await post<{ mode: CardModePublicResponse }>(
      `/v1/card/modes`,
      dto,
    );
    return res.mode;
  },

  async listContactRequests(
    modeId: string,
    status?: string,
    limit = 50,
  ): Promise<ListCardContactRequestsResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (limit) params.set("limit", String(limit));
    const q = params.toString() ? `?${params.toString()}` : "";
    return get(`/v1/card/modes/${modeId}/contact-requests${q}`);
  },

  async approveRequest(
    requestId: string,
    dto: ApproveCardContactRequestDto,
  ): Promise<ApproveCardContactRequestResponse> {
    const res = await post<{ grant: ApproveCardContactRequestResponse }>(
      `/v1/card/contact-requests/${requestId}/approve`,
      dto,
    );
    return res.grant;
  },

  async denyRequest(requestId: string): Promise<void> {
    await post(`/v1/card/contact-requests/${requestId}/deny`);
  },

  async revokeGrant(grantId: string): Promise<void> {
    await post(`/v1/card/contact-grants/${grantId}/revoke`);
  },

  async listAttachments(modeId: string): Promise<CardAttachmentResponse[]> {
    const res = await get<ListCardAttachmentsResponse>(
      `/v1/card/modes/${modeId}/attachments`,
    );
    return res.attachments;
  },

  async createAttachment(
    modeId: string,
    dto: CreateCardAttachmentDto,
  ): Promise<CardAttachmentResponse> {
    const res = await post<CreateCardAttachmentResponse>(
      `/v1/card/modes/${modeId}/attachments`,
      dto,
    );
    return res.attachment;
  },

  async updateAttachment(
    attachmentId: string,
    dto: UpdateCardAttachmentDto,
  ): Promise<CardAttachmentResponse> {
    const res = await put<UpdateCardAttachmentResponse>(
      `/v1/card/attachments/${attachmentId}`,
      dto,
    );
    return res.attachment;
  },

  async revokeAttachment(attachmentId: string): Promise<void> {
    await post(`/v1/card/attachments/${attachmentId}/revoke`);
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    await del(`/v1/card/attachments/${attachmentId}`);
  },

  async reorderAttachments(
    modeId: string,
    attachmentIds: string[],
  ): Promise<CardAttachmentResponse[]> {
    const dto: ReorderCardAttachmentsOrderedDto = { attachmentIds };
    const res = await put<ReorderCardAttachmentsResponse>(
      `/v1/card/modes/${modeId}/attachments/reorder`,
      dto,
    );
    return res.attachments;
  },

  async getModeAnalytics(modeId: string): Promise<CardModeAnalyticsResponse> {
    return get(`/v1/card/modes/${modeId}/analytics`);
  },

  async updateUsername(
    dto: UpdateCardUsernameDto,
  ): Promise<UpdateCardUsernameResponse> {
    return put(`/v1/card/username`, dto);
  },
};
