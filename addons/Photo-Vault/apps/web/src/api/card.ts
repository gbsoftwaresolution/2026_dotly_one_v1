import { get, post } from "./client";
import type {
  GetPublicCardModeResponse,
  CreateCardContactRequestDto,
  CreateCardContactRequestResponse,
  CardContactRevealResponse,
} from "@booster-vault/shared";

export const cardApi = {
  async getPublicMode(
    publicId: string,
    modeSlug: string,
  ): Promise<GetPublicCardModeResponse> {
    return get(`/v1/card/public/${publicId}/modes/${modeSlug}`);
  },

  async createContactRequest(
    publicId: string,
    modeSlug: string,
    dto: CreateCardContactRequestDto,
  ): Promise<CreateCardContactRequestResponse> {
    const res = await post<{ request: CreateCardContactRequestResponse }>(
      `/v1/card/public/${publicId}/modes/${modeSlug}/contact-requests`,
      dto,
    );
    return res.request;
  },

  async revealContact(
    publicId: string,
    modeSlug: string,
    token: string,
  ): Promise<CardContactRevealResponse> {
    const res = await get<{ contact: CardContactRevealResponse }>(
      `/v1/card/public/${publicId}/modes/${modeSlug}/contact`,
      { headers: { "X-Card-Token": token } },
    );
    return res.contact;
  },

  async downloadVCard(
    publicId: string,
    modeSlug: string,
    token: string,
  ): Promise<Blob> {
    const baseUrl = (
      import.meta.env.VITE_API_URL ?? "http://localhost:4000"
    ).replace(/\/$/, "");
    const url = `${baseUrl}/v1/card/vcard?publicId=${encodeURIComponent(publicId)}&modeSlug=${encodeURIComponent(modeSlug)}`;

    const resp = await fetch(url, { headers: { "X-Card-Token": token } });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(txt || `Failed to download vCard (${resp.status})`);
    }

    return await resp.blob();
  },
};
