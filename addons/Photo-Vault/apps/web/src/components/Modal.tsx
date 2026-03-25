import React, { useEffect, useId, useMemo, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  ariaLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  maxWidth?: string;
  showCloseButton?: boolean;
  variant?: "default" | "media";
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  width = "100%",
  maxWidth = "500px",
  showCloseButton = true,
  variant = "default",
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  const isMedia = variant === "media";

  const computedAriaLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    if (typeof title === "string") return title;
    return "Dialog";
  }, [ariaLabel, title]);

  const labelledBy = !isMedia && title ? titleId : undefined;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialogEl = dialogRef.current;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const getFocusable = (root: HTMLElement): HTMLElement[] => {
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      );

      return candidates.filter((el) => {
        if (el.hasAttribute("disabled")) return false;
        const ariaHidden = el.getAttribute("aria-hidden");
        if (ariaHidden === "true") return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
        return true;
      });
    };

    const focusInitial = () => {
      if (!dialogEl) return;

      // Prefer an element explicitly marked for auto focus.
      const auto = dialogEl.querySelector<HTMLElement>(
        "input[autofocus],textarea[autofocus],select[autofocus],button[autofocus],[data-autofocus='true']",
      );
      if (auto) {
        auto.focus();
        return;
      }

      const focusables = getFocusable(dialogEl);
      if (focusables.length) {
        focusables[0]?.focus();
        return;
      }

      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
        return;
      }

      dialogEl.focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;
      if (!dialogEl) return;

      const focusables = getFocusable(dialogEl);
      if (!focusables.length) {
        e.preventDefault();
        dialogEl.focus();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !dialogEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !dialogEl.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    // Delay initial focus until after mount/paint.
    const raf = window.requestAnimationFrame(focusInitial);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKeyDown);

      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function") {
        // Restore focus to where the user was before opening.
        prev.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isMedia ? "rgba(0, 0, 0, 0.95)" : "rgba(0, 0, 0, 0.6)",
        backdropFilter: isMedia ? "blur(10px)" : "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        animation: "fadeIn 0.2s ease-out",
        padding: isMedia ? 0 : "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : computedAriaLabel}
        tabIndex={-1}
        ref={dialogRef}
        style={{
          width,
          maxWidth,
          backgroundColor: isMedia ? "transparent" : "var(--bg-elevated)",
          borderRadius: isMedia ? 0 : "16px",
          boxShadow: isMedia
            ? "none"
            : "0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-primary)",
          display: "flex",
          flexDirection: "column",
          height: isMedia ? "100%" : undefined,
          maxHeight: isMedia ? "100%" : "90vh",
          animation: isMedia
            ? "fadeIn 0.2s ease-out"
            : "scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && !isMedia && (
          <div
            style={{
              padding: "20px 24px",
              borderBottom: title ? "1px solid var(--border-primary)" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {title ? (
              <div
                id={titleId}
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {title}
              </div>
            ) : (
              <div />
            )}

            {showCloseButton && (
              <button
                ref={closeButtonRef}
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          style={{
            padding: isMedia ? 0 : "24px",
            overflowY: "auto",
            flex: 1,
            color: "var(--text-primary)",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border-primary) transparent",
            display: isMedia ? "flex" : "block",
            flexDirection: isMedia ? "column" : undefined,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && !isMedia && (
          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid var(--border-primary)",
              backgroundColor: "var(--bg-elevated)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes scaleUp {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};
