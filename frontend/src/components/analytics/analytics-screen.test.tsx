import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getPersona: vi.fn(),
  listPersonas: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<object>("@/lib/api");

  return {
    ...actual,
    analyticsApi: {
      getSummary: mocks.getSummary,
      getPersona: mocks.getPersona,
    },
    personaApi: {
      list: mocks.listPersonas,
    },
  };
});

import { ApiError } from "@/lib/api/client";

import { AnalyticsScreen } from "./analytics-screen";

const personaFixture = {
  id: "persona-1",
  fullName: "Sender Persona",
  username: "sender",
  jobTitle: "Founder",
};

describe("AnalyticsScreen", () => {
  beforeEach(() => {
    mocks.getSummary.mockReset();
    mocks.getPersona.mockReset();
    mocks.listPersonas.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  it("renders analytics summary and persona rows", async () => {
    mocks.getSummary.mockResolvedValue({
      totalProfileViews: 14,
      totalQrScans: 6,
      totalRequests: 4,
      totalApproved: 2,
      totalContacts: 2,
    });
    mocks.listPersonas.mockResolvedValue([personaFixture]);
    mocks.getPersona.mockResolvedValue({
      profileViews: 14,
      qrScans: 6,
      requestsReceived: 4,
      requestsApproved: 2,
      conversionRate: 50,
    });

    render(React.createElement(AnalyticsScreen));

    await waitFor(() => {
      expect(screen.getByText(/profile views/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/sender persona/i)).toBeInTheDocument();
    expect(screen.getByText(/total contacts/i)).toBeInTheDocument();
  });

  it("redirects to login when the session has expired", async () => {
    mocks.getSummary.mockRejectedValue(
      new ApiError("Unauthorized", 401, { message: "Unauthorized" }),
    );
    mocks.listPersonas.mockResolvedValue([]);

    render(React.createElement(AnalyticsScreen));

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/login?next=%2Fapp%2Fanalytics&reason=expired",
      );
    });

    expect(mocks.refresh).toHaveBeenCalled();
  });
});