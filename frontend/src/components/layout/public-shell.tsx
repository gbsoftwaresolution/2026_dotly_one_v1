"use client";

import type { PropsWithChildren } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isFullscreenRoute =
    pathname.startsWith("/u/") || pathname.startsWith("/q/");

  if (isFullscreenRoute) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-app flex-col px-4 py-5 sm:px-6">
      <header className="flex items-center justify-between py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Dotly
        </Link>
        <nav className="flex items-center gap-2 text-sm text-muted">
          <Link
            className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-foreground"
            href="/login"
          >
            Login
          </Link>
          <Link
            className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-foreground"
            href="/signup"
          >
            Sign up
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 items-center py-8">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
