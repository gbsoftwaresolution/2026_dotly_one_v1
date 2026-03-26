import type { Identity } from "./identity";
import { IdentityType } from "./identity";

export enum ConnectionType {
  Unknown = "unknown",
  Requested = "requested",
  Known = "known",
  Trusted = "trusted",
  InnerCircle = "inner_circle",
  Family = "family",
  Partner = "partner",
  Colleague = "colleague",
  Client = "client",
  Vendor = "vendor",
  VerifiedBusiness = "verified_business",
  AdminManaged = "admin_managed",
  Blocked = "blocked",
  SuspendedRisky = "suspended_risky",
}

export enum TrustState {
  Unverified = "unverified",
  BasicVerified = "basic_verified",
  StrongVerified = "strong_verified",
  TrustedByUser = "trusted_by_user",
  HighRisk = "high_risk",
  Restricted = "restricted",
  Blocked = "blocked",
}

export enum RelationshipType {
  Unknown = "unknown",
  Friend = "friend",
  Partner = "partner",
  FamilyMember = "family_member",
  Colleague = "colleague",
  Client = "client",
  Vendor = "vendor",
  VerifiedBusinessContact = "verified_business_contact",
  InnerCircle = "inner_circle",
  HouseholdService = "household_service",
  SupportAgent = "support_agent",
}

export enum ConnectionStatus {
  Pending = "pending",
  Active = "active",
  Restricted = "restricted",
  Blocked = "blocked",
  Archived = "archived",
}

export enum PermissionEffect {
  Allow = "allow",
  Deny = "deny",
  RequestApproval = "request_approval",
  AllowWithLimits = "allow_with_limits",
}

export interface IdentitySummary {
  id: string;
  displayName: string;
  handle?: string | null;
  identityType: IdentityType;
  verificationLevel: string;
  status: string;
}

export interface IdentityConnection {
  id: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  connectionType: ConnectionType;
  relationshipType: RelationshipType;
  trustState: TrustState;
  status: ConnectionStatus;
  note?: string | null;
  createdByIdentityId: string;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  sourceIdentity?: IdentitySummary;
  targetIdentity?: IdentitySummary;
}

export interface CreateConnectionRequest {
  sourceIdentityId: string;
  targetIdentityId: string;
  connectionType: ConnectionType;
  trustState: TrustState;
  relationshipType?: RelationshipType;
  status: ConnectionStatus;
  createdByIdentityId: string;
  note?: string;
  metadataJson?: Record<string, unknown>;
}

export interface ResolvedPermission {
  effect?: PermissionEffect;
  finalEffect: PermissionEffect;
  limits?: Record<string, unknown>;
  trace?: Record<string, unknown>;
}

export interface ResolvedPermissionsMap {
  connectionId: string;
  sourceIdentityId: string;
  targetIdentityId: string;
  sourceIdentity?: IdentitySummary;
  targetIdentity?: IdentitySummary;
  permissions: Record<string, ResolvedPermission>;
}

export type IdentityConnectionFilters = {
  status?: ConnectionStatus;
};

export type ActiveIdentity = Identity;
