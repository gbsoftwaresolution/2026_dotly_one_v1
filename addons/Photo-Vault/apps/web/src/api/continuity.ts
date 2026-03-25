import { get, post, put, del } from "./client";

export const continuityApi = {
  // PACKS
  getPacks: () => get<any[]>("/continuity/packs"),
  getPack: (id: string) => get<any>(`/continuity/packs/${id}`),
  createPack: (data: any) => post("/continuity/packs", data),
  updatePack: (id: string, data: any) => put(`/continuity/packs/${id}`, data),
  deletePack: (id: string) => del(`/continuity/packs/${id}`),
  armPack: (id: string) => post(`/continuity/packs/${id}/arm`, {}),

  // ITEMS
  addItem: (packId: string, data: { lifeDocId: string }) =>
    post(`/continuity/packs/${packId}/items`, data),
  removeItem: (packId: string, itemId: string) =>
    del(`/continuity/packs/${packId}/items/${itemId}`),

  // RECIPIENTS (Pack Level)
  addRecipientToPack: (
    packId: string,
    data: { recipientId: string; role: string },
  ) => post(`/continuity/packs/${packId}/recipients`, data),
  removeRecipientFromPack: (packId: string, recipientId: string) =>
    del(`/continuity/packs/${packId}/recipients/${recipientId}`),

  // POLICIES
  getPolicies: () => get<any[]>("/continuity/policies"),
  getPolicy: (id: string) => get<any>(`/continuity/policies/${id}`),
  createPolicy: (data: any) => post("/continuity/policies", data),
  updatePolicy: (id: string, data: any) =>
    put(`/continuity/policies/${id}`, data),
  deletePolicy: (id: string) => del(`/continuity/policies/${id}`),

  checkIn: (policyId: string) =>
    post(`/continuity/policies/${policyId}/check-in`, {}),

  // RECIPIENTS (Global)
  getRecipients: () => get<any[]>("/continuity/recipients"),
  createRecipient: (data: any) => post("/continuity/recipients", data),
  deleteRecipient: (id: string) => del(`/continuity/recipients/${id}`),

  // RELEASES
  executeRelease: (packId: string) =>
    post("/continuity/releases/execute", { packId }),
  revokeRelease: (releaseId: string) =>
    post(`/continuity/releases/${releaseId}/revoke`, {}),
};
