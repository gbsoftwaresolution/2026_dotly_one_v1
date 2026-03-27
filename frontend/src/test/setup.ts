import React from "react";

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3000/v1";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement(
      "a",
      {
        href: typeof href === "string" ? href : String(href),
        ...props,
      },
      children,
    ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: any) =>
    React.createElement("img", {
      alt,
      src: typeof src === "string" ? src : src?.src,
      ...props,
    }),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});
