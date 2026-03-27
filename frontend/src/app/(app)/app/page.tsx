import { QrCode, MessageCircle, Mail, Bell, Users, Plus } from "lucide-react";
import Link from "next/link";

import { IdentitySwitcher } from "@/components/identities/identity-switcher";
import { personaApi } from "@/lib/api";
import { requireServerSession } from "@/lib/auth/protected-route";
import { routes } from "@/lib/constants/routes";
import { userApi } from "@/lib/api/user-api";
import type { PersonaSummary } from "@/types/persona";
import { SetDefaultPersonaButton } from "@/components/dashboard/set-default-persona-button";
import { DashboardQr } from "@/components/dashboard/dashboard-qr";

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function AppHomePage() {
  const { accessToken, user } = await requireServerSession("/app");

  const [personas, myFastShare] = await Promise.all([
    personaApi.list(accessToken).catch(() => [] as PersonaSummary[]),
    personaApi.getMyFastShare(accessToken).catch(() => null),
  ]);
  const firstName = formatFirstName(user.email);
  const greeting = getGreeting();

  const primaryPersona = personas.find((p) => p.isPrimary) ?? personas[0];
  const otherPersonas = personas.filter((p) => p.id !== primaryPersona?.id);

  return (
    <section className="relative w-full overflow-hidden flex flex-col items-center">
      {/* Immersive Background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[50vh] w-[50vw] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50vh] w-[50vw] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl px-4 py-6 md:py-8 space-y-8">
        {/* Top Floating Header */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-4">
            <IdentitySwitcher />
          </div>
        </div>

        {personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 mb-6">
              <Users className="h-8 w-8 text-foreground/40" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              No personas yet
            </h2>
            <p className="text-foreground/50 max-w-md mb-8">
              Create your first persona to start sharing your identity and
              connecting with others.
            </p>
            <Link
              href={routes.app.createPersona}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-8 text-[15px] font-semibold text-background transition-all hover:scale-105 active:scale-95 shadow-xl shadow-black/10 dark:shadow-white/5"
            >
              <Plus className="h-5 w-5" />
              Create Persona
            </Link>
          </div>
        ) : (
          <>
            {/* Primary / Default Persona Section */}
            {primaryPersona && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                <div className="text-center space-y-2">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">
                    {greeting}, {firstName}.
                  </h1>
                </div>

                <div className="mx-auto rounded-[2rem] bg-white/40 p-6 md:p-8 ring-1 ring-inset ring-black/5 backdrop-blur-3xl dark:bg-black/40 dark:ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 mb-3">
                        Default Persona
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-1">
                        @{primaryPersona.username}
                      </h2>
                      <p className="text-base font-medium text-foreground/60 capitalize">
                        {primaryPersona.type.toLowerCase().replace("_", " ")}
                      </p>
                    </div>

                    <Link
                      href={routes.app.qr}
                      className="group flex shrink-0 items-center justify-center rounded-[1.5rem] bg-white dark:bg-zinc-900 p-2 ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm transition-transform duration-300 hover:scale-[1.02] active:scale-95"
                    >
                      <div className="h-28 w-28 md:h-32 md:w-32 flex items-center justify-center text-foreground">
                        {myFastShare?.share?.qrValue ? (
                          <DashboardQr value={myFastShare.share.qrValue} />
                        ) : (
                          <QrCode
                            className="h-10 w-10 text-foreground/20"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                    </Link>
                  </div>

                  <hr className="my-6 border-black/5 dark:border-white/10" />

                  <div className="grid grid-cols-4 gap-2">
                    <Link
                      href={routes.app.inbox}
                      className="flex flex-col items-center gap-3 group rounded-2xl p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground/70 group-hover:bg-foreground group-hover:text-background transition-all dark:bg-white/5 shadow-sm"
                        title="Chat"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50 group-hover:text-foreground transition-colors">
                        Chat
                      </span>
                    </Link>
                    <Link
                      href={routes.app.inbox}
                      className="flex flex-col items-center gap-3 group rounded-2xl p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground/70 group-hover:bg-foreground group-hover:text-background transition-all dark:bg-white/5 shadow-sm"
                        title="Mail"
                      >
                        <Mail className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50 group-hover:text-foreground transition-colors">
                        Mail
                      </span>
                    </Link>
                    <Link
                      href={routes.app.requests}
                      className="flex flex-col items-center gap-3 group rounded-2xl p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground/70 group-hover:bg-foreground group-hover:text-background transition-all dark:bg-white/5 shadow-sm"
                        title="Requests"
                      >
                        <Bell className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50 group-hover:text-foreground transition-colors">
                        Requests
                      </span>
                    </Link>
                    <Link
                      href={routes.app.contacts}
                      className="flex flex-col items-center gap-3 group rounded-2xl p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-foreground/70 group-hover:bg-foreground group-hover:text-background transition-all dark:bg-white/5 shadow-sm"
                        title="Contacts"
                      >
                        <Users className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50 group-hover:text-foreground transition-colors">
                        Contacts
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Other Personas List */}
            {otherPersonas.length > 0 && (
              <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 ease-out fill-mode-both">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    Your Other Personas
                  </h3>
                  <Link
                    href={routes.app.personas}
                    className="text-[13px] font-semibold text-foreground/60 hover:text-foreground transition-colors"
                  >
                    Manage
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherPersonas.map((persona) => (
                    <div
                      key={persona.id}
                      className="rounded-[1.5rem] bg-white/40 p-5 ring-1 ring-inset ring-black/5 backdrop-blur-3xl dark:bg-black/40 dark:ring-white/10 transition-transform duration-500 hover:scale-[1.02] flex flex-col justify-between group"
                    >
                      <div className="flex justify-between items-start mb-5">
                        <div>
                          <h4 className="text-lg font-bold tracking-tight text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            @{persona.username}
                          </h4>
                          <p className="text-[13px] font-medium text-foreground/50 mt-0.5 capitalize">
                            {persona.type.toLowerCase().replace("_", " ")}
                          </p>
                        </div>
                        <SetDefaultPersonaButton personaId={persona.id} />
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={routes.app.qr}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-foreground/70 hover:bg-black/10 hover:text-foreground transition-colors dark:bg-white/5 dark:hover:bg-white/10"
                          title="Show QR"
                        >
                          <QrCode className="h-4 w-4" />
                        </Link>
                        <Link
                          href={routes.app.personaDetail(persona.id)}
                          className="flex-1 inline-flex h-9 items-center justify-center rounded-full border border-black/5 bg-transparent text-[12px] font-semibold text-foreground/70 hover:bg-black/5 hover:text-foreground transition-all dark:border-white/10 dark:hover:bg-white/5"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
