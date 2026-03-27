import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicQrPreviewCard } from "./public-qr-preview-card";

describe("PublicQrPreviewCard", () => {
  it("uses profile language for standard public QR previews", () => {
    render(
      React.createElement(PublicQrPreviewCard, {
        qr: {
          type: "profile",
          code: "abc",
          persona: {
            publicIdentifier: "acme",
            username: "jane",
            fullName: "Jane Doe",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Context first.",
            profilePhotoUrl: null,
          },
        },
      }),
    );

    expect(screen.getByText(/^my dotly$/i)).toBeInTheDocument();
    expect(screen.getByText(/premium first impression/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^@acme$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/scan to open my dotly/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /open my dotly instead of starting with a phone number/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps quick connect previews focused on shared context", () => {
    render(
      React.createElement(PublicQrPreviewCard, {
        qr: {
          type: "quick_connect",
          code: "connect",
          persona: {
            publicIdentifier: "acme",
            username: "jane",
            fullName: "Jane Doe",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Context first.",
            profilePhotoUrl: null,
          },
        },
      }),
    );

    expect(
      screen.getByText(/^connect with me$/i, { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^@acme$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^ready to connect$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/scan to open my dotly, then tap connect with me/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you will see my dotly first/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^connect with me$/i, { selector: "dd" }),
    ).toBeInTheDocument();
  });

  it("shows the canonical handle when QR payloads include a username alias", () => {
    render(
      React.createElement(PublicQrPreviewCard, {
        qr: {
          type: "profile",
          code: "alias",
          persona: {
            publicIdentifier: "acme",
            username: "acme-alias",
            fullName: "Acme Team",
            jobTitle: "Founder",
            companyName: "Dotly",
            tagline: "Context first.",
            profilePhotoUrl: null,
          },
        },
      }),
    );

    expect(
      screen.getByRole("heading", { name: /^@acme$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^@acme-alias$/i }),
    ).not.toBeInTheDocument();
  });
});
