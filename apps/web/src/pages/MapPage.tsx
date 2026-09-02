/**
 * Phase 9 Map Page
 * Split-pane: left = interactive Vietnam map, right = province info panel.
 * Per ADR-007: Hybrid i18n approach.
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { VietnamMap } from "../components/common/VietnamMap";
import { ProvinceInfoPanel } from "../components/province/ProvinceInfoPanel";
import styles from "./MapPage.module.css";

export interface ProvinceSelection {
  /** Province code — stable identifier used for coordinate lookups */
  provinceCode: string;
  /** Province display name */
  provinceName: string;
  /** Centroid latitude in degrees */
  latitude: number;
  /** Centroid longitude in degrees */
  longitude: number;
}

export function MapPage() {
  const { t } = useTranslation();

  // ── Province selection state ─────────────────────────────────────────────────
  const [selectedProvince, setSelectedProvince] = useState<ProvinceSelection | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // ── Map interaction handlers ───────────────────────────────────────────────
  const handleProvinceClick = useCallback((provinceName: string, provinceCode: string, latitude: number, longitude: number) => {
    // Coordinates come from the map's SVG centroid converted to lat/lng.
    // provinceCode is used as a stable, URL-safe identifier.
    // Weather lookups use coordinates (API supports lat/lng natively).
    // Risk/advisories require a real location UUID — none exist for provinces yet,
    // so those queries are skipped (shown as "unknown" in the panel).
    setSelectedProvince({ provinceCode, provinceName, latitude, longitude });
    setIsPanelOpen(true);
  }, []);

  const handleProvinceHover = useCallback((provinceName: string | null, provinceCode: string | null) => {
    // Hover is handled internally by the map for the SVG tooltip.
    // The info panel opens only on click.
    void provinceName;
    void provinceCode;
  }, []);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedProvince(null);
  }, []);

  return (
    <div className={styles.page}>
      {/* ── Header bar ────────────────────────────────────────────────────── */}
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

      {/* ── Split pane ────────────────────────────────────────────────────── */}
      <div className={`${styles.splitPane} ${isPanelOpen ? styles.panelVisible : ""}`}>

        {/* Left: Vietnam map */}
        <div className={styles.mapPane}>
          <VietnamMap
            interactive={true}
            onProvinceClick={handleProvinceClick}
            onProvinceHover={handleProvinceHover}
            selectedProvinceId={selectedProvince?.provinceCode ?? null}
          />

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
                <span className={`${styles.legendDot} ${styles.riskLow}`} />
                <span>{t("map.riskLow")}</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.riskCaution}`} />
                <span>{t("map.riskCaution")}</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.riskHigh}`} />
                <span>{t("map.riskHigh")}</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.riskUnknown}`} />
                <span>{t("map.riskUnknown")}</span>
              </div>
            </div>
          </div>

          {/* GPS Button */}
          <button className={styles.gpsButton} title={t("map.gpsEnable")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
        </div>

        {/* Right: Province info panel (slides in on province click) */}
        {isPanelOpen && selectedProvince && (
          <div className={styles.infoPane}>
            <ProvinceInfoPanel
              weatherTarget={{
                latitude: selectedProvince.latitude,
                longitude: selectedProvince.longitude,
              }}
              locationTarget={{ locationId: undefined }}
              provinceName={selectedProvince.provinceName}
              onClose={handlePanelClose}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.lastUpdated}>
          {t("map.lastUpdated")}: —
        </span>
      </div>
    </div>
  );
}
