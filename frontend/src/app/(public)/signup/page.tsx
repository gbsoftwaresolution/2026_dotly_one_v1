"use client";

import { use } from "react";

import { AuthForm } from "@/components/forms/auth-form";
import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const redirectTo = resolvedSearchParams.next || routes.app.home;

  return (
    <AuthPageShell
      title={dotlyPositioning.auth.signupTitle}
      description={dotlyPositioning.auth.signupDescription}
    >
      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell sm:p-7">
        <AuthForm mode="signup" redirectTo={redirectTo} />
      </div>
    </AuthPageShell>
  );
}
