import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  passkeyHero: vi.fn(),
  authForm: vi.fn(),
}));

vi.mock("@/components/auth/passkey-hero", () => ({
  PasskeyHero: (props: {
    redirectTo: string;
    initialEmail?: string;
    onUsePassword: () => void;
  }) => {
    mocks.passkeyHero(props);

    return React.createElement(
      "button",
      {
        type: "button",
        onClick: props.onUsePassword,
      },
      "use password",
    );
  },
}));

vi.mock("@/components/forms/auth-form", () => ({
  AuthForm: (props: { defaultExpanded?: boolean; title?: string }) => {
    mocks.authForm(props);

    return React.createElement(
      "div",
      null,
      props.defaultExpanded ? "expanded" : "collapsed",
    );
  },
}));

import { LoginAuthPanel } from "./login-auth-panel";

describe("LoginAuthPanel", () => {
  it("opens the password fallback after the hero action requests it", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(LoginAuthPanel, {
        redirectTo: "/app",
        initialEmail: "ava@dotly.one",
      }),
    );

    expect(screen.getByText("collapsed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /use password/i }));

    expect(screen.getByText("expanded")).toBeInTheDocument();
  });
});
