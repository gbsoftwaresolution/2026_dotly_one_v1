import Link from "next/link";

import { PersonaForm } from "@/components/personas/persona-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";

export default function CreatePersonaPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Create a persona"
        description="Set up the version of you that people should remember after the conversation."
        action={
          <Link href="/app/personas">
            <SecondaryButton>Back to personas</SecondaryButton>
          </Link>
        }
      />
      <Card className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          Usernames are unique. Your persona gives people a clearer first impression before any deeper access is shared.
        </p>
        <PersonaForm />
      </Card>
    </section>
  );
}
