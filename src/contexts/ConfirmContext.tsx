"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "neutral" | "danger" | "success" | "warning";

type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string | null; // null hides cancel (alert-style)
  tone?: Tone;
  /** Set to "icon-only" to show just the tone icon, "none" for nothing */
  iconStyle?: "default" | "icon-only" | "none";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type QueuedConfirm = ConfirmOptions & {
  resolve: (v: boolean) => void;
};

const TONE_STYLES: Record<
  Tone,
  { icon: string; ring: string; btnBg: string; btnHover: string }
> = {
  neutral: {
    icon: "?",
    ring: "bg-[var(--color-ochre-100)] text-[var(--color-ochre-700)]",
    btnBg: "bg-[var(--color-ochre-500)] text-[var(--color-cream)]",
    btnHover: "hover:bg-[var(--color-ochre-600)]",
  },
  danger: {
    icon: "!",
    ring: "bg-[var(--color-brick-soft)] text-[var(--color-brick)]",
    btnBg: "bg-[var(--color-brick-solid)] text-white",
    btnHover: "hover:opacity-90",
  },
  success: {
    icon: "✓",
    ring: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
    btnBg: "bg-[var(--color-sage-600)] text-[var(--color-cream)]",
    btnHover: "hover:bg-[var(--color-sage-700)]",
  },
  warning: {
    icon: "!",
    ring: "bg-[var(--color-ochre-100)] text-[var(--color-ochre-700)]",
    btnBg: "bg-[var(--color-ochre-600)] text-[var(--color-cream)]",
    btnHover: "hover:bg-[var(--color-ochre-700)]",
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<QueuedConfirm | null>(null);
  const [closing, setClosing] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setClosing(false);
      setCurrent({ ...opts, resolve });
    });
  }, []);

  const finish = useCallback(
    (value: boolean) => {
      if (!current) return;
      setClosing(true);
      // Resolve immediately so callers can react; modal slides out, then unmounts
      current.resolve(value);
      setTimeout(() => setCurrent(null), 180);
    },
    [current],
  );

  // ESC to cancel, Enter to confirm
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter") finish(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, finish]);

  // Autofocus the primary button when modal opens
  useEffect(() => {
    if (current && !closing) {
      // Small delay so the element is mounted + animation can start
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [current, closing]);

  // Lock body scroll while open
  useEffect(() => {
    if (current && !closing) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [current, closing]);

  const tone = current?.tone ?? "neutral";
  const styles = TONE_STYLES[tone];
  const iconStyle = current?.iconStyle ?? "default";
  const cancelLabel = current?.cancelLabel === null ? null : current?.cancelLabel ?? "Cancel";
  const confirmLabel = current?.confirmLabel ?? "Confirm";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 ${
            closing ? "animate-fade-out" : "animate-fade-in"
          }`}
          style={{ background: "rgba(15, 10, 8, 0.55)" }}
          onClick={() => finish(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-md rounded-2xl bg-[var(--color-paper)] p-6 sm:p-7 shadow-lift ${
              closing ? "animate-fade-out" : "animate-pop-in"
            }`}
          >
            {iconStyle !== "none" && (
              <div
                className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center font-display text-3xl ${styles.ring}`}
                aria-hidden
              >
                {styles.icon}
              </div>
            )}

            <h2
              id="confirm-title"
              className="font-display text-2xl sm:text-3xl text-center tracking-tight text-[var(--color-ink)]"
            >
              {current.title}
            </h2>

            {current.body && (
              <div className="mt-3 text-center text-[var(--color-ink-soft)] text-sm leading-relaxed">
                {current.body}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 justify-center">
              {cancelLabel !== null && (
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className="px-6 py-3 rounded-pill text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)] transition-colors"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => finish(true)}
                className={`px-6 py-3 rounded-pill font-medium ${styles.btnBg} ${styles.btnHover} transition-opacity`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
