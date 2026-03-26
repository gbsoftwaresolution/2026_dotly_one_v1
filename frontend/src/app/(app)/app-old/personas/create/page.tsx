import Link from "next/link";

import { PersonaForm } from "@/components/personas/persona-form";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";

export default function CreatePersonaPage() {
  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Create a persona"
        description="Set up the version of you that people should remember after the conversation."
        action={
          <Link href="/app-old/personas">
            <SecondaryButton className="w-full sm:w-auto">
              Back to personas
            </SecondaryButton>
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5 sm:space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Identity setup
          </h2>
          <p className="text-sm leading-6 text-muted sm:text-[15px] sm:leading-relaxed">
            Usernames are unique. Your persona gives people a clearer first
            impression before any deeper access is shared.
          </p>
        </div>
        <PersonaForm />
      </div>
    </section>
  );
}
