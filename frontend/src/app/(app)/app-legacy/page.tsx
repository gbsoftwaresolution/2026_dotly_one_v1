import { ArrowUpRight, Check, Plus, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";

import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { PersonaInboxPreview } from "@/components/dashboard/persona-inbox-preview";
import { IdentitySwitcher } from "@/components/identities/identity-switcher";
import { personaApi } from "@/lib/api";
import { userApi } from "@/lib/api/user-api";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import type { PersonaSummary } from "@/types/persona";
import type {
  UserActivationMilestoneKey,
  UserActivationMilestones,
} from "@/types/user";

const activationOrder: UserActivationMilestoneKey[] = [
  "firstPersonaCreated",
  "firstQrOpened",
  "firstShareCompleted",
  "firstRequestReceived",
];

const activationMilestoneFieldMap: Record<
  UserActivationMilestoneKey,
  keyof UserActivationMilestones
> = {
  firstPersonaCreated: "firstPersonaCreatedAt",
  firstQrOpened: "firstQrOpenedAt",
  firstShareCompleted: "firstShareCompletedAt",
  firstRequestReceived: "firstRequestReceivedAt",
};

function deriveActivationMilestones(
  userMilestones: Partial<UserActivationMilestones> | undefined,
  personas: PersonaSummary[],
  totalConnections: number,
): UserActivationMilestones {
  const hasPersonas = personas.length > 0;
  const hasConnections = totalConnections > 0;

  return {
    firstPersonaCreatedAt:
      userMilestones?.firstPersonaCreatedAt ?? (hasPersonas ? "derived" : null),
    firstQrOpenedAt: userMilestones?.firstQrOpenedAt ?? null,
    firstShareCompletedAt:
      userMilestones?.firstShareCompletedAt ??
      (hasConnections ? "derived" : null),
    firstRequestReceivedAt: userMilestones?.firstRequestReceivedAt ?? null,
  };
}

function getNextMilestoneKey(
  milestones: UserActivationMilestones,
): UserActivationMilestoneKey | null {
  return (
    activationOrder.find(
      (key) => !milestones[activationMilestoneFieldMap[key]],
    ) ?? null
  );
}

function formatFirstName(email: string) {
  const localPart = email.split("@")[0] ?? "there";
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")[0];

  if (!cleaned) {
    return "there";
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default async function LegacyAppHomePage() {
  const { accessToken, user } = await requireServerSession(
    routes.legacyApp.home,
  );

  const [analytics, personas] = await Promise.all([
    userApi.meAnalytics(accessToken).catch(() => null),
    personaApi.list(accessToken).catch(() => [] as PersonaSummary[]),
  ]);
  const firstName = formatFirstName(user.email);
  const primaryPersona =
    personas.find((persona) => persona.isPrimary) ?? personas[0] ?? null;
  const personaCount = personas.length;
  const totalConnections = analytics?.totalConnections ?? 0;
  const activationMilestones = deriveActivationMilestones(
    user.activation?.milestones,
    personas,
    totalConnections,
  );
  const activationStage =
    user.activation?.nextMilestoneKey ??
    getNextMilestoneKey(activationMilestones);
  const hasPersonas = Boolean(activationMilestones.firstPersonaCreatedAt);
  const hasOpenedQr = Boolean(activationMilestones.firstQrOpenedAt);
  const hasShareCompleted = Boolean(activationMilestones.firstShareCompletedAt);
  const hasRequestReceived = Boolean(
    activationMilestones.firstRequestReceivedAt,
  );
  const activationCopy =
    activationStage === "firstPersonaCreated"
      ? {
          badge: "Start here",
          title: `Let’s get your first Dotly ready, ${firstName}.`,
          description:
            "Start with one persona you can confidently share in the room. Dotly will prepare the QR and route the first replies after that.",
          primaryHref: routes.app.createPersona,
          primaryLabel: "Create first persona",
          secondaryHref: routes.app.personas,
          secondaryLabel: "See persona workspace",
        }
      : activationStage === "firstQrOpened"
        ? {
            badge: "Ready to share",
            title: `Your first Dotly is ready to share, ${firstName}.`,
            description:
              "Open your QR, show it once, and let Dotly turn that introduction into a routed request, connection, or conversation.",
            primaryHref: routes.app.qr,
            primaryLabel: "Open share QR",
            secondaryHref: routes.app.personas,
            secondaryLabel: "Refine personas",
          }
        : activationStage === "firstShareCompleted"
          ? {
              badge: "First signal",
              title: `Your QR is in the wild, ${firstName}.`,
              description:
                "That first open matters. Stay close to requests and inbox so the conversation turns into a tracked next step while context is still fresh.",
              primaryHref: routes.app.requests,
              primaryLabel: "Check requests",
              secondaryHref: routes.app.inbox,
              secondaryLabel: "Open inbox",
            }
          : activationStage === "firstRequestReceived"
            ? {
                badge: "Follow-through",
                title: `Your first intro landed, ${firstName}.`,
                description:
                  "The system is working. Review what came in, reply while the conversation is still warm, and keep the next action obvious.",
                primaryHref: routes.app.requests,
                primaryLabel: "Review requests",
                secondaryHref: routes.app.inbox,
                secondaryLabel: "Open inbox",
              }
            : {
                badge: "Keep momentum",
                title: `Keep introductions moving, ${firstName}.`,
                description:
                  "Your first setup is done. Stay close to inbox, requests, and QR so each introduction turns into a useful next step.",
                primaryHref: routes.app.inbox,
                primaryLabel: "Open inbox",
                secondaryHref: routes.app.qr,
                secondaryLabel: "Show QR again",
              };
  const activationSteps = [
    {
      title: "Create one persona",
      description:
        "Set up the name, role, and handle you want people to remember.",
      href: routes.app.createPersona,
      status: hasPersonas ? "Done" : "Next",
    },
    {
      title: "Open your share QR",
      description:
        "Bring up one clean share surface before the conversation starts moving.",
      href: routes.app.qr,
      status: hasOpenedQr ? "Done" : hasPersonas ? "Next" : "After persona",
    },
    {
      title: "Catch the first real signal",
      description:
        "Let one real scan or profile open confirm that your Dotly is landing in the room.",
      href: routes.app.qr,
      status: hasShareCompleted ? "Done" : hasOpenedQr ? "Next" : "After QR",
    },
    {
      title: "Check requests and inbox",
      description:
        "Review the first incoming request or reply before the thread cools down.",
      href: routes.app.requests,
      status: hasRequestReceived
        ? "Live"
        : hasShareCompleted
          ? "Next"
          : "After first share",
    },
  ] as const;

  return (
    <section className="relative min-h-[calc(100dvh-8rem)] overflow-hidden rounded-[2rem] border border-black/5 bg-transparent px-1 pb-4 pt-1 dark:border-white/10 sm:rounded-[2.5rem]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-x-8 top-0 h-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-foreground/[0.04] blur-3xl dark:bg-white/[0.05]" />
      </div>

      <div className="relative space-y-4 rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground dark:border-white/10 dark:bg-white/[0.04]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
              {activationCopy.badge}
            </span>
            <div className="space-y-2">
              <h1 className="max-w-[12ch] text-4xl font-bold tracking-tighter text-foreground sm:max-w-none sm:text-5xl">
                {activationCopy.title}
              </h1>
              <p className="max-w-[34ch] text-[16px] font-medium leading-relaxed text-muted sm:text-[17px]">
                {activationCopy.description}
              </p>
            </div>
          </div>

          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.75rem] border border-black/5 bg-white/55 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#111111]/55 dark:shadow-[0_8px_30px_rgba(0,0,0,0.24)] sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                  First useful moment
                </p>
                <h2 className="text-[28px] font-bold tracking-tighter text-foreground sm:text-[32px]">
                  {activationStage === "firstPersonaCreated"
                    ? "Create a profile worth sharing."
                    : activationStage === "firstQrOpened"
                      ? "Share once and let Dotly do the rest."
                      : activationStage === "firstShareCompleted"
                        ? "Now watch for the first reply."
                        : activationStage === "firstRequestReceived"
                          ? "Close the loop while context is fresh."
                          : "Keep the next action obvious."}
                </h2>
                <p className="max-w-[40ch] text-[15px] font-medium leading-relaxed text-muted sm:text-[16px]">
                  {activationStage === "firstPersonaCreated"
                    ? "A single persona is enough to unlock your first QR, your first routed inbox lane, and a cleaner first impression."
                    : activationStage === "firstQrOpened"
                      ? `Your next best move is simple: open ${primaryPersona ? `@${primaryPersona.username}` : "your"} QR and use it in the next conversation.`
                      : activationStage === "firstShareCompleted"
                        ? "Dotly has seen the first real interaction. Shift from setup to follow-through and check whether a request or reply came in."
                        : activationStage === "firstRequestReceived"
                          ? "Your first incoming signal is here. Confirm who reached out, respond quickly, and let Dotly keep the context organized."
                          : "Your setup already works. Keep QR, inbox, and requests close so each introduction becomes a tracked relationship instead of a lost thread."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={activationCopy.primaryHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background transition-transform hover:scale-[0.98] active:scale-95"
                >
                  {activationCopy.primaryLabel}
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
                </Link>
                <Link
                  href={activationCopy.secondaryHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/5 bg-black/[0.03] px-6 text-[15px] font-semibold text-foreground transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                >
                  {activationCopy.secondaryLabel}
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                </Link>
              </div>

              <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-4">
                {activationSteps.map((step) => (
                  <Link
                    key={step.title}
                    href={step.href}
                    className="rounded-[1.4rem] border border-black/5 bg-black/[0.02] px-4 py-4 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <span className="rounded-full border border-black/5 bg-black/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.06]">
                        {step.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {step.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                Active identity
              </p>
              <div className="mt-4">
                <IdentitySwitcher />
              </div>
            </div>

            {hasShareCompleted && !hasRequestReceived ? (
              <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/[0.06] p-5 backdrop-blur-2xl dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 dark:bg-emerald-400/10 dark:ring-emerald-400/20">
                    <Check
                      className="h-5 w-5 text-emerald-700 dark:text-emerald-300"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/70">
                      Post-share signal
                    </p>
                    <h2 className="text-[24px] font-bold tracking-tighter text-foreground sm:text-[28px]">
                      Your first share landed.
                    </h2>
                    <p className="text-[15px] font-medium leading-relaxed text-muted">
                      Now move from showing to following through. Requests and
                      inbox are the next two places worth watching.
                    </p>
                  </div>
                </div>
              </div>
            ) : hasPersonas ? (
              <PersonaInboxPreview />
            ) : (
              <div className="rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.02] sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/[0.04] ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
                    <Check
                      className="h-5 w-5 text-foreground"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">
                      Setup path
                    </p>
                    <h2 className="text-[24px] font-bold tracking-tighter text-foreground sm:text-[28px]">
                      One persona is enough to start.
                    </h2>
                    <p className="text-[15px] font-medium leading-relaxed text-muted">
                      You do not need a full profile system first. Create one
                      persona, open the share QR, and let Dotly teach the rest
                      through real use.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[1.75rem] border border-black/5 bg-foreground p-5 text-background shadow-[0_18px_40px_rgba(0,0,0,0.12)] dark:border-white/10 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-background/60">
                    Snapshot
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tighter">
                    {analytics?.totalConnections ?? 0}
                  </p>
                  <p className="mt-1 text-[15px] font-medium text-background/70">
                    {hasShareCompleted
                      ? "connections across your current workspace"
                      : hasPersonas
                        ? "connections will appear after your first share"
                        : "connections start after your first persona and share"}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <QrCode className="h-6 w-6" strokeWidth={1.8} />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-[1.25rem] bg-white/8 px-4 py-3 text-[14px] font-medium text-background/75 ring-1 ring-white/10">
                <span>New connections this month</span>
                <span className="font-bold text-background">
                  {analytics?.connectionsThisMonth ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Personas",
              description:
                "Create or refine the profile you want to share first.",
              href: routes.app.personas,
              status: hasPersonas ? `${personaCount} ready` : "Start here",
            },
            {
              title: "QR share",
              description:
                "Open one large share surface for meetings, intros, and events.",
              href: routes.app.qr,
              status: hasOpenedQr
                ? "Opened"
                : hasPersonas
                  ? "Ready"
                  : "Needs persona",
            },
            {
              title: "Requests and inbox",
              description:
                "Catch the first reply after you share instead of losing the thread.",
              href: routes.app.inbox,
              status: hasRequestReceived
                ? "Active"
                : hasShareCompleted
                  ? "Next"
                  : "After first share",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-[1.75rem] border border-black/5 bg-black/[0.02] p-5 backdrop-blur-2xl transition-transform duration-300 hover:scale-[0.99] dark:border-white/10 dark:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[18px] font-bold tracking-tight text-foreground">
                  {item.title}
                </p>
                <span className="rounded-full border border-black/5 bg-black/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted dark:border-white/10 dark:bg-white/[0.04]">
                  {item.status}
                </span>
              </div>
              <p className="mt-3 max-w-[28ch] text-[15px] font-medium leading-relaxed text-muted">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
