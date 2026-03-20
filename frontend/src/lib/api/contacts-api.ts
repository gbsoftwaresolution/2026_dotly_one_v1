import type {
  Contact,
  ContactDetail,
  UpdateContactNoteInput,
  UpdateContactNoteResult,
} from "@/types/contact";

import { apiRequest } from "./client";

export const contactsApi = {
  list: (params?: { sourceType?: string; q?: string }) => {
    const searchParams = new URLSearchParams();

    if (params?.sourceType) {
      searchParams.set("sourceType", params.sourceType);
    }

    if (params?.q) {
      searchParams.set("q", params.q);
    }

    const qs = searchParams.toString();
    const path = qs ? `/api/contacts?${qs}` : "/api/contacts";

    return apiRequest<Contact[]>(path, {
      baseUrl: "",
      credentials: "same-origin",
    });
  },

  getDetail: (relationshipId: string) =>
    apiRequest<ContactDetail>(`/api/contacts/${relationshipId}`, {
      baseUrl: "",
      credentials: "same-origin",
    }),

  updateNote: (relationshipId: string, input: UpdateContactNoteInput) =>
    apiRequest<UpdateContactNoteResult>(
      `/api/contacts/${relationshipId}/note`,
      {
        method: "PATCH",
        body: input,
        baseUrl: "",
        credentials: "same-origin",
      },
    ),
};
