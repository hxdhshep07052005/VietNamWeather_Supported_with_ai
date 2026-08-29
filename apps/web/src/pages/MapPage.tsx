/**
 * Phase 9 Map Page
 * Weather map with location markers and risk overlay
 * Per ADR-007: Hybrid i18n approach
 */

import { useTranslation } from "react-i18next";
import styles from "./MapPage.module.css";

export function MapPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("map.title")}</h1>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder={t("map.searchPlaceholder")}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.mapContainer}>
        {/* Map placeholder - will integrate MapLibre GL */}
        <div className={styles.mapPlaceholder}>
          <div className={styles.mapLoading}>
            <div className={styles.spinner}></div>
            <p>{t("common.loading")}</p>
          </div>
        </div>

        {/* Layer Controls */}
        <div className={styles.layerPanel}>
          <h3 className={styles.panelTitle}>{t("map.layers")}</h3>
          <div className={styles.layerList}>
            <label className={styles.layerItem}>
              <input type="checkbox" defaultChecked />
              <span>{t("map.layerWeather")}</span>
            </label>
            <label className={styles.layerItem}>
              <input type="checkbox" />
              <span>{t("map.layerRain")}</span>
            </label>
            <label className={styles.layerItem}>
              <input type="checkbox" />
              <span>{t("map.layerWind")}</span>
            </label>
            <label className={styles.layerItem}>
              <input type="checkbox" />
              <span>{t("map.layerRisk")}</span>
            </label>
          </div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <h4 className={styles.legendTitle}>{t("map.legend")}</h4>
          <div className={styles.legendItems}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.riskLow}`}></span>
              <span>{t("map.riskLow")}</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.riskCaution}`}></span>
              <span>{t("map.riskCaution")}</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.riskHigh}`}></span>
              <span>{t("map.riskHigh")}</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.riskUnknown}`}></span>
              <span>{t("map.riskUnknown")}</span>
            </div>
          </div>
        </div>

        {/* GPS Button */}
        <button className={styles.gpsButton} title={t("map.gpsEnable")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>

      <div className={styles.footer}>
        <span className={styles.lastUpdated}>
          {t("map.lastUpdated")}: --
        </span>
      </div>
    </div>
  );
}
