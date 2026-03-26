import type { PropsWithChildren } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { createAuthenticatedSessionSnapshot } from "@/lib/auth/session";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function AuthenticatedLayout({
  children,
}: PropsWithChildren) {
  const { user } = await requireServerSession("/app-old");

  return (
    <AppShell session={createAuthenticatedSessionSnapshot(user)}>
      {children}
    </AppShell>
  );
}
