import React from "react";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
  listPasskeys: vi.fn(),
  register: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: mocks.useRouter,
  usePathname: mocks.usePathname,
  useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/api", () => ({
  authApi: {
    listPasskeys: mocks.listPasskeys,
  },
}));

vi.mock("@/lib/passkeys/use-passkey-flow", () => ({
  usePasskeyFlow: () => ({
    supported: true,
    isRegistering: false,
    register: mocks.register,
  }),
}));

import { PostSignupPasskeyPrompt } from "./post-signup-passkey-prompt";

describe("PostSignupPasskeyPrompt", () => {
  const replace = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    mocks.listPasskeys.mockReset();
    mocks.register.mockReset();
    mocks.useRouter.mockReturnValue({ replace });
    mocks.usePathname.mockReturnValue("/app");
    mocks.useSearchParams.mockReturnValue(
      new URLSearchParams("enrollPasskey=1&tab=home"),
    );
  });

  it("renders the prompt when enrollment is requested and no passkey exists", () => {
    render(<PostSignupPasskeyPrompt initialPasskeyCount={0} />);

    expect(
      screen.getByRole("heading", { name: /add your dotly passkey now/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add passkey/i }),
    ).toBeInTheDocument();
  });

  it("dismisses cleanly and strips the one-time query flag", async () => {
    const user = userEvent.setup();

    render(<PostSignupPasskeyPrompt initialPasskeyCount={0} />);

    await user.click(
      screen.getByRole("button", { name: /dismiss passkey setup/i }),
    );

    expect(replace).toHaveBeenCalledWith("/app?tab=home", { scroll: false });
  });

  it("uses the existing registration flow and closes after success", async () => {
    mocks.register.mockResolvedValue({
      verified: true,
      passkey: {
        id: "passkey-1",
        name: "Dotly passkey 1",
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      },
    });

    render(<PostSignupPasskeyPrompt initialPasskeyCount={0} />);

    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledWith("Dotly passkey 1");
    });

    expect(
      screen.getByText(
        /passkey added\. dotly passkey 1 is ready for your next sign-in\./i,
      ),
    ).toBeInTheDocument();

    await waitFor(
      () => {
        expect(replace).toHaveBeenCalledWith("/app?tab=home", {
          scroll: false,
        });
      },
      { timeout: 1500 },
    );
  });

  it("does not render when the user already has a passkey", () => {
    render(<PostSignupPasskeyPrompt initialPasskeyCount={1} />);

    expect(
      screen.queryByRole("heading", { name: /add your dotly passkey now/i }),
    ).not.toBeInTheDocument();
  });
});
