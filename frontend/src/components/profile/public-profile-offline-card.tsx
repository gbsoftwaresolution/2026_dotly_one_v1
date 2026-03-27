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
    <div className="w-full rounded-[32px] border border-amber-300/40 bg-white/60 backdrop-blur-3xl p-6 text-center shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 dark:border-amber-400/20">
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
