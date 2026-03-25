import { get } from "./client";

const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("heir_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const heirApi = {
  getReleases: () => get<any[]>("/v1/heir/releases", getHeaders()),
  getRelease: (id: string) => get<any>(`/v1/heir/releases/${id}`, getHeaders()),
  getReleaseItems: (id: string) =>
    get<any[]>(`/v1/heir/releases/${id}/items`, getHeaders()),
  openItem: (releaseId: string, itemId: string) =>
    get<any>(
      `/v1/heir/releases/${releaseId}/items/${itemId}/open`,
      getHeaders(),
    ),
};
