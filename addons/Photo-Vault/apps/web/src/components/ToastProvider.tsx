import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Banner } from "./Banner";

export type ToastType = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message: React.ReactNode;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "title" | "message">> {
  id: string;
  type: ToastType;
  durationMs: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
  dismiss: (id: string) => void;
  info: (title: string, message: React.ReactNode, durationMs?: number) => void;
  success: (
    title: string,
    message: React.ReactNode,
    durationMs?: number,
  ) => void;
  warning: (
    title: string,
    message: React.ReactNode,
    durationMs?: number,
  ) => void;
  danger: (
    title: string,
    message: React.ReactNode,
    durationMs?: number,
  ) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({
  children,
  maxToasts = 3,
  defaultDurationMs = 6000,
}: {
  children: React.ReactNode;
  maxToasts?: number;
  defaultDurationMs?: number;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timeoutsRef.current.get(id);
    if (typeof t === "number") {
      window.clearTimeout(t);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const type: ToastType = opts.type ?? "info";
      const durationMs = opts.durationMs ?? defaultDurationMs;

      const item: ToastItem = {
        id,
        type,
        title: opts.title,
        message: opts.message,
        durationMs,
      };

      setToasts((prev) => {
        const next = [item, ...prev];
        return next.slice(0, maxToasts);
      });

      const t = window.setTimeout(() => dismiss(id), durationMs);
      timeoutsRef.current.set(id, t);
    },
    [defaultDurationMs, dismiss, maxToasts],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      info: (title, message, durationMs) =>
        show({ type: "info", title, message, durationMs }),
      success: (title, message, durationMs) =>
        show({ type: "success", title, message, durationMs }),
      warning: (title, message, durationMs) =>
        show({ type: "warning", title, message, durationMs }),
      danger: (title, message, durationMs) =>
        show({ type: "danger", title, message, durationMs }),
    }),
    [dismiss, show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="toast-viewport" aria-label="Notifications">
            {toasts.map((t) => (
              <div
                key={t.id}
                role={t.type === "danger" ? "alert" : "status"}
                aria-live={t.type === "danger" ? "assertive" : "polite"}
              >
                <Banner
                  type={t.type}
                  title={t.title}
                  message={t.message}
                  onDismiss={() => api.dismiss(t.id)}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
