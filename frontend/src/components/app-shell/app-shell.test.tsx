import React from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("@/components/auth/email-verification-banner", () => ({
  EmailVerificationBanner: () =>
    React.createElement("div", null, "EmailVerificationBanner"),
}));

vi.mock("@/components/navigation/bottom-nav", () => ({
  BottomNav: () => React.createElement("div", null, "BottomNav"),
}));

vi.mock("@/components/notifications/notification-badge", () => ({
  NotificationBadge: () =>
    React.createElement("div", null, "NotificationBadge"),
}));

vi.mock("./app-prefetch-bootstrap", () => ({
  AppPrefetchBootstrap: () =>
    React.createElement("div", null, "AppPrefetchBootstrap"),
}));

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
    mocks.usePathname.mockReturnValue("/app/requests");
  });

  it("surfaces the current section description in the premium shell header", () => {
    render(
      <AppShell
        session={{
          isAuthenticated: true,
          isLoading: false,
          user: null,
        }}
      >
        <div>Main content</div>
      </AppShell>,
    );

    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(
      screen.getByText("Keep incoming connections simple and clear."),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-describedby",
      "app-shell-page-meta",
    );
  });
});
