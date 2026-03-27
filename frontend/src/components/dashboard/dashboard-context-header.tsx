"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Sun,
  Sunset,
  Moon,
  Check,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { routes } from "@/lib/constants/routes";
import {
  useShareFastSnapshot,
  seedMyFastShare,
  upsertPersonaFastShare,
} from "@/lib/share-fast-store";
import type {
  MyFastSharePayload,
  PersonaSummary,
  PersonaAccessMode,
} from "@/types/persona";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { showToast } from "@/components/shared/toast-viewport";
import { personaApi } from "@/lib/api/persona-api";
import { cn } from "@/lib/utils/cn";

interface DashboardContextHeaderProps {
  initialFastShare: MyFastSharePayload | null;
}

const accessModeOptions: Array<{
  value: PersonaAccessMode;
  label: string;
  icon: typeof Shield;
  description: string;
}> = [
  {
    value: "open",
    label: "Open",
    icon: ShieldCheck,
    description: "Anyone can view your profile and contact you",
  },
  {
    value: "request",
    label: "Request",
    icon: Shield,
    description: "People must request access to see your details",
  },
  {
    value: "private",
    label: "Private",
    icon: ShieldAlert,
    description: "Your profile is hidden from the public",
  },
];

export function DashboardContextHeader({
  initialFastShare,
}: DashboardContextHeaderProps) {
  const router = useRouter();
  const snapshot = useShareFastSnapshot();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isModeSheetOpen, setIsModeSheetOpen] = useState(false);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  // Hydrate store on mount
  useEffect(() => {
    if (initialFastShare) {
      seedMyFastShare(initialFastShare);
    }
  }, [initialFastShare]);

  // Load list of personas for the switchers (on mount)
  useEffect(() => {
    setIsLoadingPersonas(true);
    personaApi
      .list()
      .then((data) => {
        setPersonas(data);
      })
      .finally(() => {
        setIsLoadingPersonas(false);
      });
  }, []);

  const handleSelectPersona = async (personaId: string) => {
    setIsSheetOpen(false);

    // Optimistic UI could go here, but let's fetch the new fast share
    try {
      const newFastShare = await personaApi.getFastShare(personaId);
      upsertPersonaFastShare(newFastShare, { selected: true });
    } catch {
      showToast({ message: "Could not switch persona right now", tone: "error" });
    }
  };

  const activePersonaId =
    snapshot.selectedPersonaId ?? initialFastShare?.persona?.id;
  const activePayload = snapshot.selectedPersonaId
    ? snapshot.personaPayloads[snapshot.selectedPersonaId]
    : null;

  const activePersonaFull = personas.find((p) => p.id === activePersonaId);
  const currentAccessMode = activePersonaFull?.accessMode ?? "request";
  const activeModeOption = accessModeOptions.find(
    (o) => o.value === currentAccessMode,
  )!;

  const handleUpdateAccessMode = async (mode: PersonaAccessMode) => {
    if (!activePersonaId || isUpdatingMode || mode === currentAccessMode)
      return;

    setIsUpdatingMode(true);

    // Optimistic update
    setPersonas((current) =>
      current.map((p) =>
        p.id === activePersonaId ? { ...p, accessMode: mode } : p,
      ),
    );

    setTimeout(() => setIsModeSheetOpen(false), 200);

    try {
      await personaApi.update(activePersonaId, { accessMode: mode });
    } catch {
      showToast({ message: "Could not update access mode", tone: "error" });
      void personaApi.list().then(setPersonas);
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const fullName =
    activePayload?.fullName ??
    initialFastShare?.persona?.fullName ??
    "Your Dotly";
  const firstName = fullName.split(" ")[0];
  const username =
    activePayload?.username ??
    initialFastShare?.persona?.username ??
    "username";
  const avatarLetter = firstName.charAt(0).toUpperCase();

  const hour = new Date().getHours();
  let greetingTime = "Good evening";
  let GreetingIcon = Moon;
  let iconColor = "text-indigo-500 dark:text-indigo-400";
  let iconBg = "bg-indigo-500/10 dark:bg-indigo-400/10";

  if (hour < 12) {
    greetingTime = "Good morning";
    GreetingIcon = Sun;
    iconColor = "text-amber-500 dark:text-amber-400";
    iconBg = "bg-amber-500/10 dark:bg-amber-400/10";
  } else if (hour < 18) {
    greetingTime = "Good afternoon";
    GreetingIcon = Sunset;
    iconColor = "text-orange-500 dark:text-orange-400";
    iconBg = "bg-orange-500/10 dark:bg-orange-400/10";
  }

  const greeting = `${greetingTime}, ${firstName}`;

  const dateString = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

  return (
    <>
      <header className="animate-fade-up [animation-duration:700ms] flex flex-col pt-2 sm:pt-4">
        {/* Switchers Row */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
          {/* Persona Switcher Pill */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className="flex-shrink-0 inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-black/[0.03] hover:bg-black/[0.06] active:bg-black/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12] transition-colors ring-1 ring-black/5 dark:ring-white/10"
          >
            <div className="flex items-center justify-center h-[26px] w-[26px] rounded-full bg-gradient-to-br from-black/80 to-black dark:from-white/90 dark:to-white/70 shadow-sm ring-1 ring-black/10 dark:ring-white/20">
              <span className="text-[12px] font-bold text-white dark:text-black leading-none pt-px">
                {avatarLetter}
              </span>
            </div>
            <span className="text-[14px] font-medium text-foreground tracking-tight">
              @{username}
            </span>
            <ChevronDown
              className="h-[14px] w-[14px] text-muted-foreground/70"
              strokeWidth={2.5}
            />
          </button>

          {/* Mode Switcher Pill */}
          {activePersonaFull && (
            <button
              onClick={() => setIsModeSheetOpen(true)}
              className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 h-[32px] rounded-full bg-black/[0.03] hover:bg-black/[0.06] active:bg-black/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12] transition-colors ring-1 ring-black/5 dark:ring-white/10"
            >
              <activeModeOption.icon
                className={cn(
                  "h-[14px] w-[14px]",
                  currentAccessMode === "open"
                    ? "text-emerald-500"
                    : currentAccessMode === "request"
                      ? "text-amber-500"
                      : "text-rose-500",
                )}
                strokeWidth={2.5}
              />
              <span className="text-[13px] font-semibold text-foreground tracking-tight">
                {activeModeOption.label}
              </span>
              <ChevronDown
                className="h-[14px] w-[14px] text-muted-foreground/70"
                strokeWidth={2.5}
              />
            </button>
          )}
        </div>

        {/* Greeting */}
        <div className="flex justify-between items-end pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center h-6 w-6 rounded-full ${iconBg}`}
              >
                <GreetingIcon className={`h-[14px] w-[14px] ${iconColor}`} />
              </div>
              <span className="text-[13px] font-semibold tracking-widest text-muted-foreground/70">
                {dateString}
              </span>
            </div>
            <h1 className="text-[34px] leading-tight font-bold tracking-tight text-foreground sm:text-5xl">
              {greeting}
            </h1>
          </div>
        </div>
      </header>

      <BottomSheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Switch Profile"
      >
        <div className="flex flex-col gap-3">
          {isLoadingPersonas && personas.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[72px] w-full rounded-2xl skeleton opacity-50"
                />
              ))}
            </div>
          ) : (
            <>
              {personas.map((p) => {
                const isSelected = p.id === activePersonaId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPersona(p.id)}
                    className={cn(
                      "flex items-center justify-between w-full p-4 rounded-2xl transition-all duration-200 active:scale-[0.98]",
                      isSelected
                        ? "bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/5 dark:ring-white/10"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-black/5 to-black/10 dark:from-white/10 dark:to-white/5 ring-1 ring-black/5 dark:ring-white/10">
                        <span className="text-[17px] font-bold text-foreground">
                          {p.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-col items-start text-left gap-0.5">
                        <span className="text-[17px] font-semibold leading-tight text-foreground">
                          {p.fullName}
                        </span>
                        <span className="text-[15px] font-medium text-muted-foreground/80">
                          @{p.username}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-black dark:bg-white">
                        <Check
                          className="h-4 w-4 text-white dark:text-black"
                          strokeWidth={3}
                        />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full border-2 border-black/10 dark:border-white/10" />
                    )}
                  </button>
                );
              })}

              <div className="my-2 h-px w-full bg-black/5 dark:bg-white/5" />

              <Link
                href={routes.app.createPersona}
                onClick={() => setIsSheetOpen(false)}
                className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:scale-[0.98] transition-all duration-200"
              >
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 border-dashed">
                  <UserPlus
                    className="h-5 w-5 text-foreground/70"
                    strokeWidth={2}
                  />
                </div>
                <span className="text-[17px] font-medium text-foreground">
                  Create new profile
                </span>
              </Link>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Access Mode Sheet */}
      <BottomSheet
        open={isModeSheetOpen}
        onClose={() => setIsModeSheetOpen(false)}
        title="Privacy Mode"
      >
        <div className="flex flex-col gap-3">
          {accessModeOptions.map((option) => {
            const isSelected = option.value === currentAccessMode;
            return (
              <button
                key={option.value}
                onClick={() => handleUpdateAccessMode(option.value)}
                disabled={isUpdatingMode}
                className={cn(
                  "flex items-center justify-between w-full p-4 rounded-2xl transition-all duration-200",
                  isUpdatingMode && !isSelected
                    ? "opacity-50"
                    : "active:scale-[0.98]",
                  isSelected
                    ? "bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/5 dark:ring-white/10"
                    : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
                )}
              >
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={cn(
                      "flex items-center justify-center h-12 w-12 rounded-full",
                      option.value === "open"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : option.value === "request"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    <option.icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[17px] font-semibold leading-tight text-foreground">
                      {option.label}
                    </span>
                    <span className="text-[14px] text-muted-foreground/80 leading-snug pr-4">
                      {option.description}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-black dark:bg-white">
                    <Check
                      className="h-4 w-4 text-white dark:text-black"
                      strokeWidth={3}
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 h-7 w-7 rounded-full border-2 border-black/10 dark:border-white/10" />
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
