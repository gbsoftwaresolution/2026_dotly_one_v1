import type { PersonaSummary, PublicProfile } from "@/types/persona";

type PublicIdentitySource = Pick<
  PublicProfile,
  "username" | "fullName" | "companyName"
>;

type InternalRouteSource = Pick<
  PersonaSummary,
  "fullName" | "routingDisplayName" | "routingKey" | "isDefaultRouting"
>;

export function formatPublicHandle(publicIdentifier: string): string {
  return `@${publicIdentifier.trim()}`;
}

export function getPublicIdentityLine(source: PublicIdentitySource): string | null {
  const fullName = source.fullName?.trim() || null;
  const companyName = source.companyName?.trim() || null;
  const parts = [fullName, companyName].filter(
    (value): value is string => Boolean(value),
  );

  return parts.length > 0 ? parts.join(" • ") : null;
}

export function getInternalRouteHeadline(persona: InternalRouteSource): string {
  return persona.routingDisplayName?.trim() || persona.fullName.trim();
}

export function getInternalRouteSummary(persona: InternalRouteSource): string {
  if (persona.isDefaultRouting) {
    return "Primary team destination";
  }

  if (persona.routingDisplayName?.trim()) {
    return "Team destination";
  }

  return "Direct persona destination";
}

export function getInternalRouteLabel(persona: InternalRouteSource): string {
  if (persona.isDefaultRouting) {
    return "Default team route";
  }

  if (persona.routingKey?.trim()) {
    return `Internal route #${persona.routingKey.trim()}`;
  }

  return "Persona route";
}