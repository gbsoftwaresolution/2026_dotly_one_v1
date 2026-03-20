import { SecondaryButton } from "@/components/shared/secondary-button";
import { cn } from "@/lib/utils/cn";
import type { EventParticipant, EventParticipantRole } from "@/types/event";

interface ParticipantCardProps {
  participant: EventParticipant;
  onRequestAccess?: (participant: EventParticipant) => void;
  isRequesting?: boolean;
}

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function roleTone(
  role: EventParticipantRole,
): "brandRose" | "brandCyan" | "muted" {
  switch (role) {
    case "organizer":
      return "brandRose";
    case "speaker":
      return "brandCyan";
    default:
      return "muted";
  }
}

export function ParticipantCard({
  participant,
  onRequestAccess,
  isRequesting,
}: ParticipantCardProps) {
  const tone = roleTone(participant.role);

  return (
    // 85% scale persona card
    <div className="scale-[0.85] origin-top">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-zinc-900 dark:bg-zinc-950 dark:shadow-none">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="shrink-0">
            {participant.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={participant.profilePhotoUrl}
                alt={participant.fullName}
                className="h-12 w-12 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brandRose/10 dark:bg-brandCyan/10">
                <span className="text-sm font-bold text-brandRose dark:text-brandCyan">
                  {getInitials(participant.fullName)}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate font-semibold text-foreground">
              {participant.fullName}
            </p>
            {/* Role — JetBrains Mono */}
            <p
              className={cn(
                "font-mono text-xs font-medium uppercase tracking-widest",
                tone === "brandRose"
                  ? "text-brandRose"
                  : tone === "brandCyan"
                    ? "text-brandCyan dark:text-brandCyan"
                    : "text-muted",
              )}
            >
              {participant.role}
            </p>
            {(participant.jobTitle ?? participant.companyName) ? (
              <p className="truncate font-mono text-xs text-muted">
                {[participant.jobTitle, participant.companyName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        {onRequestAccess ? (
          <div className="mt-4">
            <SecondaryButton
              onClick={() => onRequestAccess(participant)}
              disabled={isRequesting}
              className="w-full"
            >
              {isRequesting ? "Requesting…" : "Request Access"}
            </SecondaryButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
