/**
 * Language Switcher Component
 * Phase 9 - i18n support
 * Per ADR-007: Hybrid i18n approach
 */

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import {
  useLanguage,
  useSetLanguage,
} from "../../hooks/useLanguageStore";
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  SupportedLanguage,
} from "../../i18n";
import styles from "./LanguageSwitcher.module.css";

export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentLang = useLanguage();
  const setLanguage = useSetLanguage();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Current language: ${LANGUAGE_NAMES[currentLang]}`}
      >
        <Globe size={15} className={styles.globeIcon} />
        <span className={styles.label}>{LANGUAGE_NAMES[currentLang]}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <ul
          className={styles.dropdown}
          role="listbox"
          aria-label="Select language"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li
              key={lang}
              role="option"
              aria-selected={lang === currentLang}
              className={`${styles.option} ${
                lang === currentLang ? styles.optionActive : ""
              }`}
              onClick={() => handleLanguageSelect(lang)}
            >
              <span className={styles.flag}>{LANGUAGE_FLAGS[lang]}</span>
              <span className={styles.optionLabel}>{LANGUAGE_NAMES[lang]}</span>
              {lang === currentLang && (
                <svg
                  className={styles.check}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8L6.5 11.5L13 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
