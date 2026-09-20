/**
 * Language Store Hook
 * Phase 9 - i18n support
 * Per ADR-007: Hybrid i18n approach
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: i18n.language as SupportedLanguage,

      setLanguage: (lang: SupportedLanguage) => {
        i18n.changeLanguage(lang);
        set({ language: lang });
      },

      toggleLanguage: () => {
        const current = get().language;
        const nextLang: SupportedLanguage =
          current === "vi" ? "en" : "vi";
        i18n.changeLanguage(nextLang);
        set({ language: nextLang });
      },
    }),
    {
      name: "vietnam-weather-language-store",
      partialize: (state) => ({ language: state.language }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useLanguage = () => useLanguageStore((s) => s.language);
export const useSetLanguage = () => useLanguageStore((s) => s.setLanguage);
export const useToggleLanguage = () => useLanguageStore((s) => s.toggleLanguage);

// Helper to check if a language is supported
export const isLanguageSupported = (lang: string): lang is SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
