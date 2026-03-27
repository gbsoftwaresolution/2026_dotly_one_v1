"use client";

import { useState } from "react";

import { AuthForm } from "@/components/forms/auth-form";

import { PasskeyHero } from "./passkey-hero";

export function LoginAuthPanel({
  redirectTo,
  initialEmail,
}: {
  redirectTo: string;
  initialEmail?: string;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);

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
        title="Password fallback"
        description="Use your email and password if this device does not have your Dotly passkey yet."
        collapsible
        defaultExpanded={showPasswordForm}
      />
    </>
  );
}
