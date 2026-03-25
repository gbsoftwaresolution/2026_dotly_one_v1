import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LifeDocs } from "./LifeDocs";
import { LifeDocDetail } from "./LifeDocDetail";

const lifeDocsApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  getVersions: vi.fn(),
  restoreVersion: vi.fn(),
  setRenewalState: vi.fn(),
  updateReminders: vi.fn(),
  testReminders: vi.fn(),
  updateMaskedPrivacy: vi.fn(),
  archive: vi.fn(),
  replace: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  timeline: vi.fn(),
  search: vi.fn(),
  familyOverview: vi.fn(),
  renewalSummary: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../api/lifeDocs", () => ({
  lifeDocsApi: lifeDocsApiMock,
}));

vi.mock("../components/ToastProvider", () => ({
  useToast: () => ({
    success: vi.fn(),
    danger: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("../api/media", () => ({
  mediaApi: {
    get: vi.fn(),
  },
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(() => resolve()));
}

describe("Life Docs Phase 2 privacy UX", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("LifeDocs list obfuscates title/expiry when masked", async () => {
    lifeDocsApiMock.list.mockResolvedValue({
      items: [
        {
          id: "doc-1",
          ownerId: "u1",
          ownerDisplayName: "Me",
          category: "IDENTITY_LEGAL",
          subcategory: "PASSPORT",
          customSubcategory: null,
          title: "REAL PASSPORT TITLE",
          issuingAuthority: "Gov",
          issueDate: null,
          expiryDate: "2026-12-01",
          renewalRequired: true,
          renewalState: "UPCOMING",
          reminderSetting: "EXPIRY_DEFAULT",
          reminderCustomDays: null,
          quietHours: null,
          notifySharedMembers: false,
          lastRemindedAt: null,
          visibility: "PRIVATE",
          status: "EXPIRING_SOON",
          versionGroupId: "vg",
          fileHash: "h",
          uploadTimestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vaultMediaId: "m",
          viewerRole: "OWNER",
          maskedMode: true,
          maskedHideExpiry: true,
          aliasTitle: "Travel ID",
        },
      ],
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <LifeDocs />
        </MemoryRouter>,
      );
      await flushPromises();
      await flushPromises();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Travel ID");
    expect(text).not.toContain("REAL PASSPORT TITLE");
    expect(text).toContain("MASKED");
    expect(text).toContain("Expiry hidden");
    expect(text).not.toContain("Expires 2026-12-01");
  });

  it("LifeDocDetail starts locked and requires reveal to view", async () => {
    lifeDocsApiMock.get.mockResolvedValue({
      id: "doc-1",
      ownerId: "u1",
      ownerDisplayName: "Me",
      category: "IDENTITY_LEGAL",
      subcategory: "PASSPORT",
      customSubcategory: null,
      title: "REAL TITLE",
      issuingAuthority: "Gov",
      issueDate: null,
      expiryDate: "2026-12-01",
      renewalRequired: true,
      renewalState: "UPCOMING",
      reminderSetting: "EXPIRY_DEFAULT",
      reminderCustomDays: null,
      quietHours: null,
      notifySharedMembers: false,
      lastRemindedAt: null,
      visibility: "PRIVATE",
      status: "EXPIRING_SOON",
      versionGroupId: "vg",
      fileHash: "h",
      uploadTimestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      vaultMediaId: "m",
      viewerRole: "OWNER",
      maskedMode: true,
      maskedHideExpiry: true,
      aliasTitle: "Private ID",
    });

    lifeDocsApiMock.getVersions.mockResolvedValue({
      id: "doc-1",
      versionGroupId: "vg",
      versions: [],
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/apps/life-docs/doc-1"]}>
          <Routes>
            <Route path="/apps/life-docs/:id" element={<LifeDocDetail />} />
          </Routes>
        </MemoryRouter>,
      );
      await flushPromises();
      await flushPromises();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Private ID");
    expect(text).not.toContain("REAL TITLE");
    expect(text).toContain("Reveal to View");
    expect(text).toContain("Expiry hidden");
  });
});
