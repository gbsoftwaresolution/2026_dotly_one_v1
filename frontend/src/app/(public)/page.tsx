import Link from "next/link";

import { Card } from "@/components/shared/card";
import { PrimaryButton } from "@/components/shared/primary-button";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { StatusBadge } from "@/components/shared/status-badge";

export default function LandingPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <StatusBadge label="Phase 1 live" />
        <div className="space-y-3">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Create a permissioned identity that is safe to share.
          </h1>
          <p className="max-w-lg text-base leading-7 text-muted">
            Dotly helps you sign in, create personas, and publish only the
            profiles you want visible on the public web.
          </p>
        </div>
      </div>

      <Card className="space-y-4 shadow-shell">
        <p className="text-sm text-muted">
          Start with your account, then create an open persona for your public
          Dotly link.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/signup">
            <PrimaryButton>Get started</PrimaryButton>
          </Link>
          <Link href="/login">
            <SecondaryButton>Open app</SecondaryButton>
          </Link>
        </div>
      </Card>
    </section>
  );
}
