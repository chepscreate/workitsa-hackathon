"use client";

import { useEffect, useState } from "react";

/**
 * Encourages PWA install on supported platforms.
 *  - Chrome / Edge: catches the `beforeinstallprompt` event and shows a custom card
 *    with our copy + brand button.
 *  - iOS Safari: detects standalone-capable iOS and shows a "Tap Share → Add to
 *    Home Screen" instruction card (Apple doesn't expose a programmatic prompt).
 * Dismiss is remembered in localStorage for 30 days.
 */

const DISMISS_KEY = "workit_install_dismissed_until";
const DISMISS_DAYS = 30;

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  // Chrome / installed PWA
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS
  if ((window.navigator as { standalone?: boolean }).standalone) return true;
  return false;
}

function isiOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function dismissedRecently(): boolean {
  if (typeof window === "undefined") return true;
  const until = window.localStorage.getItem(DISMISS_KEY);
  return !!until && Date.now() < Number(until);
}

function rememberDismissal() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DISMISS_KEY,
    String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if (isiOS()) {
      // Delay a bit so it doesn't surprise users on first paint
      const t = setTimeout(() => {
        setShowIOS(true);
        setHidden(false);
      }, 4000);
      return () => clearTimeout(t);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    rememberDismissal();
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const result = await deferred.userChoice;
    if (result.outcome === "accepted") {
      setHidden(true);
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  if (hidden || (!deferred && !showIOS)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-40">
      <div className="rounded-xl bg-[var(--color-paper)] border border-[var(--color-line)] shadow-lift p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-2xl">📲</span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base text-[var(--color-ink)]">
              Install Workit
            </p>
            {deferred ? (
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                One tap — Workit lives on your home screen, opens like an app,
                no app store needed.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                Tap{" "}
                <span aria-label="iOS Share button" className="inline-block px-1.5 py-0.5 rounded bg-[var(--color-cream-2)] border border-[var(--color-line)] text-xs">
                  Share ⇪
                </span>{" "}
                then <b>Add to Home Screen</b>.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {deferred && (
                <button
                  type="button"
                  onClick={install}
                  className="px-4 py-2 rounded-pill bg-[var(--color-ochre-500)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ochre-600)]"
                >
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="px-4 py-2 rounded-pill text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-cream-2)]"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
