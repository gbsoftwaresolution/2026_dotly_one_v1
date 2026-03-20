export type PersonaType = "personal" | "professional" | "business";

export type PersonaAccessMode = "open" | "request" | "private";

export interface PersonaSummary {
  id: string;
  type: PersonaType;
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
  accessMode: PersonaAccessMode;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaInput {
  type: PersonaType;
  username: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  accessMode: PersonaAccessMode;
}

export interface PublicProfile {
  username: string;
  publicUrl: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  tagline: string;
  profilePhotoUrl?: string | null;
  accessMode: PersonaAccessMode;
}
