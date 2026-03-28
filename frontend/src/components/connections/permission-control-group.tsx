import { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PermissionControlGroupProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function PermissionControlGroup({
  title,
  isOpen,
  onToggle,
  children,
}: PermissionControlGroupProps) {
  return (
    <div className="first:rounded-t-3xl last:rounded-b-3xl rounded-[32px] bg-white/60 backdrop-blur-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-zinc-900/60 dark:ring-white/10 transition-all duration-500 hover:-translate-y-1">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-6 py-6 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-colors"
      >
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        {isOpen ? (
          <ChevronUp className="h-6 w-6 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-6 w-6 text-slate-400" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 pt-2">
          <div className="space-y-6">{children}</div>
        </div>
      )}
    </div>
  );
}
