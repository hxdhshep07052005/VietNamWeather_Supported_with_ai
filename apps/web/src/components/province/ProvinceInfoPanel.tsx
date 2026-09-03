/**
 * Province Info Panel — Right pane of the map layout.
 * Displays real-time weather observation, risk level, and advisories
 * for the province the user has selected on the map.
 *
 * Phase 9 — split-pane map layout.
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { gsap } from "gsap";

import { useAuthStore } from "../../hooks/useAuthStore";
import { useProvinceWeather } from "../../hooks/useProvinceWeather";
import type { ProvinceWeatherTarget } from "../../hooks/useProvinceWeather";
import { useProvinceRisk } from "../../hooks/useProvinceRisk";
import type { ProvinceRiskTarget } from "../../hooks/useProvinceRisk";
import { useProvinceAdvisories } from "../../hooks/useProvinceAdvisories";
import type {
  RiskAssessmentResponse,
  WeatherConditionCode,
  CurrentWeatherSection,
} from "@vietnam-weather/contracts";

import styles from "./ProvinceInfoPanel.module.css";

// ─── Advisory type (mirrors backend advisory-service.ts Advisory interface) ─────
export type AdvisorySeverity = "info" | "caution" | "high";
export type AdvisoryKind = "wind" | "precipitation" | "visibility" | "thunderstorm";

export interface Advisory {
  readonly advisoryId: string;
  readonly locationId: string;
  readonly observedAt: string;
  readonly kind: AdvisoryKind;
  readonly severity: AdvisorySeverity;
  readonly metricValue: number;
  readonly thresholdValue: number;
  readonly unit: "m/s" | "mm" | "m";
  readonly language: "vi" | "en";
}

// ─── Colour tokens matching the risk contract ─────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  low: "#4CAF50",
  caution: "#FF9800",
  high: "#F44336",
  unknown: "#9E9E9E",
};

// ─── Icons (inline SVG, no external dependency) ───────────────────────────────
function WindIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
    </svg>
  );
}

function RainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
      <line x1="16" y1="13" x2="16" y2="21" />
      <line x1="8" y1="13" x2="8" y2="21" />
      <line x1="12" y1="15" x2="12" y2="23" />
      <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    </svg>
  );
}

function ThermometerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}

function VisibilityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.iconAlert}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.iconOk}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={styles.iconClose}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Condition code helpers ────────────────────────────────────────────────────

const CONDITION_CODE_MAP: Record<WeatherConditionCode, string> = {
  clear: "clear",
  partly_cloudy: "partly_cloudy",
  cloudy: "cloudy",
  fog: "fog",
  drizzle: "drizzle",
  rain: "rain",
  heavy_rain: "heavy_rain",
  thunderstorm: "thunderstorm",
  sleet: "sleet",
  snow: "snow",
  hail: "hail",
  unknown: "unknown",
};

interface WeatherMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  unit?: string;
  accent?: string;
}

function WeatherMetric({ icon, label, value, unit, accent }: WeatherMetricProps) {
  if (value === null || value === undefined) {
    return (
      <div className={styles.metric}>
        <span className={styles.metricIcon}>{icon}</span>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValue} style={{ color: "#9E9E9E" }}>—</span>
      </div>
    );
  }
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} style={{ color: accent ?? "inherit" }}>
        {value}{unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
    </div>
  );
}

interface AdvisoryItemProps {
  advisory: Advisory;
  t: TFunction;
}

function AdvisoryItem({ advisory, t }: AdvisoryItemProps) {
  const severityColor =
    advisory.severity === "high"
      ? "#F44336"
      : advisory.severity === "caution"
      ? "#FF9800"
      : "#2196F3";

  const kindLabel = t(`infoPanel.advisories.kind.${advisory.kind}`);
  const severityLabel = t(`infoPanel.advisories.severity.${advisory.severity}`);

  return (
    <li className={styles.advisoryItem} style={{ borderLeftColor: severityColor }}>
      <div className={styles.advisoryHeader}>
        <span className={styles.advisoryKind}>{kindLabel}</span>
        <span className={styles.advisorySeverity} style={{ color: severityColor }}>
          {severityLabel}
        </span>
      </div>
      <div className={styles.advisoryMeta}>
        {t("infoPanel.advisories.metric", {
          value: advisory.metricValue,
          unit: advisory.unit,
          threshold: advisory.thresholdValue,
        })}
      </div>
    </li>
  );
}

interface RiskBadgeProps {
  risk: RiskAssessmentResponse | null | undefined;
  isLoading: boolean;
  t: TFunction;
}

function RiskBadge({ risk, isLoading, t }: RiskBadgeProps) {
  if (isLoading) {
    return (
      <div className={styles.riskBadge} style={{ background: "#607D8B" }}>
        <span className={styles.riskLabel}>—</span>
      </div>
    );
  }
  if (!risk) {
    return (
      <div className={styles.riskBadge} style={{ background: "#9E9E9E" }}>
        <span className={styles.riskLabel}>{t("infoPanel.risk.unknown")}</span>
      </div>
    );
  }
  const color = RISK_COLORS[risk.level] ?? "#9E9E9E";
  const label = t(`infoPanel.risk.level.${risk.level}`);
  const confidence = Math.round(risk.confidence_percent ?? 0);
  return (
    <div className={styles.riskBadge} style={{ background: color }}>
      <span className={styles.riskLabel}>{label}</span>
      <span className={styles.riskConfidence}>{confidence}%</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ProvinceInfoPanelProps {
  /** Target for weather lookup (coordinates preferred, locationId for risk/advisories) */
  weatherTarget: ProvinceWeatherTarget;
  /** Target for risk/advisory lookup (requires real location UUID) */
  locationTarget: ProvinceRiskTarget;
  /** Human-readable province name, shown in the panel header */
  provinceName: string | null;
  onClose: () => void;
}

