import { notFound } from "next/navigation";

import { SocialLinkIcon } from "@/components/profile/social-link-icon";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { resolveSocialLinks } from "@/lib/persona/social-links";

interface PublicAllLinksPageProps {
  username: string;
}

export async function PublicAllLinksPage({
  username,
}: PublicAllLinksPageProps) {
  try {
    const profile = await publicApi.getProfile(username);
    const socialLinks = resolveSocialLinks((profile as any).socialLinks ?? []);

    if (!socialLinks.length) {
      notFound();
    }

    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              All links
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {profile.fullName}
            </h1>
            <p className="text-sm text-muted">@{profile.username}</p>
          </div>

          <div className="space-y-3">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 rounded-[1.5rem] border border-black/8 bg-white/80 px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.05]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 text-foreground dark:bg-white/10 dark:text-white">
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
