import { ArrowUpRight, Plus, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";

import { IdentitySwitcher } from "@/components/identities/identity-switcher";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { requireServerSession } from "@/lib/auth/protected-route";
import { userApi } from "@/lib/api/user-api";
import { routes } from "@/lib/constants/routes";

function formatFirstName(email: string) {
  const localPart = email.split("@")[0] ?? "there";
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")[0];

  if (!cleaned) {
    return "there";
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default async function AppHomePage() {
  const { accessToken, user } = await requireServerSession("/app");

  const analytics = await userApi.meAnalytics(accessToken).catch(() => null);
  const firstName = formatFirstName(user.email);

  return (
    <section className="relative min-h-[calc(100dvh-8rem)] overflow-hidden rounded-[2rem] border border-black/5 bg-transparent px-1 pb-4 pt-1 dark:border-white/10 sm:rounded-[2.5rem]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-x-8 top-0 h-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-foreground/[0.04] blur-3xl dark:bg-white/[0.05]" />
      </div>

      <div className="relative space-y-4 rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground dark:border-white/10 dark:bg-white/[0.04]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
              New workspace
            </span>
            <div className="space-y-2">
              <h1 className="max-w-[12ch] text-4xl font-bold tracking-tighter text-foreground sm:max-w-none sm:text-5xl">
                Good to see you, {firstName}.
              </h1>
              <p className="max-w-[34ch] text-[16px] font-medium leading-relaxed text-muted sm:text-[17px]">
                We moved your current workspace to `app-old` so we can redesign
                Dotly one screen at a time without losing anything.
              </p>
            </div>
          </div>

          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-black/5 bg-white/55 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#111111]/55 dark:shadow-[0_8px_30px_rgba(0,0,0,0.24)] sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                  Design basecamp
                </p>
                <h2 className="text-[28px] font-bold tracking-tighter text-foreground sm:text-[32px]">
                  Start fresh from a clean `/app` canvas.
                </h2>
                <p className="max-w-[40ch] text-[15px] font-medium leading-relaxed text-muted sm:text-[16px]">
                  This new home page is intentionally simple. We can now design
                  each dashboard page with the same premium direction as your
                  public site.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/app-old"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background transition-transform hover:scale-[0.98] active:scale-95"
                >
                  Open existing app
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
                </Link>
                <Link
                  href="/app-old/personas"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/5 bg-black/[0.03] px-6 text-[15px] font-semibold text-foreground transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                >
                  Review personas
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                Active identity
              </p>
              <div className="mt-4">
                <IdentitySwitcher />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/5 bg-foreground p-5 text-background shadow-[0_18px_40px_rgba(0,0,0,0.12)] dark:border-white/10 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-background/60">
                    Snapshot
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tighter">
                    {analytics?.totalConnections ?? 0}
                  </p>
                  <p className="mt-1 text-[15px] font-medium text-background/70">
                    total connections across your current workspace
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <QrCode className="h-6 w-6" strokeWidth={1.8} />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-[1.25rem] bg-white/8 px-4 py-3 text-[14px] font-medium text-background/75 ring-1 ring-white/10">
                <span>New connections this month</span>
                <span className="font-bold text-background">
                  {analytics?.connectionsThisMonth ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Home",
              description: "Define the new authenticated landing experience.",
              href: routes.app.home,
              status: "In progress",
            },
            {
              title: "QR share",
              description: "Rebuild the one-screen sharing flow next.",
              href: "/app-old/qr",
              status: "Ready to redesign",
            },
            {
              title: "Personas",
              description: "Clarify how identities are represented publicly.",
              href: "/app-old/personas",
              status: "Existing reference",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl transition-transform duration-300 hover:scale-[0.99] dark:border-white/10 dark:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[18px] font-bold tracking-tight text-foreground">
                  {item.title}
                </p>
                <span className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.04]">
                  {item.status}
                </span>
              </div>
              <p className="mt-3 max-w-[28ch] text-[15px] font-medium leading-relaxed text-muted">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
