import { notFound, redirect } from "next/navigation";

import {
  getCanonicalPublicLinksPath,
  getCanonicalPublicSlug,
} from "@/lib/persona/public-profile-path";
import { SocialLinkIcon } from "@/components/profile/social-link-icon";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { formatPublicHandle } from "@/lib/persona/routing-ux";
import { resolveSocialLinks } from "@/lib/persona/social-links";

interface PublicAllLinksPageProps {
  publicIdentifier: string;
  forceCanonicalPath?: boolean;
}

export async function PublicAllLinksPage({
  publicIdentifier,
  forceCanonicalPath = false,
}: PublicAllLinksPageProps) {
  try {
    const profile = await publicApi.getProfile(publicIdentifier);
    const canonicalIdentifier =
      profile.publicIdentifier?.trim().toLowerCase() ||
      getCanonicalPublicSlug(profile.publicUrl, profile.username);

    if (
      forceCanonicalPath ||
      publicIdentifier.trim().toLowerCase() !==
        canonicalIdentifier.trim().toLowerCase()
    ) {
      redirect(
        getCanonicalPublicLinksPath(profile.publicUrl, canonicalIdentifier),
      );
    }

    const socialLinks = resolveSocialLinks((profile as any).socialLinks ?? []);

    if (!socialLinks.length) {
      notFound();
    }

    return (
      <main className="relative mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl" />
        <div className="space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              All links
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {profile.fullName}
            </h1>
            <p className="text-sm text-muted">
              {formatPublicHandle(canonicalIdentifier)}
            </p>
          </div>

          <div className="space-y-3">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 rounded-full border border-black/5 bg-white/60 backdrop-blur-md px-5 py-4 text-left shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] transition-all duration-500 hover:-translate-y-1 hover:bg-white/80 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-foreground dark:bg-white/10 dark:text-white">
                  <SocialLinkIcon
                    platform={link.platform}
                    className="h-5 w-5"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {link.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {link.hostname}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
