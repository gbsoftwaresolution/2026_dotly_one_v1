import Link from "next/link";

import { LogoutButton } from "@/components/app-shell/logout-button";
import { PageHeader } from "@/components/shared/page-header";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function AppHomePage() {
  const { user } = await requireServerSession("/app");

  return (
    <section className="space-y-5">
      <PageHeader
        title="Home"
        description="Your private workspace for managing Dotly identities."
      />

      {/* Hero identity card */}
      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell space-y-5">
        {/* Account row */}
        <div className="space-y-1">
          <p className="label-xs text-muted">Signed in as</p>
          <p className="text-base font-semibold text-foreground truncate">
            {user.email}
          </p>
        </div>

        <div className="divider" />

        <p className="text-sm leading-6 text-muted">
          Create personas, control access, and manage permissioned connections
          from one private workspace.
        </p>

        {/* Quick-action grid */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/app/personas"
            className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brandRose/50 hover:bg-brandRose/5 active:scale-[0.98] dark:hover:border-brandCyan/50 dark:hover:bg-brandCyan/5"
          >
            {/* Icon */}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brandRose/10 dark:bg-brandCyan/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brandRose dark:text-brandCyan"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground">
              Personas
            </span>
            <span className="text-xs text-muted">Manage identities</span>
          </Link>

          <Link
            href="/app/contacts"
            className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brandRose/50 hover:bg-brandRose/5 active:scale-[0.98] dark:hover:border-brandCyan/50 dark:hover:bg-brandCyan/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brandRose/10 dark:bg-brandCyan/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brandRose dark:text-brandCyan"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground">
              Contacts
            </span>
            <span className="text-xs text-muted">View connections</span>
          </Link>

          <Link
            href="/app/requests"
            className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brandRose/50 hover:bg-brandRose/5 active:scale-[0.98] dark:hover:border-brandCyan/50 dark:hover:bg-brandCyan/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brandRose/10 dark:bg-brandCyan/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brandRose dark:text-brandCyan"
              >
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground">
              Requests
            </span>
            <span className="text-xs text-muted">Pending handshakes</span>
          </Link>

          <Link
            href="/app/analytics"
            className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brandRose/50 hover:bg-brandRose/5 active:scale-[0.98] dark:hover:border-brandCyan/50 dark:hover:bg-brandCyan/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brandRose/10 dark:bg-brandCyan/10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brandRose dark:text-brandCyan"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground">
              Analytics
            </span>
            <span className="text-xs text-muted">Insights &amp; signals</span>
          </Link>
        </div>

        <LogoutButton />
      </div>
    </section>
  );
}
