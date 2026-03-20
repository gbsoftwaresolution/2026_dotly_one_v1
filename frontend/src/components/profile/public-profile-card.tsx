import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatAccessMode } from "@/lib/persona/labels";
import type { PublicProfile } from "@/types/persona";

interface PublicProfileCardProps {
  profile: PublicProfile;
}

export function PublicProfileCard({ profile }: PublicProfileCardProps) {
  return (
    <Card className="overflow-hidden p-0 shadow-shell">
      <div className="bg-gradient-to-br from-slate-100 via-white to-blue-50 px-6 py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <StatusBadge label={formatAccessMode(profile.accessMode)} />
            <div className="space-y-1">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                {profile.fullName}
              </h2>
              <p className="text-base text-muted">
                {profile.jobTitle} at {profile.companyName}
              </p>
            </div>
          </div>
          {profile.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePhotoUrl}
              alt={profile.fullName}
              className="h-20 w-20 rounded-3xl object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-2xl font-semibold text-white">
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            About
          </p>
          <p className="text-base leading-7 text-foreground">
            {profile.tagline}
          </p>
        </div>

        <dl className="grid gap-4 rounded-3xl border border-border bg-slate-50/70 p-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Username
            </dt>
            <dd className="text-foreground">@{profile.username}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Public link
            </dt>
            <dd className="break-all text-foreground">{profile.publicUrl}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
