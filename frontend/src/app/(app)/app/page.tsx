import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { personaApi } from "@/lib/api";
import { apiRequest, ApiError } from "@/lib/api/client";
import { requireServerSession } from "@/lib/auth/protected-route";
import { dotlyPositioning } from "@/lib/constants/positioning";
import { routes } from "@/lib/constants/routes";
import { PrimaryButton } from "@/components/shared/primary-button";
import type { PersonaSummary } from "@/types/persona";
import type { IncomingRequest, OutgoingRequest } from "@/types/request";

type HomePriority = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

async function loadHomeData(accessToken: string): Promise<{
  personas: PersonaSummary[];
  incomingRequests: IncomingRequest[];
  outgoingRequests: OutgoingRequest[];
}> {
  const [personas, incomingRequests, outgoingRequests] = await Promise.all([
    personaApi.list(accessToken),
    apiRequest<IncomingRequest[]>("/contact-requests/incoming", {
      token: accessToken,
    }),
    apiRequest<OutgoingRequest[]>("/contact-requests/outgoing", {
      token: accessToken,
    }),
  ]);

  return {
    personas,
    incomingRequests,
    outgoingRequests,
  };
}

function resolvePriority(params: {
  personas: PersonaSummary[];
  incomingCount: number;
  outgoingCount: number;
}): HomePriority {
  if (params.personas.length === 0) {
    return {
      title: "Create your first Dotly identity",
      description: dotlyPositioning.app.noPersonas,
      href: routes.app.createPersona,
      actionLabel: "Create persona",
    };
  }

  if (params.incomingCount > 0) {
    return {
      title: "Review pending requests",
      description:
        "New connection requests are waiting for your decision.",
      href: routes.app.requests,
      actionLabel: "Review requests",
    };
  }

  if (params.outgoingCount > 0) {
    return {
      title: "Check your sent requests",
      description:
        "You already have introductions in motion. Check what is still pending before you start another one.",
      href: routes.app.requests,
      actionLabel: "Open requests",
    };
  }

  return {
    title: "Share your next introduction",
    description:
      "Share your Dotly in person and stay in control of what happens next.",
    href: routes.app.qr,
    actionLabel: "Generate QR",
  };
}

export default async function AppHomePage() {
  const { user, accessToken } = await requireServerSession("/app");

  let personas: PersonaSummary[] = [];
  let incomingRequests: IncomingRequest[] = [];
  let outgoingRequests: OutgoingRequest[] = [];
  let loadError: string | null = null;

  try {
    ({ personas, incomingRequests, outgoingRequests } = await loadHomeData(
      accessToken,
    ));
  } catch (error) {
    loadError =
      error instanceof ApiError
        ? error.message
        : "We could not load your workspace summary right now.";
  }

  const priority = resolvePriority({
    personas,
    incomingCount: incomingRequests.length,
    outgoingCount: outgoingRequests.length,
  });

  const summaryItems = [
    { label: "Personas", value: personas.length.toString() },
    { label: "Incoming requests", value: incomingRequests.length.toString() },
    { label: "Outgoing requests", value: outgoingRequests.length.toString() },
  ];

  const secondaryActions = [
    {
      href: routes.app.personas,
      title: "Manage personas",
      description:
        personas.length === 0
          ? dotlyPositioning.app.noPersonas
          : "Refine how each Dotly identity is shared.",
    },
    {
      href: routes.app.contacts,
      title: "View connections",
      description: "Review who you know, how you met, and what comes next.",
    },
    {
      href: routes.app.settings,
      title: "Open settings",
      description: "Manage trust, privacy, and the controls behind your sharing experience.",
    },
  ] as const;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Control every connection"
        description="Move from sharing your number to sharing your identity, with context and trust built in."
      />

      <div className="glass rounded-3xl border border-border/60 p-6 shadow-shell space-y-6">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted">Signed in as</p>
            <p className="text-lg font-semibold text-foreground break-all">
              {user.email}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.3rem] border border-border bg-background/70 px-4 py-3"
              >
                <p className="text-lg font-semibold text-foreground">{item.value}</p>
                <p className="text-xs leading-5 text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[1.8rem] border border-border bg-background/60 p-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {priority.title}
            </h2>
            <p className="text-sm leading-6 text-muted">{priority.description}</p>
            {loadError ? (
              <p className="text-sm leading-6 text-amber-700 dark:text-amber-300">
                {loadError}
              </p>
            ) : null}
          </div>

          <Link href={priority.href} className="block">
            <PrimaryButton className="h-14 w-full rounded-[1.25rem] text-sm font-semibold">
              {priority.actionLabel}
            </PrimaryButton>
          </Link>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Secondary actions</h2>
          <div className="space-y-3">
            {secondaryActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-start justify-between gap-3 rounded-[1.35rem] border border-border bg-background/60 px-4 py-4 transition-colors hover:border-brandRose/25 hover:bg-brandRose/5 dark:hover:border-brandCyan/25 dark:hover:bg-brandCyan/5"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{action.title}</p>
                  <p className="text-sm leading-6 text-muted">{action.description}</p>
                </div>
                <span className="text-sm font-semibold text-muted">Open</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
