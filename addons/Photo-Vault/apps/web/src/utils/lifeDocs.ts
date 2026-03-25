import type {
  LifeDocAccessRole,
  LifeDocCategory,
  LifeDocReminderSetting,
  LifeDocStatus,
  LifeDocSubcategory,
  LifeDocVisibility,
} from "@booster-vault/shared";

export function canManageLifeDoc(role: LifeDocAccessRole): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function categoryLabel(category: LifeDocCategory): string {
  switch (category) {
    case "IDENTITY_LEGAL":
      return "Identity & Legal";
    case "MEDICAL":
      return "Medical";
    case "EDUCATION_CAREER":
      return "Education & Career";
    case "FINANCIAL_ASSET":
      return "Financial & Assets";
    default:
      return String(category);
  }
}

export function subcategoryLabel(subcategory: LifeDocSubcategory): string {
  const raw = String(subcategory);
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

export function effectiveSubcategoryLabel(
  subcategory: LifeDocSubcategory,
  customSubcategory?: string | null,
): string {
  if (String(subcategory) !== "CUSTOM") return subcategoryLabel(subcategory);
  const v = String(customSubcategory ?? "").trim();
  return v || "Custom";
}

export function statusLabel(status: LifeDocStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "EXPIRING_SOON":
      return "Expiring soon";
    case "EXPIRED":
      return "Expired";
    case "ARCHIVED":
      return "Archived";
    case "REPLACED":
      return "Replaced";
    default:
      return String(status);
  }
}

export function statusColor(status: LifeDocStatus): string {
  switch (status) {
    case "ACTIVE":
      return "var(--success)";
    case "EXPIRING_SOON":
      return "var(--warning)";
    case "EXPIRED":
      return "var(--danger)";
    case "ARCHIVED":
      return "var(--text-secondary)";
    case "REPLACED":
      return "var(--text-secondary)";
    default:
      return "var(--text-secondary)";
  }
}

export function visibilityLabel(visibility: LifeDocVisibility): string {
  switch (visibility) {
    case "PRIVATE":
      return "Private";
    case "SHARED_WITH_MEMBERS":
      return "Shared with members";
    case "GUARDIAN_ACCESSIBLE":
      return "Guardian accessible";
    default:
      return String(visibility);
  }
}

export function reminderSettingLabel(setting: LifeDocReminderSetting): string {
  switch (setting) {
    case "OFF":
      return "Off";
    case "EXPIRY_DEFAULT":
      return "90/30/7/on-expiry";
    case "EXPIRY_DEFAULT_AND_MONTHLY_POST":
      return "90/30/7/on-expiry + monthly";
    default:
      return String(setting);
  }
}
