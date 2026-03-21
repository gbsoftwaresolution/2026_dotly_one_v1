import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();

  return React.createElement(
    "button",
    {
      onClick: toggleTheme,
      type: "button",
    },
    theme,
  );
}

describe("ThemeProvider", () => {
  it("hydrates from the document theme without reintroducing dark mode", async () => {
    document.documentElement.dataset.theme = "luminous";
    document.documentElement.classList.remove("dark");

    render(
      React.createElement(ThemeProvider, null, React.createElement(ThemeProbe)),
    );

    expect(
      screen.getByRole("button", { name: "luminous" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("luminous");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("toggles the theme and keeps document state in sync", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(ThemeProvider, null, React.createElement(ThemeProbe)),
    );

    await user.click(screen.getByRole("button", { name: "onyx" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "luminous" }),
      ).toBeInTheDocument();
    });

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("luminous");
    expect(document.documentElement.dataset.theme).toBe("luminous");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
