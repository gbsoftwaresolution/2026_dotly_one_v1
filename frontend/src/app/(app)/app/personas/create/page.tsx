import Link from "next/link";

import { PersonaForm } from "@/components/personas/persona-form";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";

export default function CreatePersonaPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Create persona"
        description="Create an identity card for Dotly and choose how visible it should be."
        action={
          <Link href="/app/personas">
            <SecondaryButton>Back to personas</SecondaryButton>
          </Link>
        }
      />
      <Card className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          Usernames are unique. Only personas with open access will resolve on
          their public Dotly link.
        </p>
        <PersonaForm />
      </Card>
    </section>
  );
}
