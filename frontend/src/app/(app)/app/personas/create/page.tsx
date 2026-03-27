import Link from "next/link";

import { PersonaForm } from "@/components/personas/persona-form";
import { PageHeader } from "@/components/shared/page-header";
import { SecondaryButton } from "@/components/shared/secondary-button";
import { routes } from "@/lib/constants/routes";

export default function CreatePersonaPage() {
  const setupSteps = [
    {
      title: "Choose the version of you worth sharing",
      description:
        "Start with one persona for the rooms, meetings, or events where first impressions actually matter this week.",
    },
    {
      title: "Make recognition immediate",
      description:
        "Name, role, company, and one strong line are enough for a premium first exchange.",
    },
    {
      title: "Open the QR right after save",
      description:
        "Dotly will take this persona straight into a share-ready flow so you can use it immediately.",
    },
  ] as const;

  return (
    <section className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Create a persona"
        description="Set up the one Dotly identity you want to use first, then open the QR as your next step."
        action={
          <Link href={routes.app.personas}>
            <SecondaryButton className="w-full sm:w-auto">
              Back to personas
            </SecondaryButton>
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5 sm:space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Premium-first setup
          </h2>
          <p className="text-sm leading-6 text-muted sm:text-[15px] sm:leading-relaxed">
            Keep this lightweight. One strong persona is enough to reach your
            first premium moment.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {setupSteps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-[1.5rem] border border-black/5 bg-black/[0.02] p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
        <PersonaForm />
      </div>
    </section>
  );
}
