import React from "react";

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { routes } from "@/lib/constants/routes";

const mocks = vi.hoisted(() => ({
  requireServerSession: vi.fn(),
  getConversationContext: vi.fn(),
  getConnection: vi.fn(),
  getResolvedPermissions: vi.fn(),
  explainResolvedPermissions: vi.fn(),
  getPersona: vi.fn(),
  replace: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
  useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/auth/protected-route", () => ({
  requireServerSession: mocks.requireServerSession,
}));

vi.mock("@/lib/api/connections", () => ({
  getConversationContext: mocks.getConversationContext,
  getConnection: mocks.getConnection,
  getResolvedPermissions: mocks.getResolvedPermissions,
  explainResolvedPermissions: mocks.explainResolvedPermissions,
}));

vi.mock("@/lib/api/persona-api", () => ({
  personaApi: {
    get: mocks.getPersona,
  },
}));

import ConversationDetailsPage from "./page";

describe("AppConversationDetailsPage", () => {
  beforeEach(() => {
    mocks.requireServerSession.mockReset();
    mocks.getConversationContext.mockReset();
    mocks.getConnection.mockReset();
    mocks.getResolvedPermissions.mockReset();
    mocks.explainResolvedPermissions.mockReset();
    mocks.getPersona.mockReset();
    mocks.replace.mockReset();
    mocks.useSearchParams.mockReset();

    mocks.requireServerSession.mockResolvedValue({ accessToken: "token" });
    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("loads via conversation id and shows persona routing context inside the new app shell route", async () => {
    mocks.getConversationContext.mockResolvedValue({
      conversationId: "conversation-1",
      connectionId: "connection-1",
      personaId: "persona-1",
      sourceIdentityId: "source-1",
      targetIdentityId: "target-1",
      conversationType: "PROTECTED_DIRECT",
      conversationStatus: "ACTIVE",
      title: null,
      metadataJson: null,
      lastResolvedAt: null,
      lastPermissionHash: null,
      createdByIdentityId: "source-1",
      createdAt: "2026-03-26T12:00:00Z",
      updatedAt: "2026-03-26T12:15:00Z",
    });
    mocks.getPersona.mockResolvedValue({
      id: "persona-1",
      identityId: "identity-1",
      type: "professional",
      username: "investor-desk",
      publicUrl: "https://dotly.id/investor-desk",
      fullName: "Investor Desk",
      jobTitle: "Investor Relations",
      companyName: "Dotly",
      tagline: null,
      accessMode: "private",
      verifiedOnly: false,
      sharingMode: "controlled",
      smartCardConfig: null,
      publicPhone: null,
      publicWhatsappNumber: null,
      publicEmail: null,
      routingKey: "investor",
      routingDisplayName: "Investor Desk",
      isDefaultRouting: false,
      createdAt: "2026-03-20T12:00:00Z",
      updatedAt: "2026-03-20T12:00:00Z",
    });
    mocks.getConnection.mockResolvedValue({
      id: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      connectionType: "trusted",
      relationshipType: "friend",
      trustState: "restricted",
      status: "active",
      createdByIdentityId: "identity-1",
      createdAt: "2026-03-26T10:00:00.000Z",
      updatedAt: "2026-03-26T10:00:00.000Z",
      targetIdentity: {
        id: "identity-2",
        displayName: "Mary Johnson",
        handle: "mary-johnson",
        identityType: "personal",
        verificationLevel: "basic_verified",
        status: "active",
      },
    });
    mocks.getResolvedPermissions.mockResolvedValue({
      connectionId: "connection-1",
      sourceIdentityId: "identity-1",
      targetIdentityId: "identity-2",
      permissions: {
        "share.location.view": { finalEffect: "deny" },
        "media.document.send": { finalEffect: "allow_with_limits" },
        "ai.summary.generate": { finalEffect: "request_approval" },
        "call.video.initiate": { finalEffect: "deny" },
      },
    });
    mocks.explainResolvedPermissions.mockResolvedValue({
      summaryText:
        "Protected permissions are restricted by backend policy resolution.",
      blockedPermissionKeys: ["share.location.view", "call.video.initiate"],
      protectedPermissionKeys: [
        "share.location.view",
        "media.document.send",
        "ai.summary.generate",
        "call.video.initiate",
      ],
      permissions: [],
    });

    const element = await ConversationDetailsPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
    });

    await act(async () => {
      render(element);
    });

    expect(
      await screen.findByRole("heading", { name: "Chat with Mary Johnson" }),
    ).toBeInTheDocument();
    expect(mocks.requireServerSession).toHaveBeenCalledWith(
      routes.app.conversationDetail("conversation-1"),
    );
    expect(screen.getByRole("link", { name: /back to inbox/i })).toHaveAttribute(
      "href",
      "/app/inbox?persona=persona-1",
    );
    expect(screen.getByText("Persona route")).toBeInTheDocument();
    expect(screen.getByText("Investor Desk")).toBeInTheDocument();
    expect(screen.getByText(/internal route #investor/i)).toBeInTheDocument();
    expect(screen.getByText(/backend enforced/i)).toBeInTheDocument();
    expect(mocks.getConversationContext).toHaveBeenCalledWith("conversation-1");
    expect(mocks.getPersona).toHaveBeenCalledWith("persona-1");
    expect(mocks.getConnection).toHaveBeenCalledWith("connection-1");
  });

  it("shows scoped access copy when the backend rejects the conversation", async () => {
    mocks.getConversationContext.mockRejectedValue(
      new ApiError("Forbidden resource", 403),
    );

    const element = await ConversationDetailsPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
    });

    await act(async () => {
      render(element);
    });

    expect(
      await screen.findByText("Thread outside your scope"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/backend persona and participant access rules/i),
    ).toBeInTheDocument();
  });

  it("redirects to login when the session is expired", async () => {
    mocks.getConversationContext.mockRejectedValue(
      new ApiError("Unauthorized", 401),
    );

    const element = await ConversationDetailsPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
    });

    await act(async () => {
      render(element);
    });

    expect(mocks.replace).toHaveBeenCalledWith(
      "/login?next=%2Fapp%2Fconversations%2Fconversation-1&reason=expired",
    );
  });
});