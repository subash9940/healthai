"use client";

import React, { useState, useEffect, createContext, useContext, useMemo } from "react";
import mr from "../locales/mr.json";
import hi from "../locales/hi.json";
import en from "../locales/en.json";
import ta from "../locales/ta.json";

export type Language = "en" | "hi" | "mr" | "ta";

const translations: Record<Language, any> = {
  en,
  hi,
  mr,
  ta,
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
}

export const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: (path: string) => path,
});

export function getNestedValue(obj: any, path: string): string {
  if (!obj) return path;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("swasthya_setu_lang") as Language;
      if (saved && (saved === "en" || saved === "hi" || saved === "mr" || saved === "ta")) {
        setLanguageState(saved);
      }
    } catch (e) {
      // localStorage may not be available
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("swasthya_setu_lang", lang);
      }
    } catch (e) {}
  };

  const t = (path: string): string => {
    const langObj = translations[language] || translations.en;
    const val = getNestedValue(langObj, path);
    if (val !== path) return val;
    // Fallback to English then Marathi
    const fallbackEn = getNestedValue(translations.en, path);
    if (fallbackEn !== path) return fallbackEn;
    return getNestedValue(translations.mr, path);
  };

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  return context;
}
