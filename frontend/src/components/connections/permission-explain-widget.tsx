import { useState, useEffect, useCallback } from "react";
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from "lucide-react";
import { explainPermission } from "@/lib/api/connections";
import type { ExplainResponse } from "@/types/permissions";
import type { PermissionControlViewModel } from "@/lib/permissions-view-model";

interface PermissionExplainWidgetProps {
  connectionId: string;
  vm: PermissionControlViewModel;
  isRefreshing?: boolean;
}

export function PermissionExplainWidget({
  connectionId,
  vm,
  isRefreshing,
}: PermissionExplainWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const fetchExplanation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await explainPermission(connectionId, vm.key);
      setExplanation(data);
    } catch (err) {
      setError("Could not load explanation.");
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, vm.key]);

  // Clear explanation and refetch if the underlying permission state changes
  useEffect(() => {
    setExplanation(null);
  }, [vm.effectiveEffect, vm.overrideEffect]);

  useEffect(() => {
    // Wait until we are no longer refreshing the policy to fetch the explanation,
    // so we don't accidentally fetch and cache an explanation for a stale policy state.
    if (isOpen && !explanation && !isLoading && !error && !isRefreshing) {
      void fetchExplanation();
    }
  }, [isOpen, explanation, isLoading, error, isRefreshing, fetchExplanation]);

  const handleToggle = () => {
    if (!isOpen && error) {
      // Clear error on reopen to retry
      setError(null);
    }
    setIsOpen(!isOpen);
  };

  const getLabel = () => {
    if (vm.hasGuardrailIntervention) {
      return "Why is this limited?";
    }
    if (vm.isOverridden) {
      return "Why this custom setting?";
    }
    return "Why this setting?";
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded-[16px]"
          aria-expanded={isOpen}
        >
          <HelpCircle className="h-4 w-4" />
          {getLabel()}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </button>
        {isOpen && isRefreshing && (
          <span className="text-xs font-medium text-slate-400 animate-pulse">
            Policy updating...
          </span>
        )}
      </div>

      {isOpen && (
        <div
          className={`mt-4 rounded-[24px] p-4 border text-sm transition-opacity duration-300 ${isRefreshing ? "bg-slate-50/50 border-slate-100 opacity-60" : "bg-slate-50 border-slate-100"}`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details...
            </div>
          ) : error ? (
            <div className="flex items-start justify-between gap-4">
              <p className="text-slate-700 font-medium">
                Could not load explanation details. The current policy remains
                safely enforced.
              </p>
              <button
                onClick={() => void fetchExplanation()}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 underline underline-offset-2 shrink-0 mt-0.5"
              >
                Retry
              </button>
            </div>
          ) : explanation ? (
            <div className="space-y-3">
              <p className="text-slate-700 leading-relaxed font-medium">
                {explanation.reason ||
                  "No specific reason was provided by the system, but the displayed policy is actively enforced."}
              </p>

              <div className="pt-2">
                <button
                  onClick={() => setShowTechnical(!showTechnical)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800"
                >
                  <Search className="h-3 w-3" />
                  {showTechnical ? "Hide trace" : "View exact system trace"}
                </button>

                {showTechnical && (
                  <ul className="mt-3 space-y-1.5 border-l-2 border-slate-200 pl-3">
                    {explanation.trace.length > 0 ? (
                      explanation.trace.map((step, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-600 font-mono"
                        >
                          {step}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">
                        No specific trace steps available.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
