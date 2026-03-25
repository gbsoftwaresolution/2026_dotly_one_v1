export enum LifeDocCategory {
  IDENTITY_LEGAL = "IDENTITY_LEGAL",
  MEDICAL = "MEDICAL",
  EDUCATION_CAREER = "EDUCATION_CAREER",
  FINANCIAL_ASSET = "FINANCIAL_ASSET",
}

export enum LifeDocSubcategory {
  PASSPORT = "PASSPORT",
  NATIONAL_ID = "NATIONAL_ID",
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  VISA = "VISA",
  RESIDENCY_PERMIT = "RESIDENCY_PERMIT",
  BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE",
  MARRIAGE_CERTIFICATE = "MARRIAGE_CERTIFICATE",
  DIVORCE_DECREE = "DIVORCE_DECREE",

  MEDICAL_REPORTS = "MEDICAL_REPORTS",
  PRESCRIPTIONS = "PRESCRIPTIONS",
  VACCINATION_RECORDS = "VACCINATION_RECORDS",
  INSURANCE_CARDS = "INSURANCE_CARDS",
  DISABILITY_DOCUMENTS = "DISABILITY_DOCUMENTS",

  DEGREES = "DEGREES",
  CERTIFICATES = "CERTIFICATES",
  TRANSCRIPTS = "TRANSCRIPTS",
  PROFESSIONAL_LICENSES = "PROFESSIONAL_LICENSES",
  EMPLOYMENT_CONTRACTS = "EMPLOYMENT_CONTRACTS",

  INSURANCE_POLICIES = "INSURANCE_POLICIES",
  PROPERTY_DEEDS = "PROPERTY_DEEDS",
  RENTAL_AGREEMENTS = "RENTAL_AGREEMENTS",
  LOAN_AGREEMENTS = "LOAN_AGREEMENTS",
  WILLS = "WILLS",
  POWER_OF_ATTORNEY = "POWER_OF_ATTORNEY",

  // Free-text label provided by user (stored as customSubcategory)
  CUSTOM = "CUSTOM",
}

export enum LifeDocReminderSetting {
  OFF = "OFF",
  EXPIRY_DEFAULT = "EXPIRY_DEFAULT",
  EXPIRY_DEFAULT_AND_MONTHLY_POST = "EXPIRY_DEFAULT_AND_MONTHLY_POST",
}

export enum LifeDocVisibility {
  PRIVATE = "PRIVATE",
  SHARED_WITH_MEMBERS = "SHARED_WITH_MEMBERS",
  GUARDIAN_ACCESSIBLE = "GUARDIAN_ACCESSIBLE",
}

export enum LifeDocAccessRole {
  VIEWER = "VIEWER",
  MANAGER = "MANAGER",
  OWNER = "OWNER",
}

export enum LifeDocStatus {
  ACTIVE = "ACTIVE",
  EXPIRING_SOON = "EXPIRING_SOON",
  EXPIRED = "EXPIRED",
  ARCHIVED = "ARCHIVED",
  REPLACED = "REPLACED",
}

export enum LifeDocRenewalState {
  NOT_REQUIRED = "NOT_REQUIRED",
  UPCOMING = "UPCOMING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  BLOCKED = "BLOCKED",
}

export type LifeDocQuietHours = {
  start?: string | null; // HH:mm
  end?: string | null; // HH:mm
} | null;

export type LifeDocReminderChannels = {
  inApp: boolean;
  // Reserved for future internal support; Phase 2 defaults to in-app only.
  email?: boolean;
  push?: boolean;
};

export interface LifeDocAccessMemberInput {
  userId: string;
  role: Exclude<LifeDocAccessRole, LifeDocAccessRole.OWNER>;
}

export interface LifeDocAccessRolesInput {
  sharedMembers?: LifeDocAccessMemberInput[];
  guardians?: LifeDocAccessMemberInput[];
  notifySharedMembers?: boolean;
}

export interface LifeDocResponse {
  id: string;
  ownerId: string;
  ownerDisplayName?: string | null;
  category: LifeDocCategory;
  subcategory: LifeDocSubcategory;
  customSubcategory?: string | null;
  title: string;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  renewalRequired: boolean;
  renewalState?: LifeDocRenewalState;
  reminderSetting: LifeDocReminderSetting;
  reminderCustomDays?: number[] | null;
  quietHours?: LifeDocQuietHours;
  notifySharedMembers?: boolean;
  lastRemindedAt?: string | null;
  visibility: LifeDocVisibility;
  status: LifeDocStatus;
  versionGroupId: string;
  fileHash: string;
  uploadTimestamp: string;
  createdAt: string;
  updatedAt: string;

  // Derived helper for UI. This is NOT additional stored metadata.
  vaultMediaId: string;

  // Access information for the current viewer.
  viewerRole: LifeDocAccessRole;

  // Phase 2 ultra-privacy (UI + access gate).
  maskedMode?: boolean;
  maskedHideExpiry?: boolean;
  aliasTitle?: string | null;
}

export interface LifeDocListResponse {
  items: LifeDocResponse[];
}

export type LifeDocsTimelineStatusFilter =
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "ARCHIVED";

export type LifeDocsTimelineMonthGroup = {
  month: string; // YYYY-MM
  items: LifeDocResponse[];
};

export interface LifeDocsTimelineResponse {
  months: number;
  groups: LifeDocsTimelineMonthGroup[];
}

export interface LifeDocsRenewalSummaryResponse {
  notRequired: number;
  upcoming: number;
  inProgress: number;
  completed: number;
  blocked: number;
}

export type LifeDocVersionItem = {
  versionId: string;
  uploadTimestamp: string;
  fileHash: string;
  status: LifeDocStatus;
  isLatest: boolean;
};

export type LifeDocVersionsResponse = {
  id: string;
  versionGroupId: string;
  versions: LifeDocVersionItem[];
};

export type LifeDocsFamilyOverviewResponse = {
  myExpiringSoon: number;
  childrenExpiringSoon: number;
  sharedWithMe: number;
  needsRenewal: number;
};

export type LifeDocsSearchResponse = {
  items: LifeDocResponse[];
};
