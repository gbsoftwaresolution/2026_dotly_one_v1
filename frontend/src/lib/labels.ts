import {
  ConnectionStatus,
  ConnectionType,
  PermissionEffect,
  RelationshipType,
  TrustState,
} from "@/types/connection";
import { IdentityType } from "@/types/identity";

function startCase(value: string): string {
  return value
    .split(/[._]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getIdentityTypeLabel(type: IdentityType): string {
  switch (type) {
    case IdentityType.Personal:
      return "Personal";
    case IdentityType.Professional:
      return "Professional";
    case IdentityType.Business:
      return "Business";
    case IdentityType.Couple:
      return "Couple";
    case IdentityType.Family:
      return "Family";
    default:
      return startCase(type);
  }
}

export function getTrustStateLabel(state: TrustState): string {
  switch (state) {
    case TrustState.Unverified:
      return "Not Verified";
    case TrustState.BasicVerified:
      return "Verified";
    case TrustState.StrongVerified:
      return "Strongly Verified";
    case TrustState.TrustedByUser:
      return "Trusted";
    case TrustState.HighRisk:
      return "High Risk";
    case TrustState.Restricted:
      return "Restricted";
    case TrustState.Blocked:
      return "Blocked";
    default:
      return startCase(state);
  }
}

export function getConnectionTypeLabel(type: ConnectionType): string {
  switch (type) {
    case ConnectionType.Unknown:
      return "New";
    case ConnectionType.Requested:
      return "Requested";
    case ConnectionType.Known:
      return "Known";
    case ConnectionType.Trusted:
      return "Trusted";
    case ConnectionType.InnerCircle:
      return "Inner Circle";
    case ConnectionType.Family:
      return "Family";
    case ConnectionType.Partner:
      return "Partner";
    case ConnectionType.Colleague:
      return "Colleague";
    case ConnectionType.Client:
      return "Client";
    case ConnectionType.Vendor:
      return "Vendor";
    case ConnectionType.VerifiedBusiness:
      return "Verified Business";
    case ConnectionType.AdminManaged:
      return "Admin Managed";
    case ConnectionType.Blocked:
      return "Blocked";
    case ConnectionType.SuspendedRisky:
      return "Suspended";
    default:
      return startCase(type);
  }
}

export function getRelationshipTypeLabel(type: RelationshipType): string {
  switch (type) {
    case RelationshipType.Unknown:
      return "Not Set";
    case RelationshipType.Friend:
      return "Friend";
    case RelationshipType.Partner:
      return "Partner";
    case RelationshipType.FamilyMember:
      return "Family";
    case RelationshipType.Colleague:
      return "Colleague";
    case RelationshipType.Client:
      return "Client";
    case RelationshipType.Vendor:
      return "Vendor";
    case RelationshipType.VerifiedBusinessContact:
      return "Verified Business";
    case RelationshipType.InnerCircle:
      return "Inner Circle";
    case RelationshipType.HouseholdService:
      return "Household Service";
    case RelationshipType.SupportAgent:
      return "Support Agent";
    default:
      return startCase(type);
  }
}

export function getConnectionStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.Pending:
      return "Pending";
    case ConnectionStatus.Active:
      return "Active";
    case ConnectionStatus.Restricted:
      return "Restricted";
    case ConnectionStatus.Blocked:
      return "Blocked";
    case ConnectionStatus.Archived:
      return "Archived";
    default:
      return startCase(status);
  }
}

export function getPermissionEffectLabel(effect: PermissionEffect): string {
  switch (effect) {
    case PermissionEffect.Allow:
      return "Allowed";
    case PermissionEffect.Deny:
      return "Not Allowed";
    case PermissionEffect.RequestApproval:
      return "Needs Approval";
    case PermissionEffect.AllowWithLimits:
      return "Allowed With Limits";
    default:
      return startCase(effect);
  }
}

export function getPermissionKeyLabel(key: string): string {
  const knownLabels: Record<string, string> = {
    "msg.text.send": "Send text messages",
    "msg.voice.send": "Send voice messages",
    "msg.image.send": "Send photos",
    "msg.video.send": "Send videos",
    "msg.document.send": "Send documents",
    "call.voice.start": "Start voice calls",
    "call.video.start": "Start video calls",
    "call.direct.ring": "Ring directly",
    "media.protected.send": "Send protected media",
    "media.download": "Download media",
    "media.forward": "Forward media",
    "media.export": "Export media",
    "vault.item.attach": "Attach vault items",
    "vault.item.view": "View vault items",
    "vault.item.download": "Download vault items",
    "vault.item.reshare": "Reshare vault items",
    "profile.basic.view": "See basic profile",
    "profile.full.view": "See full profile",
    "profile.phone.view": "See phone number",
    "profile.email.view": "See email address",
    "booking.request.create": "Request bookings",
    "payment.request.create": "Request payments",
    "support.ticket.create": "Create support tickets",
    "ai.summary.use": "Use AI summaries",
    "ai.reply.use": "Use AI reply help",
    "relationship.block": "Block this connection",
    "relationship.report": "Report this connection",
    "relationship.mute": "Mute this connection",
  };

  return knownLabels[key] ?? startCase(key);
}

export function getTrustStateColor(state: TrustState): string {
  switch (state) {
    case TrustState.StrongVerified:
    case TrustState.TrustedByUser:
      return "bg-emerald-100 text-emerald-800";
    case TrustState.BasicVerified:
      return "bg-green-100 text-green-800";
    case TrustState.HighRisk:
    case TrustState.Blocked:
      return "bg-red-100 text-red-800";
    case TrustState.Restricted:
      return "bg-amber-100 text-amber-800";
    case TrustState.Unverified:
    default:
      return "bg-slate-100 text-slate-800";
  }
}
