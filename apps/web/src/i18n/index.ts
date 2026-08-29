/**
 * i18n Configuration
 * Phase 9 - Multi-language support (Vietnamese & English)
 * Per ADR-007: Hybrid i18n approach
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import vi from "./locales/vi.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["vi", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  vi: "🇻🇳",
  en: "🇬🇧",
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    fallbackLng: "vi",
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "vietnam-weather-language",
    },
  });

export default i18n;
