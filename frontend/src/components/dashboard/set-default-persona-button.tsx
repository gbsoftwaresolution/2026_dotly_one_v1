"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { personaApi } from "@/lib/api";

interface SetDefaultPersonaButtonProps {
  personaId: string;
  isPrimary?: boolean;
}

export function SetDefaultPersonaButton({
  personaId,
  isPrimary,
}: SetDefaultPersonaButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (isPrimary) {
    return (
      <div className="flex items-center gap-1.5 rounded-[12px] bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20 shadow-sm">
        <Star className="h-3.5 w-3.5 fill-current" />
        Default
      </div>
    );
  }

  const handleSetDefault = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setIsLoading(true);
      await personaApi.update(personaId, { isPrimary: true });
      router.refresh(); // Refresh the page to reflect the new default
    } catch (error) {
      console.error("Failed to set default persona:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleSetDefault}
      disabled={isLoading}
      className="group flex items-center gap-1.5 rounded-[12px] border border-black/[0.06] bg-black/[0.02] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/50 transition-all duration-300 hover:bg-black/[0.06] hover:text-foreground hover:shadow-sm active:scale-95 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.08] disabled:opacity-50"
    >
      <Star className="h-3.5 w-3.5 transition-colors group-hover:fill-foreground/20" />
      {isLoading ? "Setting..." : "Set Default"}
    </button>
  );
}
