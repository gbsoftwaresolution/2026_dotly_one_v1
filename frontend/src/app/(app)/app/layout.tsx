import type { PropsWithChildren } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { LogoutButton } from "@/components/app-shell/logout-button";
import { createAuthenticatedSessionSnapshot } from "@/lib/auth/session";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function AuthenticatedLayout({
  children,
}: PropsWithChildren) {
  const { user } = await requireServerSession("/app");

  return (
    <AppShell
      headerAction={<LogoutButton />}
      session={createAuthenticatedSessionSnapshot(user)}
    >
      {children}
    </AppShell>
  );
}
