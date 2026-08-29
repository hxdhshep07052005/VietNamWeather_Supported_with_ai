/**
 * Phase 9 Settings Page
 * User preferences and settings
 * Per ADR-007: Hybrid i18n approach
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage, useSetLanguage } from "../hooks/useLanguageStore";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from "../i18n";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { t } = useTranslation();
  const currentLang = useLanguage();
  const setLanguage = useSetLanguage();
  
  const [temperatureUnit, setTemperatureUnit] = useState<"celsius" | "fahrenheit">("celsius");
  const [windSpeedUnit, setWindSpeedUnit] = useState<"kmh" | "mph">("kmh");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    // TODO: Save settings to backend
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("settings.title")}</h1>
      </div>

      <div className={styles.content}>
        {/* Language Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.language")}</h2>
          <div className={styles.languageOptions}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                className={`${styles.languageOption} ${currentLang === lang ? styles.languageOptionActive : ""}`}
                onClick={() => setLanguage(lang)}
              >
                <span className={styles.languageFlag}>
                  {lang === "vi" ? "🇻🇳" : "🇬🇧"}
                </span>
                <span className={styles.languageName}>{LANGUAGE_NAMES[lang]}</span>
                {currentLang === lang && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.checkIcon}>
                    <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Units Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("settings.units")}</h2>
          
          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t("settings.temperatureUnit")}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="temperature"
                  checked={temperatureUnit === "celsius"}
                  onChange={() => setTemperatureUnit("celsius")}
                />
                <span>{t("settings.celsius")}</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="temperature"
                  checked={temperatureUnit === "fahrenheit"}
                  onChange={() => setTemperatureUnit("fahrenheit")}
                />
                <span>{t("settings.fahrenheit")}</span>
              </label>
            </div>
          </div>

          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t("settings.windSpeedUnit")}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="windSpeed"
                  checked={windSpeedUnit === "kmh"}
                  onChange={() => setWindSpeedUnit("kmh")}
                />
                <span>{t("settings.kmh")}</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="windSpeed"
                  checked={windSpeedUnit === "mph"}
                  onChange={() => setWindSpeedUnit("mph")}
                />
                <span>{t("settings.mph")}</span>
              </label>
            </div>
          </div>

          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t("settings.distanceUnit")}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="distance"
                  checked={distanceUnit === "km"}
                  onChange={() => setDistanceUnit("km")}
                />
                <span>{t("settings.kilometers")}</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="distance"
                  checked={distanceUnit === "mi"}
                  onChange={() => setDistanceUnit("mi")}
                />
                <span>{t("settings.miles")}</span>
              </label>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className={styles.actions}>
          <button className={styles.saveButton} onClick={handleSave}>
            {t("settings.saveChanges")}
          </button>
          {isSaved && (
            <span className={styles.savedMessage}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t("settings.changesSaved")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
