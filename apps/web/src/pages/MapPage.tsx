/**
 * Phase 9 Map Page
 * Split-pane: left = interactive Vietnam map, right = province info panel.
 * Per ADR-007: Hybrid i18n approach.
 */
import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { VietnamMap } from "../components/common/VietnamMap";
import { ProvinceInfoPanel } from "../components/province/ProvinceInfoPanel";
import { PROVINCE_MAP } from "@/data/provinces";
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
  const { user } = useAuthStore();
  const isPro = user?.plan === "pro";

  // ── Province selection state ─────────────────────────────────────────────────
  const [selectedProvince, setSelectedProvince] = useState<ProvinceSelection | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pro layers state
  const [radarEnabled, setRadarEnabled] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Flatten provinces for quick search
  const allProvinces = useMemo(() => {
    return Object.entries(PROVINCE_MAP).map(([id, p]) => ({
      id,
      name: p.name,
      code: p.code,
      region: p.region,
    }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // ── Map interaction handlers ───────────────────────────────────────────────
  const handleProvinceClick = useCallback((provinceName: string, provinceCode: string, latitude: number, longitude: number) => {
    setSelectedProvince({ provinceCode, provinceName, latitude, longitude });
    setIsPanelOpen(true);
  }, []);

  const handleProvinceHover = useCallback((provinceName: string | null, provinceCode: string | null) => {
    void provinceName;
    void provinceCode;
  }, []);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedProvince(null);
  }, []);

  // Handle Search Selection
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const matched = allProvinces.find(
      (p) => p.name.toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      // Use estimated centroid
      handleProvinceClick(matched.name, matched.code, 16.0, 107.5);
    }
  };

  // Handle Pro Layer Toggle
  const handleToggleProLayer = (type: "radar" | "heatmap") => {
    if (!isPro) {
      showToast(
        type === "radar"
          ? "⭐ Lớp Radar mây dông thời gian thực là tính năng độc quyền của Gói PRO. Hãy nâng cấp để mở khóa!"
          : "⭐ Bản đồ nhiệt rủi ro cao cấp là tính năng độc quyền của Gói PRO. Hãy nâng cấp để mở khóa!"
      );
      return;
    }
    if (type === "radar") setRadarEnabled((v) => !v);
    if (type === "heatmap") setHeatmapEnabled((v) => !v);
  };

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 205, 0, 0.4)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>ℹ️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 className={styles.title}>{t("map.title")}</h1>
          {isPro ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                background: "linear-gradient(135deg, rgba(255, 205, 0, 0.2), rgba(251, 146, 60, 0.15))",
                border: "1px solid rgba(255, 205, 0, 0.5)",
                borderRadius: "999px",
                color: "#FFCD00",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              👑 PRO GOLD
            </span>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  background: "rgba(148, 163, 184, 0.15)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "999px",
                  color: "#94A3B8",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                GÓI MIỄN PHÍ
              </span>
              <Link
                to="/upgrade"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 12px",
                  background: "linear-gradient(135deg, #FFCD00, #F59E0B)",
                  borderRadius: "999px",
                  color: "#0F172A",
                  fontSize: "11px",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                ⭐ Nâng cấp Pro
              </Link>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <input
            type="text"
            list="map-provinces"
            placeholder={t("map.searchPlaceholder") || "Tìm kiếm tỉnh thành Việt Nam..."}
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <datalist id="map-provinces">
            {allProvinces.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
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
                <span>{t("map.layerWeather") || "Thời tiết"}</span>
              </label>
              <label className={styles.layerItem}>
                <input type="checkbox" />
                <span>{t("map.layerRain") || "Lượng mưa"}</span>
              </label>
              <label className={styles.layerItem}>
                <input type="checkbox" />
                <span>{t("map.layerWind") || "Tốc độ gió"}</span>
              </label>
              <label className={styles.layerItem}>
                <input type="checkbox" />
                <span>{t("map.layerRisk") || "Cấp độ rủi ro"}</span>
              </label>
              <label
                className={styles.layerItem}
                onClick={(e) => {
                  e.preventDefault();
                  handleToggleProLayer("radar");
                }}
                style={{ cursor: "pointer" }}
              >
                <input type="checkbox" checked={radarEnabled} readOnly />
                <span>📡 Radar Mây & Giông</span>
                <span style={{ fontSize: "10px", padding: "1px 5px", background: "#FFCD00", color: "#0F172A", borderRadius: "3px", fontWeight: 800 }}>PRO</span>
              </label>
              <label
                className={styles.layerItem}
                onClick={(e) => {
                  e.preventDefault();
                  handleToggleProLayer("heatmap");
                }}
                style={{ cursor: "pointer" }}
              >
                <input type="checkbox" checked={heatmapEnabled} readOnly />
                <span>🔥 Bản đồ nhiệt rủi ro</span>
                <span style={{ fontSize: "10px", padding: "1px 5px", background: "#FFCD00", color: "#0F172A", borderRadius: "3px", fontWeight: 800 }}>PRO</span>
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
