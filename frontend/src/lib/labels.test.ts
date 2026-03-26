import { describe, expect, it } from "vitest";

import {
  getConnectionStatusLabel,
  getConnectionTypeLabel,
  getPermissionEffectLabel,
  getPermissionKeyLabel,
  getRelationshipTypeLabel,
  getTrustStateColor,
  getTrustStateLabel,
} from "./labels";
import {
  ConnectionStatus,
  ConnectionType,
  PermissionEffect,
  RelationshipType,
  TrustState,
} from "@/types/connection";

describe("labels", () => {
  it("maps trust states to readable labels", () => {
    expect(getTrustStateLabel(TrustState.BasicVerified)).toBe("Verified");
    expect(getTrustStateLabel(TrustState.TrustedByUser)).toBe("Trusted");
    expect(getTrustStateLabel(TrustState.HighRisk)).toBe("High Risk");
  });

  it("maps connection types and relationship types to readable labels", () => {
    expect(getConnectionTypeLabel(ConnectionType.InnerCircle)).toBe(
      "Inner Circle",
    );
    expect(getConnectionTypeLabel(ConnectionType.SuspendedRisky)).toBe(
      "Suspended",
    );
    expect(
      getRelationshipTypeLabel(RelationshipType.VerifiedBusinessContact),
    ).toBe("Verified Business");
    expect(getRelationshipTypeLabel(RelationshipType.HouseholdService)).toBe(
      "Household Service",
    );
  });

  it("maps statuses and permission effects to plain language", () => {
    expect(getConnectionStatusLabel(ConnectionStatus.Restricted)).toBe(
      "Restricted",
    );
    expect(getPermissionEffectLabel(PermissionEffect.Allow)).toBe("Allowed");
    expect(getPermissionEffectLabel(PermissionEffect.Deny)).toBe("Not Allowed");
    expect(getPermissionEffectLabel(PermissionEffect.RequestApproval)).toBe(
      "Needs Approval",
    );
  });

  it("maps known permission keys to human-friendly labels", () => {
    expect(getPermissionKeyLabel("msg.text.send")).toBe("Send text messages");
    expect(getPermissionKeyLabel("media.export")).toBe("Export media");
  });

  it("returns trust badge colors for UI pills", () => {
    expect(getTrustStateColor(TrustState.TrustedByUser)).toBe(
      "bg-emerald-100 text-emerald-800",
    );
    expect(getTrustStateColor(TrustState.Restricted)).toBe(
      "bg-amber-100 text-amber-800",
    );
  });
});
