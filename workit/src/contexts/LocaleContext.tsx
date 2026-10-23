"use client";

/**
 * Locale + translation context.
 *
 * Workit ships English-only at launch but every user-facing string should
 * flow through `useTranslation()` so swapping in a translated dictionary
 * later is a one-line registration in `DICTIONARIES`.
 *
 * Stored in localStorage so the choice survives reloads. Reads the browser's
 * `navigator.language` as the initial guess for new visitors and falls back
 * to English if the language isn't one of SA's 11 officials.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type LocaleCode,
  type Messages,
} from "@/i18n/locales";
import enMessages from "@/i18n/messages/en";
import afMessages from "@/i18n/messages/af";
import zuMessages from "@/i18n/messages/zu";

const STORAGE_KEY = "workit_locale";

/**
 * Registered dictionaries. Add a language by importing its messages file
 * here. The English dictionary is always loaded — it's the fallback for
 * any key that hasn't been translated yet. Only registered languages are
 * offered in the switcher (see `readyLocales`).
 */
const DICTIONARIES: Partial<Record<LocaleCode, Messages>> = {
  en: enMessages,
  af: afMessages,
  zu: zuMessages,
};

/** Languages with a real dictionary — the only ones we offer in the UI. */
const READY_LOCALES = LOCALES.filter((l) => DICTIONARIES[l.code]);

/** Values for `{name}`-style placeholders in a message string. */
export type TranslateVars = Record<string, string | number>;
/** The shape of `t()` — optional vars enable `{placeholder}` interpolation. */
export type TranslateFn = (key: keyof Messages, vars?: TranslateVars) => string;

/**
 * Replace `{name}` placeholders in `template` with values from `vars`.
 * Unknown placeholders are left untouched, so a missing var shows the literal
 * `{name}` (visible in dev) rather than `undefined`.
 */
function interpolate(template: string, vars: TranslateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

type LocaleContextValue = {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
  t: TranslateFn;
  availableLocales: typeof READY_LOCALES;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function pickInitialLocale(): LocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && LOCALES.some((l) => l.code === stored)) {
    return stored as LocaleCode;
  }
  const navLang = window.navigator.language?.slice(0, 2).toLowerCase();
  const match = LOCALES.find((l) => l.code === navLang);
  return match?.code ?? DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  // Hydrate from localStorage / browser locale on mount
  useEffect(() => {
    setLocaleState(pickInitialLocale());
  }, []);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, code);
      document.documentElement.setAttribute("lang", code);
    }
  }, []);

  // Keep <html lang> in sync after hydration
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  }, [locale]);

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES.en!;
      const template = dict[key] ?? DICTIONARIES.en![key] ?? (key as string);
      return vars ? interpolate(template, vars) : template;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, availableLocales: READY_LOCALES }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Allow components to render outside the provider during tests / SSR
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: ((key, vars) => {
        const template =
          (DICTIONARIES.en as Messages | undefined)?.[key] ?? (key as string);
        return vars ? interpolate(template, vars) : template;
      }) as TranslateFn,
      availableLocales: READY_LOCALES,
    };
  }
  return ctx;
}