export function ProvinceInfoPanel({ weatherTarget, locationTarget, provinceName, onClose }: ProvinceInfoPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: weather, isLoading: weatherLoading, isError: weatherError } = useProvinceWeather(weatherTarget);
  const { data: risk, isLoading: riskLoading } = useProvinceRisk(locationTarget);
  const { data: advisories, isLoading: advisoriesLoading } = useProvinceAdvisories(locationTarget);

  // GSAP slide-in on mount
  useEffect(() => {
    if (!panelRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        panelRef.current,
        { x: 60, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" }
      );
    }, panelRef);
    return () => ctx.revert();
  }, []);

  // GSAP slide-out on unmount
  useEffect(() => {
    return () => {
      if (!panelRef.current) return;
      gsap.to(panelRef.current, { x: 60, opacity: 0, duration: 0.3, ease: "power2.in" });
    };
  }, []);

  // Extract current observation from weather response
  // Guard against union variants (success/degraded vs pending/error/unavailable)
  // TanStack Query wraps as { data: WeatherResponse } where WeatherResponse has { status, data: { current }, correlationId }
  const w = weather?.data;
  const queryData =
    w?.status === "success" || w?.status === "degraded"
      ? (w as { data: { current: CurrentWeatherSection | null } })
      : null;
  const current = queryData?.data?.current?.value ?? null;
  const freshness = queryData?.data?.current?.freshness ?? null;
  const freshnessTime = freshness?.assessedAt ?? null;

  // Advisories — the hook returns { data: { data: Advisory[], ... } }
  const advisoryList = advisories?.data?.data ?? [];
  const dangerAdvisories = advisoryList.filter((a) => a.severity === "high");
  const otherAdvisories = advisoryList.filter((a) => a.severity !== "high");

  const navigate = useNavigate();
  const { user, saveLocation, removeSavedLocation } = useAuthStore();
  const isSaved = user?.savedLocations?.some(
    (l) => l.name.toLowerCase() === provinceName?.toLowerCase()
  );

  const handleToggleSave = () => {
    if (!provinceName) return;
    if (isSaved) {
      removeSavedLocation(provinceName);
    } else {
      const res = saveLocation({
        name: provinceName,
        provinceCode: provinceName,
      });
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  const handlePlanRoute = () => {
    if (!provinceName) return;
    navigate(`/route?to=${encodeURIComponent(provinceName)}`);
  };

  const handleViewLocationDetail = () => {
    if (!provinceName) return;
    navigate(`/location/${encodeURIComponent(provinceName)}`);
  };

  return (
    <div ref={panelRef} className={styles.panel} role="complementary" aria-label={t("infoPanel.ariaLabel")}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.provinceName}>{provinceName ?? t("infoPanel.selectProvince")}</h2>
          {weatherTarget && (
            <span className={styles.freshness}>
              {weatherLoading ? t("infoPanel.loading") : t("infoPanel.lastUpdated", {
                time: freshnessTime
                  ? new Date(freshnessTime).toLocaleTimeString("vi-VN")
                  : "—",
              })}
            </span>
          )}
        </div>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label={t("infoPanel.close")}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Quick Actions Bar */}
      <div className={styles.actionsBar}>
        <button
          type="button"
          onClick={handleToggleSave}
          className={`${styles.actionBtn} ${isSaved ? styles.actionBtnSaved : ""}`}
        >
          <span>{isSaved ? "★ Đã lưu" : "☆ Lưu địa điểm"}</span>
        </button>

        <button
          type="button"
          onClick={handlePlanRoute}
          className={styles.actionBtn}
        >
          <span>🚗 Lên lộ trình đến đây</span>
        </button>

        <button
          type="button"
          onClick={handleViewLocationDetail}
          className={styles.actionBtn}
        >
          <span>🔍 Xem chi tiết</span>
        </button>
      </div>

      {/* Danger alerts */}
      {dangerAdvisories.length > 0 && (
        <div className={styles.dangerBanner} role="alert">
          <AlertTriangleIcon />
          <span>{t("infoPanel.dangerAlert")}</span>
        </div>
      )}

      {/* Risk badge */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t("infoPanel.riskLevel")}</span>
        <RiskBadge risk={risk?.data} isLoading={riskLoading} t={t} />
      </div>

      {/* Weather observation */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t("infoPanel.currentWeather")}</span>
        {weatherLoading ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : weatherError ? (
          <div className={styles.errorMsg}>{t("infoPanel.weatherError")}</div>
        ) : current ? (
          <div className={styles.metricsGrid}>
            <WeatherMetric
              icon={<ThermometerIcon />}
              label={t("infoPanel.temp")}
              value={current.temperatureCelsius}
              unit="°C"
              accent="#FF5722"
            />
            <WeatherMetric
              icon={<WindIcon />}
              label={t("infoPanel.wind")}
              value={current.windSpeedMetresPerSecond != null ? Math.round(current.windSpeedMetresPerSecond * 3.6) : null}
              unit={t("infoPanel.unit.kph")}
            />
            <WeatherMetric
              icon={<RainIcon />}
              label={t("infoPanel.precipitation")}
              value={current.precipitationMillimetres}
              unit="mm"
              accent="#2196F3"
            />
            <WeatherMetric
              icon={<VisibilityIcon />}
              label={t("infoPanel.visibility")}
              value={current.visibilityMetres != null ? current.visibilityMetres / 1000 : null}
              unit={t("infoPanel.unit.km")}
            />
          </div>
        ) : (
          <div className={styles.emptyState}>{t("infoPanel.noWeatherData")}</div>
        )}
      </div>

      {/* Condition */}
      {current?.conditionCode && (
        <div className={styles.conditionRow}>
          <span className={styles.conditionText}>
            {t(`infoPanel.condition.${CONDITION_CODE_MAP[current.conditionCode as WeatherConditionCode] ?? "unknown"}`)}
          </span>
        </div>
      )}

      {/* Advisories */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t("infoPanel.advisories.title")}</span>
        {advisoriesLoading ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : advisoryList.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircleIcon />
            <span>{t("infoPanel.advisories.empty")}</span>
          </div>
        ) : (
          <ul className={styles.advisoriesList}>
            {otherAdvisories.map((adv) => (
              <AdvisoryItem key={adv.advisoryId} advisory={adv} t={t} />
            ))}
          </ul>
        )}
      </div>

      {/* Attribution */}
      <div className={styles.footer}>
        <span>{t("infoPanel.attribution")}</span>
      </div>
    </div>
  );
}
