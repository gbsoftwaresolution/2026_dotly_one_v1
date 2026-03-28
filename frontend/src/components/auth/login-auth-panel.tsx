"use client";

import { useState } from "react";

import { AuthForm } from "@/components/forms/auth-form";

import { PasskeyHero } from "./passkey-hero";

export function LoginAuthPanel({
  redirectTo,
  initialEmail,
  shouldPromptPasskeyEnrollment = false,
}: {
  redirectTo: string;
  initialEmail?: string;
  shouldPromptPasskeyEnrollment?: boolean;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const passwordFallbackDescription = shouldPromptPasskeyEnrollment
    ? "Use your email and password once, and Dotly will guide you straight into passkey setup after sign-in."
    : "Use your email and password if this device does not have your Dotly passkey yet.";

  return (
    <>
      <PasskeyHero
        redirectTo={redirectTo}
        initialEmail={initialEmail}
        onUsePassword={() => setShowPasswordForm(true)}
      />
      <AuthForm
        mode="login"
        redirectTo={redirectTo}
        initialEmail={initialEmail}
        shouldPromptPasskeyEnrollment={shouldPromptPasskeyEnrollment}
        title="Password fallback"
        description={passwordFallbackDescription}
        collapsible
        defaultExpanded={showPasswordForm}
      />
    </>
  );
}
