import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProtectedModeBanner } from "./protected-mode-banner";
import { ProtectedRestrictionsPanel } from "./protected-restrictions-panel";
import { ProtectedActionState } from "./protected-action-state";
import { ProtectedEmptyState } from "./protected-empty-state";
import { PermissionEffect, ResolvedPermissionsMap } from "@/types/connection";
import type { ResolvedPermissionsExplanation } from "@/types/permissions";

const mockPermissionsProtected: ResolvedPermissionsMap = {
  connectionId: "conn-1",
  sourceIdentityId: "1",
  targetIdentityId: "2",
  permissions: {
    "share.location.view": { finalEffect: PermissionEffect.Deny },
    "media.document.send": { finalEffect: PermissionEffect.AllowWithLimits },
    "ai.summary.generate": { finalEffect: PermissionEffect.RequestApproval },
    "call.video.initiate": { finalEffect: PermissionEffect.Deny },
  },
};

const mockPermissionsUnprotected: ResolvedPermissionsMap = {
  connectionId: "conn-1",
  sourceIdentityId: "1",
  targetIdentityId: "2",
  permissions: {
    "share.location.view": { finalEffect: PermissionEffect.Allow },
    "media.document.send": { finalEffect: PermissionEffect.Allow },
    "ai.summary.generate": { finalEffect: PermissionEffect.Allow },
    "call.video.initiate": { finalEffect: PermissionEffect.Allow },
  },
};

const mockExplanation: ResolvedPermissionsExplanation = {
  summaryText:
    "Protected permissions are restricted by backend policy resolution.",
  blockedPermissionKeys: ["share.location.view", "call.video.initiate"],
  protectedPermissionKeys: [
    "share.location.view",
    "media.document.send",
    "ai.summary.generate",
    "call.video.initiate",
  ],
  permissions: [
    {
      key: "media.document.send",
      finalEffect: PermissionEffect.AllowWithLimits,
      explanationText:
        "Exports are limited while protected safeguards are active.",
    },
  ],
};

describe("Protected Mode UX", () => {
  describe("ProtectedModeBanner", () => {
    it("renders when protected", () => {
      render(
        <ProtectedModeBanner
          permissions={mockPermissionsProtected}
          explanation={mockExplanation}
        />,
      );
      expect(screen.getByText("Protected mode active")).toBeInTheDocument();
      expect(
        screen.getByText(/restricted by backend policy resolution/),
      ).toBeInTheDocument();
    });

    it("does not render when unprotected", () => {
      const { container } = render(
        <ProtectedModeBanner permissions={mockPermissionsUnprotected} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("ProtectedRestrictionsPanel", () => {
    it("renders and reflects data states", () => {
      render(
        <ProtectedRestrictionsPanel
          permissions={mockPermissionsProtected}
          explanation={mockExplanation}
        />,
      );

      expect(screen.getByText("Active Restrictions")).toBeInTheDocument();
      expect(
        screen.getByText(/restricted by backend policy resolution/),
      ).toBeInTheDocument();

      // "share.location.view" -> Deny -> "Not Allowed"
      expect(screen.getAllByText("Not Allowed").length).toBeGreaterThan(0);

      // "media.document.send" -> AllowWithLimits -> "Allowed With Limits"
      expect(screen.getByText("Allowed With Limits")).toBeInTheDocument();

      // "ai.summary.generate" -> RequestApproval -> "Needs Approval"
      expect(screen.getByText("Needs Approval")).toBeInTheDocument();
    });
  });

  describe("ProtectedActionState", () => {
    it("renders normally when allowed", () => {
      render(
        <ProtectedActionState effect={PermissionEffect.Allow} label="My Action">
          <button>Click me</button>
        </ProtectedActionState>,
      );
      expect(
        screen.getByRole("button", { name: "Click me" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText(/Action restricted/),
      ).not.toBeInTheDocument();
    });

    it("renders blocked state and shows reason on click", async () => {
      const user = userEvent.setup();
      render(
        <ProtectedActionState
          effect={PermissionEffect.Deny}
          label="My Action"
          reasonText="Blocked for privacy."
        >
          <button>Click me</button>
        </ProtectedActionState>,
      );

      const overlay = screen.getByLabelText("Action restricted: My Action");
      expect(overlay).toBeInTheDocument();

      // Text should not be visible yet
      expect(
        screen.queryByText("Blocked for privacy."),
      ).not.toBeInTheDocument();

      await user.click(overlay);

      expect(screen.getByText("Blocked for safety")).toBeInTheDocument();
      expect(screen.getByText("Blocked for privacy.")).toBeInTheDocument();
    });

    it("renders limited state for AI action", async () => {
      const user = userEvent.setup();
      render(
        <ProtectedActionState
          effect={PermissionEffect.AllowWithLimits}
          label="AI Summary"
          reasonText="Limited in protected conversations."
        >
          <button>AI Reply</button>
        </ProtectedActionState>,
      );

      const overlay = screen.getByLabelText("Action restricted: AI Summary");
      expect(overlay).toBeInTheDocument();

      await user.click(overlay);

      expect(screen.getByText("Ask first")).toBeInTheDocument();
      expect(
        screen.getByText("Limited in protected conversations."),
      ).toBeInTheDocument();
    });
  });

  describe("ProtectedEmptyState", () => {
    it("renders correctly with default props", () => {
      render(<ProtectedEmptyState />);
      expect(
        screen.getByText("Restricted because protected mode is on"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Unavailable until protected mode changes."),
      ).toBeInTheDocument();
    });

    it("renders risk type", () => {
      render(
        <ProtectedEmptyState
          type="risk"
          title="This content is no longer available"
          description="A safety condition was detected."
        />,
      );
      expect(
        screen.getByText("This content is no longer available"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("A safety condition was detected."),
      ).toBeInTheDocument();
    });
  });
});
