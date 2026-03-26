import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { explainPermission } from "@/lib/api/connections";
import type { ExplainResponse } from "@/types/permissions";
import type { PermissionControlViewModel } from "@/lib/permissions-view-model";

interface PermissionExplainWidgetProps {
  connectionId: string;
  vm: PermissionControlViewModel;
}

export function PermissionExplainWidget({ connectionId, vm }: PermissionExplainWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const handleToggle = async () => {
    if (!isOpen && !explanation && !isLoading) {
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
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        aria-expanded={isOpen}
      >
        <HelpCircle className="h-4 w-4" />
        {getLabel()}
        {isOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
      </button>

      {isOpen && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details...
            </div>
          ) : error ? (
            <p className="text-rose-600">{error}</p>
          ) : explanation ? (
            <div className="space-y-3">
              <p className="text-slate-700 leading-relaxed font-medium">
                {explanation.reason}
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
                        <li key={i} className="text-xs text-slate-600 font-mono">
                          {step}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">No specific trace steps available.</li>
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
