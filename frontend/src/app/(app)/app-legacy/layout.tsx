import type { PropsWithChildren } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { requireServerSession } from "@/lib/auth/protected-route";
import { createAuthenticatedSessionSnapshot } from "@/lib/auth/session";
import { routes } from "@/lib/constants/routes";

export default async function LegacyAuthenticatedLayout({
  children,
}: PropsWithChildren) {
  const { user } = await requireServerSession(routes.legacyApp.home);

  return (
    <AppShell session={createAuthenticatedSessionSnapshot(user)}>
      {children}
    </AppShell>
  );
}
