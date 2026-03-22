import type { PropsWithChildren } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { LogoutButton } from "@/components/app-shell/logout-button";
import { requireServerSession } from "@/lib/auth/protected-route";

export default async function AuthenticatedLayout({
  children,
}: PropsWithChildren) {
  await requireServerSession("/app");

  return <AppShell headerAction={<LogoutButton />}>{children}</AppShell>;
}
