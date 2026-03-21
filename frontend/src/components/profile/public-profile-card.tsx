import { Card } from "@/components/shared/card";
import type { PublicProfile } from "@/types/persona";

interface PublicProfileCardProps {
  profile: PublicProfile;
}

export function PublicProfileCard({ profile }: PublicProfileCardProps) {
  const avatarHue = ((profile.username?.charCodeAt(0) ?? 72) * 137) % 360;

  return (
    <Card className="overflow-hidden p-0 shadow-shell border-border/60">
      {/* Hero gradient band */}
      <div
        className="px-6 py-7"
        style={{
          background: `linear-gradient(135deg, hsl(${avatarHue},60%,18%) 0%, hsl(${(avatarHue + 40) % 360},55%,12%) 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-white">
                {profile.fullName}
              </h2>
              <p className="text-base text-white/70">
                {[profile.jobTitle, profile.companyName]
                  .filter(Boolean)
                  .join(" at ")}
              </p>
            </div>
          </div>
          {profile.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePhotoUrl}
              alt={profile.fullName}
              className="h-20 w-20 rounded-3xl object-cover ring-2 ring-white/20"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold text-white ring-2 ring-white/20"
              style={{
                background: `hsl(${avatarHue}, 60%, 45%)`,
              }}
            >
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* About */}
        <div className="space-y-2">
          <p className="label-xs text-muted">About</p>
          <p className="text-base leading-7 text-foreground">
            {profile.tagline || "No public tagline available."}
          </p>
        </div>

        {/* Meta */}
        <dl className="grid gap-4 rounded-3xl border border-border bg-surface/60 p-4 text-sm">
          <div className="space-y-1">
            <dt className="label-xs text-muted">Username</dt>
            <dd className="font-mono text-foreground">@{profile.username}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
