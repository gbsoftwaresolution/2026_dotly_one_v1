import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateSharing: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", () => ({
  personaApi: {
    updateSharing: mocks.updateSharing,
  },
}));

import { PersonaSharingSettingsForm } from "./persona-sharing-settings-form";

const personaFixture = {
  id: "persona-1",
  type: "professional" as const,
  username: "jane",
  publicUrl: "dotly.id/jane",
  fullName: "Jane Doe",
  jobTitle: "Founder",
  companyName: "Dotly",
  tagline: "Trusted identity",
  profilePhotoUrl: null,
  accessMode: "request" as const,
  verifiedOnly: false,
  sharingMode: "controlled" as const,
  smartCardConfig: null,
  sharingCapabilities: {
    hasActiveProfileQr: false,
    primaryActions: {
      requestAccess: true,
      instantConnect: false,
      contactMe: true,
    },
  },
  publicPhone: null,
  publicWhatsappNumber: null,
  publicEmail: null,
  sharingConfigSource: null,
  createdAt: "2026-03-22T08:00:00.000Z",
  updatedAt: "2026-03-22T08:00:00.000Z",
};

describe("PersonaSharingSettingsForm", () => {
  beforeEach(() => {
    mocks.updateSharing.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
  });

  it("shows a collapsed summary first and reveals controls on demand", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    expect(screen.getByText(/sharing mode/i)).toBeInTheDocument();
    expect(
      screen.getByText(/people start with a request before any direct contact details are shown/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /primary action/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /smart card mode/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /customize/i }));

    expect(screen.getByRole("radio", { name: /^Smart Card/i })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));

    expect(
      screen.getByRole("combobox", { name: /primary action/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/public phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/allow call/i)).toBeInTheDocument();
  });

  it("preselects the first supported primary action when smart card mode is enabled", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));

    expect(
      screen.getByRole("combobox", { name: /primary action/i }),
    ).toHaveValue("request_access");
    expect(screen.getByRole("button", { name: /save settings/i })).toBeEnabled();
  });

  it("hides unsupported instant connect until a profile QR exists", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));

    expect(
      screen.getByText(/connect instantly appears after you activate a profile qr code/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /instant connect/i }),
    ).not.toBeInTheDocument();
  });

  it("shows inline validation when enabled actions are missing public values", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /primary action/i }),
      "request_access",
    );
    await user.click(screen.getByLabelText(/allow call/i));
    await user.click(screen.getByLabelText(/allow whatsapp/i));
    await user.click(screen.getByLabelText(/allow email/i));

    expect(screen.getByText(/phone is required to enable call/i)).toBeInTheDocument();
    expect(
      screen.getByText(/whatsapp number is required to enable whatsapp/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/email is required to enable email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save settings/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/public phone/i), "+1 555 123 4567");
    await user.type(
      screen.getByLabelText(/public whatsapp number/i),
      "+1 555 234 5678",
    );
    await user.type(screen.getByLabelText(/public email/i), "jane@example.com");

    expect(
      screen.queryByText(/phone is required to enable call/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/whatsapp number is required to enable whatsapp/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/email is required to enable email/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save settings/i })).toBeEnabled();
  });

  it("blocks malformed public values before save", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /primary action/i }),
      "request_access",
    );
    await user.type(screen.getByLabelText(/public phone/i), "abc");
    await user.type(screen.getByLabelText(/public email/i), "not-an-email");

    expect(
      screen.getByText(/phone must be a valid phone-like number/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/email must be a valid email address/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save settings/i })).toBeDisabled();
  });

  it("requires at least one valid direct action for contact primary action", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /primary action/i }),
      "contact_me",
    );

    expect(
      screen.getByText(/at least one direct action is required for contact/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save settings/i })).toBeDisabled();

    await user.click(screen.getByLabelText(/allow save contact/i));

    expect(
      screen.queryByText(/at least one direct action is required for contact/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save settings/i })).toBeEnabled();
  });

  it("saves the selected smart card configuration", async () => {
    mocks.updateSharing.mockResolvedValue({
      ...personaFixture,
      sharingMode: "smart_card",
      sharingCapabilities: {
        hasActiveProfileQr: true,
        primaryActions: {
          requestAccess: true,
          instantConnect: true,
          contactMe: true,
        },
      },
      smartCardConfig: {
        primaryAction: "instant_connect",
        allowCall: true,
        allowWhatsapp: false,
        allowEmail: true,
        allowVcard: false,
      },
      publicPhone: "+1 555 123 4567",
      publicWhatsappNumber: null,
      publicEmail: "jane@example.com",
      sharingConfigSource: "user_custom",
    });

    const user = userEvent.setup();

    render(
      React.createElement(PersonaSharingSettingsForm, {
        persona: {
          ...personaFixture,
          sharingCapabilities: {
            hasActiveProfileQr: true,
            primaryActions: {
              requestAccess: true,
              instantConnect: true,
              contactMe: true,
            },
          },
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /primary action/i }),
      "instant_connect",
    );
    await user.type(screen.getByLabelText(/public phone/i), "+1 555 123 4567");
    await user.type(screen.getByLabelText(/public email/i), "jane@example.com");
    await user.click(screen.getByLabelText(/allow call/i));
    await user.click(screen.getByLabelText(/allow email/i));
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mocks.updateSharing).toHaveBeenCalledWith("persona-1", {
        sharingMode: "smart_card",
        smartCardConfig: {
          primaryAction: "instant_connect",
          allowCall: true,
          allowWhatsapp: false,
          allowEmail: true,
          allowVcard: false,
        },
        publicPhone: "+1 555 123 4567",
        publicWhatsappNumber: null,
        publicEmail: "jane@example.com",
      });
    });

    expect(await screen.findByText(/sharing settings saved/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /primary action/i })).not.toBeInTheDocument();
  });

  it("preserves smart card selections when switching modes repeatedly", async () => {
    const user = userEvent.setup();

    render(React.createElement(PersonaSharingSettingsForm, { persona: personaFixture }));

    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: /primary action/i }),
      "contact_me",
    );
    await user.type(screen.getByLabelText(/public whatsapp number/i), "+1 555 999 0000");
    await user.click(screen.getByLabelText(/allow whatsapp/i));
    await user.click(screen.getByRole("radio", { name: /^Controlled/i }));
    await user.click(screen.getByRole("radio", { name: /^Smart Card/i }));

    expect(
      screen.getByRole("combobox", { name: /primary action/i }),
    ).toHaveValue("contact_me");
    expect(screen.getByLabelText(/public whatsapp number/i)).toHaveValue(
      "+1 555 999 0000",
    );
    expect(screen.getByLabelText(/allow whatsapp/i)).toBeChecked();
  });

  it("shows the automatic setup hint when the backend marks defaults as system-generated", () => {
    render(
      React.createElement(PersonaSharingSettingsForm, {
        persona: {
          ...personaFixture,
          sharingMode: "smart_card",
          sharingConfigSource: "system_default",
          smartCardConfig: {
            primaryAction: "contact_me",
            allowCall: true,
            allowWhatsapp: false,
            allowEmail: true,
            allowVcard: true,
          },
          publicPhone: "+1 555 123 4567",
          publicEmail: "jane@example.com",
        },
      }),
    );

    expect(
      screen.getByText(/we set this up for you automatically/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/call, email, save contact/i)).toBeInTheDocument();
  });
});