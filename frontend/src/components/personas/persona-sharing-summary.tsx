import { formatPrimaryAction, formatSharingMode } from "@/lib/persona/labels";
import { cn } from "@/lib/utils/cn";
import type {
  PersonaSharingConfigSource,
  PersonaSharingMode,
  PersonaSmartCardPrimaryAction,
} from "@/types/persona";

interface PersonaSharingSummaryProps {
  sharingMode: PersonaSharingMode;
  primaryAction?: PersonaSmartCardPrimaryAction | "" | null;
  publicPhone?: string | null;
  publicWhatsappNumber?: string | null;
  publicEmail?: string | null;
  allowCall?: boolean;
  allowWhatsapp?: boolean;
  allowEmail?: boolean;
  allowVcard?: boolean;
  sharingConfigSource?: PersonaSharingConfigSource | null;
  title?: string;
  className?: string;
}

function trimToNull(value?: string | null): string | null {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getPrimaryActionLabel(
  sharingMode: PersonaSharingMode,
  primaryAction?: PersonaSmartCardPrimaryAction | "" | null,
): string {
  if (sharingMode === "controlled") {
    return "Request Access";
  }

  if (!primaryAction) {
    return "Request Access";
  }

  return formatPrimaryAction(primaryAction);
}

function getAvailableActionsLabel({
  sharingMode,
  primaryAction,
  publicPhone,
  publicWhatsappNumber,
  publicEmail,
  allowCall,
  allowWhatsapp,
  allowEmail,
  allowVcard,
}: Omit<
  PersonaSharingSummaryProps,
  "title" | "className" | "sharingConfigSource"
>): string {
  const availableActions: string[] = [];

  if (allowCall && trimToNull(publicPhone)) {
    availableActions.push("Call");
  }

  if (allowWhatsapp && trimToNull(publicWhatsappNumber)) {
    availableActions.push("WhatsApp");
  }

  if (allowEmail && trimToNull(publicEmail)) {
    availableActions.push("Email");
  }

  if (allowVcard) {
    availableActions.push("Save contact");
  }

  if (availableActions.length > 0) {
    return availableActions.join(", ");
  }

  if (sharingMode === "controlled") {
    return "Requests only";
  }

  if (primaryAction === "request_access") {
    return "Request intro";
  }

  return "Main action only";
}

function getSupportingText({
  sharingMode,
  primaryAction,
  publicPhone,
  publicWhatsappNumber,
  publicEmail,
  allowCall,
  allowWhatsapp,
  allowEmail,
  allowVcard,
}: Omit<
  PersonaSharingSummaryProps,
  "title" | "className" | "sharingConfigSource"
>): string | null {
  const hasDirectActions =
    (allowCall && Boolean(trimToNull(publicPhone))) ||
    (allowWhatsapp && Boolean(trimToNull(publicWhatsappNumber))) ||
    (allowEmail && Boolean(trimToNull(publicEmail))) ||
    Boolean(allowVcard);

  if (sharingMode === "controlled") {
    return "People start with a request before any direct contact details are shown.";
  }

  if (!hasDirectActions && primaryAction === "request_access") {
    return "People can request an intro from your Smart Card when they want a more intentional introduction.";
  }

  return null;
}

export function PersonaSharingSummary({
  sharingMode,
  primaryAction,
  publicPhone,
  publicWhatsappNumber,
  publicEmail,
  allowCall = false,
  allowWhatsapp = false,
  allowEmail = false,
  allowVcard = false,
  sharingConfigSource,
  title = "Sharing setup",
  className,
}: PersonaSharingSummaryProps) {
  const primaryActionTitle = "Main action";
  const primaryActionLabel = getPrimaryActionLabel(sharingMode, primaryAction);
  const availableActionsLabel = getAvailableActionsLabel({
    sharingMode,
    primaryAction,
    publicPhone,
    publicWhatsappNumber,
    publicEmail,
    allowCall,
    allowWhatsapp,
    allowEmail,
    allowVcard,
  });
  const supportingText = getSupportingText({
    sharingMode,
    primaryAction,
    publicPhone,
    publicWhatsappNumber,
    publicEmail,
    allowCall,
    allowWhatsapp,
    allowEmail,
    allowVcard,
  });

  return (
    <section
      className={cn(
        "space-y-4 rounded-3xl border border-border bg-surface/45 p-4 sm:p-5",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {title}
        </p>
        {sharingConfigSource === "system_default" ? (
          <p className="text-sm leading-6 text-muted">
            We set this up for you automatically.
          </p>
        ) : null}
      </div>

      <dl className="space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-background/80 px-4 py-3">
          <dt className="text-sm text-muted">Sharing mode</dt>
          <dd className="text-right text-sm font-semibold text-foreground">
            {formatSharingMode(sharingMode)}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl bg-background/80 px-4 py-3">
          <dt className="text-sm text-muted">{primaryActionTitle}</dt>
          <dd className="text-right text-sm font-semibold text-foreground">
            {primaryActionLabel}
          </dd>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl bg-background/80 px-4 py-3">
          <dt className="text-sm text-muted">Available actions</dt>
          <dd className="text-right text-sm font-semibold text-foreground">
            {availableActionsLabel}
          </dd>
        </div>
      </dl>

      {supportingText ? (
        <p className="text-sm leading-6 text-muted">{supportingText}</p>
      ) : null}
    </section>
  );
}
