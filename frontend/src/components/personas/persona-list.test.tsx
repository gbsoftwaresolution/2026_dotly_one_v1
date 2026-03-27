import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { routes } from "@/lib/constants/routes";

import { PersonaList } from "./persona-list";

describe("PersonaList", () => {
  it("shows a stronger first-run empty state with a setup CTA", () => {
    render(React.createElement(PersonaList, { personas: [] }));

    expect(
      screen.getByRole("heading", { name: /create your first persona/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dotly will prepare the share qr right after you save it/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create first persona/i }),
    ).toHaveAttribute("href", routes.app.createPersona);
  });
});