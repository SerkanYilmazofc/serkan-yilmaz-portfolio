import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations, type Locale } from "./translations";
import { LanguageContext } from "./useLanguage";

const STORAGE_KEY = "sy-locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "tr";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "tr" || stored === "en") return stored;
  return "tr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "tr" ? "en" : "tr");
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translations[locale].meta.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", translations[locale].meta.description);
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      t: translations[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
