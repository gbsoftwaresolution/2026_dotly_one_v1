import Link from "next/link";

import { SocialLinkIcon } from "@/components/profile/social-link-icon";
import {
  getVisibleSocialLinks,
  hasOverflowSocialLinks,
} from "@/lib/persona/social-links";
import { getCanonicalPublicLinksPath } from "@/lib/persona/public-profile-path";
import { cn } from "@/lib/utils/cn";
import type { PublicProfile } from "@/types/persona";

interface PublicSocialLinksProps {
  profile: PublicProfile;
  username: string;
}

export function PublicSocialLinks({
  profile,
  username,
}: PublicSocialLinksProps) {
  const visibleLinks = getVisibleSocialLinks(
    profile.socialLinks ?? [],
    profile.socialLinksDisplayMode ?? "buttons",
  );
  const hasOverflow = hasOverflowSocialLinks(
    profile.socialLinks ?? [],
    profile.socialLinksDisplayMode ?? "buttons",
  );

  if (!visibleLinks.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Social links
        </p>
        {hasOverflow ? (
          <Link
            href={getCanonicalPublicLinksPath(profile.publicUrl, username)}
            className="text-xs font-semibold text-muted transition hover:text-foreground"
          >
            View all
          </Link>
        ) : null}
      </div>

      {(profile.socialLinksDisplayMode ?? "buttons") === "icons" ? (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          {visibleLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              aria-label={link.title}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/8 bg-white/75 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
            >
              <SocialLinkIcon platform={link.platform} className="h-5 w-5" />
            </a>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {visibleLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border border-black/8 bg-white/75 px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white",
              )}
            >
              <SocialLinkIcon platform={link.platform} className="h-4 w-4" />
              <span className="truncate">{link.title}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
