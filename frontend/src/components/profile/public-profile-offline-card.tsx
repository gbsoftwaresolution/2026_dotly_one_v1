import type { PublicProfile } from "@/types/persona";

interface PublicProfileOfflineCardProps {
  profile: PublicProfile;
}

export function PublicProfileOfflineCard({
  profile,
}: PublicProfileOfflineCardProps) {
  const fullName = profile.fullName?.trim() || "Profile";
  const tagline = profile.tagline?.trim() || "Reconnect to load live actions.";

  return (
    <div className="w-full rounded-[2rem] border border-amber-300/40 bg-amber-50/80 p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-amber-400/20 dark:bg-amber-500/10">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
        Offline preview
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {fullName}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">{tagline}</p>
      <p className="mt-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
        Dotly saved this profile preview earlier. Actions are unavailable until
        you reconnect.
      </p>
    </div>
  );
}
