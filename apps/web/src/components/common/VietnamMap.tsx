/**
 * Vietnam Map SVG Component - Detailed Province Map & Interactive Showcase
 * Phase 9 - Accurate 8-Region Classification & On-Demand Hover Preview
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { geoNaturalEarth1, geoPath, GeoProjection, GeoPermissibleObjects } from "d3-geo";
import { vietnamGeoJson } from "@xdev-asia/vietnam-map-34-provinces/core";
import { useTranslation } from "react-i18next";
import type { ProvinceGeoFeatureProperties } from "../../data/vietnamGeoJsonWGS84";
import { formatMeasurement } from "../../utils/reportRisk";
import {
  PROVINCE_MAP,
  VIETNAM_REGIONS,
  VietnamRegion,
  ProvinceData,
} from "../../data/provinces";
import styles from "./VietnamMap.module.css";



export interface VietnamMapProps {
  className?: string;
  interactive?: boolean;
  showcaseMode?: boolean;
  hideLegend?: boolean;
  viewMode?: "region" | "risk";
  onProvinceClick?: (province: string, code: string, latitude: number, longitude: number) => void;
  onProvinceHover?: (province: string | null, code: string | null) => void;
  selectedProvinceId?: string | null;
  highlightProvinceId?: string | null;
  provinceWeather?: readonly ProvinceGeoFeatureProperties[];
}

const RISK_COLORS: Record<string, string> = {
  low: "#10B981",
  caution: "#F59E0B",
  high: "#EF4444",
};

const DEFAULT_COLOR = "#64748B";

function convertCoord(x: number, y: number): [number, number] {
  const lng = 0.001971414489896501 * x + 101.74371611631345;
  const lat = 0.0016235466638734682 * y + 9.514769037393945;
  return [lng, lat];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertGeometry(geometry: any): any {
  if (!geometry || !geometry.coordinates) return geometry;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transform = (c: any): any => {
    if (Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      return convertCoord(c[0], c[1]);
    }
    if (Array.isArray(c)) {
      return c.map(transform);
    }
    return c;
  };

  return {
    ...geometry,
    coordinates: transform(geometry.coordinates),
  };
}

const SVG_WIDTH = 400;
const SVG_HEIGHT = 900;

export function VietnamMap({
  className,
  interactive = false,
  showcaseMode = false,
  hideLegend = false,
  viewMode = "region",
  onProvinceClick,
  onProvinceHover,
  selectedProvinceId,
  highlightProvinceId,
  provinceWeather,
}: VietnamMapProps) {
  const { t, i18n } = useTranslation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [activeRiskFilter, setActiveRiskFilter] = useState<"all" | "low" | "caution" | "high">("all");
  const weatherById = useMemo(
    () => new Map(provinceWeather?.map(province => [province.id, province])),
    [provinceWeather]
  );

  // Reset risk filter when view mode switches
  useEffect(() => {
    setActiveRiskFilter("all");
  }, [viewMode]);

  // Setup d3-geo projection and parse all 63 provinces
  const { provinces } = useMemo(() => {
    const proj: GeoProjection = geoNaturalEarth1()
      .center([106, 16])
      .scale(2000)
      .translate([SVG_WIDTH / 2, SVG_HEIGHT * 0.5]);

    const pathGenerator = geoPath().projection(proj);
    const features = vietnamGeoJson.features;

    const provincesList: ProvinceData[] = features.map((feature: {
      id?: string;
      properties?: Record<string, unknown>;
      geometry: { type: string; coordinates: unknown };
    }) => {
      const props = feature.properties || {};
      const key = (props["hc-key"] as string) || "";
      const meta = PROVINCE_MAP[key] || {
        name: (props.name as string) || "Unknown",
        region: "Red River Delta" as VietnamRegion,
        code: (props["hc-a2"] as string) || "",
      };

      const name = meta.name;
      const code = meta.code || (props["hc-a2"] as string) || "";
      const region = meta.region;
      const regionMeta = VIETNAM_REGIONS[region] || { vi: "Việt Nam", en: "Vietnam", color: DEFAULT_COLOR };
      const regionVi = regionMeta.vi;
      const featureId = key || feature.id || code;

      // Accurate WGS-84 coordinates
      let latitude = props.latitude ? parseFloat(String(props.latitude)) : NaN;
      let longitude = props.longitude ? parseFloat(String(props.longitude)) : NaN;

      const convertedGeometry = convertGeometry(feature.geometry);
      let path = "";
      let centerX = SVG_WIDTH / 2;
      let centerY = SVG_HEIGHT / 2;

      try {
        path = pathGenerator(convertedGeometry as GeoPermissibleObjects) || "";
      } catch {
        // Fallback for malformed geometry
      }

      try {
        const centroid = pathGenerator.centroid(convertedGeometry as GeoPermissibleObjects);
        if (centroid && centroid[0] !== undefined && centroid[1] !== undefined) {
          centerX = centroid[0];
          centerY = centroid[1];
          if (isNaN(latitude) || isNaN(longitude)) {
            const inverted = proj.invert ? proj.invert([centerX, centerY]) : null;
            if (inverted) {
              longitude = inverted[0];
              latitude = inverted[1];
            }
          }
        }
      } catch {
        // Keep default centroid
      }

      // SVG and weather records share the GIS ID; short codes are not unique.
      const weather = weatherById.get(featureId);
      const riskLevel = weather?.riskLevel ?? "unknown";
      const estimatedTemp = formatMeasurement(weather?.temp);

      const color =
        viewMode === "risk"
          ? (RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || DEFAULT_COLOR)
          : (regionMeta.color || DEFAULT_COLOR);

      return {
        id: featureId,
        name,
        code,
        path,
        centerX,
        centerY,
        latitude: isNaN(latitude) ? 16.0 : latitude,
        longitude: isNaN(longitude) ? 106.0 : longitude,
        region,
        regionVi,
        color,
        riskLevel,
        estimatedTemp,
      };
    });

    return { provinces: provincesList };
  }, [viewMode, weatherById]);

  // Tight viewBox bounding calculation
  const tightViewBox = useMemo(() => {
    if (provinces.length === 0) return `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    provinces.forEach((p) => {
      if (!p.path) return;
      const matches = p.path.matchAll(/([ML])\s*([-\d.]+)[,\s]+([-\d.]+)/g);
      for (const m of matches) {
        const x = parseFloat(m[2] ?? "");
        const y = parseFloat(m[3] ?? "");
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    });

    if (!isFinite(minX)) return `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;

    const padX = (maxX - minX) * 0.04;
    const padY = (maxY - minY) * 0.04;
    minX -= padX;
    minY -= padY;
    maxX += padX;
    maxY += padY;

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [provinces]);

  const glowCenter = useMemo(() => {
    const parts = tightViewBox.split(" ").map(parseFloat);
    const [p0, p1, p2, p3] = parts;
    if (parts.length === 4 && p0 !== undefined && p1 !== undefined && p2 !== undefined && p3 !== undefined && !isNaN(p0) && !isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      return { cx: p0 + p2 / 2, cy: p1 + p3 / 2, rx: p2 / 1.8, ry: p3 / 1.9 };
    }
    return { cx: SVG_WIDTH / 2, cy: SVG_HEIGHT / 2, rx: 160, ry: 360 };
  }, [tightViewBox]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const handleProvinceClick = useCallback(
    (province: ProvinceData) => {
      if ((interactive || showcaseMode) && onProvinceClick) {
        onProvinceClick(province.name, province.code, province.latitude, province.longitude);
      }
    },
    [interactive, showcaseMode, onProvinceClick]
  );

  const handleProvinceHover = useCallback(
    (province: ProvinceData | null) => {
      setHoveredProvince(province?.id ?? null);
      if (onProvinceHover) {
        onProvinceHover(province?.name ?? null, province?.code ?? null);
      }
    },
    [onProvinceHover]
  );

  // Active province for on-demand hover/click display
  const activeProvinceData = useMemo(() => {
    const target = hoveredProvince || selectedProvinceId || highlightProvinceId;
    if (!target) return null;
    return (
      provinces.find(
        (p) => p.id === target || p.code === target || p.name === target
      ) || null
    );
  }, [hoveredProvince, selectedProvinceId, highlightProvinceId, provinces]);
  const activeWeather = activeProvinceData ? weatherById.get(activeProvinceData.id) : undefined;
  const sourceTime = activeWeather?.assessment?.source_time;
  const sourceDate = sourceTime ? new Date(sourceTime) : null;
  const hasSourceTime = sourceDate !== null && Number.isFinite(sourceDate.getTime());
  const isEn = i18n.language !== "vi";
  const isOldWeather = activeWeather?.freshnessState === "aging" || activeWeather?.freshnessState === "stale" || activeWeather?.freshnessState === "expired";

  return (
    <div className={`${styles.mapContainer} ${showcaseMode ? styles.showcaseContainer : ""} ${className || ""}`}>
      {/* SVG Map Canvas */}
      <svg
        viewBox={tightViewBox}
        className={`${styles.mapSvg} ${isLoaded ? styles.loaded : ""}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="mapGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.45" />
          </filter>

          <radialGradient id="countryGlowV2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 205, 0, 0.25)" />
            <stop offset="70%" stopColor="rgba(0, 102, 204, 0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Ambient Backing Glow */}
        <ellipse
          cx={glowCenter.cx}
          cy={glowCenter.cy}
          rx={glowCenter.rx}
          ry={glowCenter.ry}
          fill="url(#countryGlowV2)"
          className={styles.ambientGlow}
        />

        {/* Vietnam Provinces Group */}
        <g filter="url(#mapGlowFilter)" className={styles.provincesGroup}>
          {provinces.map((province, index) => {
            const isRiskMatch = activeRiskFilter === "all" || province.riskLevel === activeRiskFilter;
            const isHovered = hoveredProvince === province.id;
            const isSelected = selectedProvinceId === province.id || selectedProvinceId === province.code || selectedProvinceId === province.name;
            const isHighlighted = highlightProvinceId === province.id || highlightProvinceId === province.code || highlightProvinceId === province.name;

            const fillColor = isSelected
              ? "#FFCD00"
              : isHovered
              ? "#FBBF24"
              : isHighlighted
              ? "#38BDF8"
              : province.color;

            return (
              <path
                key={province.id}
                d={province.path}
                fill={fillColor}
                fillOpacity={isRiskMatch ? (isSelected || isHovered ? 1 : 0.85) : 0.12}
                stroke="#FFFFFF"
                strokeWidth={isRiskMatch ? (isSelected || isHovered ? 2.0 : 0.7) : 0.35}
                strokeOpacity={isRiskMatch ? 0.9 : 0.2}
                className={`${styles.province} ${interactive || showcaseMode ? styles.interactive : ""}`}
                style={{ animationDelay: `${(index % 20) * 0.015}s` }}
                onMouseEnter={() => handleProvinceHover(province)}
                onMouseLeave={() => handleProvinceHover(null)}
                onClick={() => handleProvinceClick(province)}
              />
            );
          })}
        </g>

      </svg>

      {/* On-Demand Province Hover / Selection Info Card (Only shown when hovering or selected) */}
      {activeProvinceData && (
        <div
          role="tooltip"
          className={styles.quickProvinceCard}
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (onProvinceClick) {
              onProvinceClick(
                activeProvinceData.name,
                activeProvinceData.code,
                activeProvinceData.latitude,
                activeProvinceData.longitude
              );
            }
          }}
          title={t("landing.clickToExplore")}
        >
          <div className={styles.quickCardHeader}>
            <div className={styles.quickTitleWrap}>
              <span className={styles.quickCardTitle}>{activeProvinceData.name}</span>
              <span className={styles.quickRegionBadge}>
                {i18n.language === "vi" ? activeProvinceData.regionVi : activeProvinceData.region}
              </span>
            </div>
            <span
              className={styles.quickCardRiskBadge}
              data-risk-level={activeProvinceData.riskLevel}
            >
              {activeProvinceData.riskLevel === "high"
                ? t("landing.weatherHighRisk")
                : activeProvinceData.riskLevel === "caution"
                ? t("landing.weatherCaution")
                : activeProvinceData.riskLevel === "low"
                ? t("landing.weatherSafe")
                : (i18n.language === "vi" ? "Chưa đủ dữ liệu" : "Unknown")}
            </span>
          </div>
          <div className={styles.quickCardBody}>
            <div className={styles.quickTemp}>
              <span className={styles.tempValue}>
                {activeProvinceData.estimatedTemp}{Number.isFinite(activeWeather?.temp) ? "°C" : ""}
              </span>
              <div className={styles.weatherTime} data-stale={isOldWeather}>
                {activeWeather?.dataState === "loading" ? t("common.loading")
                  : activeWeather?.dataState === "error" ? (isEn ? "Weather unavailable" : "Không tải được thời tiết")
                  : !Number.isFinite(activeWeather?.temp) ? (isEn ? "Weather unavailable" : "Chưa có dữ liệu thời tiết")
                  : <>
                    {isOldWeather && <span>{isEn ? "Older data" : "Dữ liệu cũ"}</span>}
                    {hasSourceTime && sourceDate ? <span>
                      {t("common.updatedAt")}: {" "}
                      <time dateTime={sourceTime ?? undefined}>
                        {sourceDate.toLocaleString(isEn ? "en-GB" : "vi-VN", {
                          timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
                        })} (UTC+7)
                      </time>
                    </span> : <span>{isEn ? "Update time unavailable" : "Chưa có thời điểm cập nhật"}</span>}
                  </>}
              </div>
            </div>
          </div>
          <div className={styles.quickCardHint}>
            {t("landing.clickToExplore")}
          </div>
        </div>
      )}

      {/* 8-Region Legend */}
      {!hideLegend && (
        <div className={styles.legendContainer}>
          {viewMode === "region" ? (
            <div className={styles.legendPills}>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#0EA5E9" }} />Tây Bắc</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#3B82F6" }} />Đông Bắc</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#10B981" }} />ĐBS Hồng</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#F59E0B" }} />Bắc Trung Bộ</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#EC4899" }} />Nam Trung Bộ</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#8B5CF6" }} />Tây Nguyên</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#6366F1" }} />Đông Nam Bộ</span>
              <span className={styles.legendPill}><span className={styles.dot} style={{ background: "#14B8A6" }} />ĐBS Cửu Long</span>
            </div>
          ) : (
            <div className={styles.legendPills}>
              <button
                type="button"
                className={`${styles.legendPill} ${activeRiskFilter === "low" ? styles.legendPillActive : ""}`}
                onClick={() => {
                  const next = activeRiskFilter === "low" ? "all" : "low";
                  setActiveRiskFilter(next);
                  const firstMatch = provinces.find((p) => p.riskLevel === "low");
                  if (firstMatch && onProvinceClick) {
                    onProvinceClick(firstMatch.name, firstMatch.code, firstMatch.latitude, firstMatch.longitude);
                  }
                }}
                title={i18n.language === "vi" ? "Lọc tỉnh thành thời tiết thuận lợi (Xanh)" : "Filter safe provinces"}
              >
                <span className={styles.dot} style={{ background: "#10B981" }} />
                <span>{i18n.language === "vi" ? "Thuận lợi" : "Safe"}</span>
              </button>
              <button
                type="button"
                className={`${styles.legendPill} ${activeRiskFilter === "caution" ? styles.legendPillActive : ""}`}
                onClick={() => {
                  const next = activeRiskFilter === "caution" ? "all" : "caution";
                  setActiveRiskFilter(next);
                  const firstMatch = provinces.find((p) => p.riskLevel === "caution");
                  if (firstMatch && onProvinceClick) {
                    onProvinceClick(firstMatch.name, firstMatch.code, firstMatch.latitude, firstMatch.longitude);
                  }
                }}
                title={i18n.language === "vi" ? "Lọc tỉnh thành cần lưu ý (Vàng)" : "Filter caution provinces"}
              >
                <span className={styles.dot} style={{ background: "#F59E0B" }} />
                <span>{i18n.language === "vi" ? "Lưu ý" : "Caution"}</span>
              </button>
              <button
                type="button"
                className={`${styles.legendPill} ${activeRiskFilter === "high" ? styles.legendPillActive : ""}`}
                onClick={() => {
                  const next = activeRiskFilter === "high" ? "all" : "high";
                  setActiveRiskFilter(next);
                  const firstMatch = provinces.find((p) => p.riskLevel === "high");
                  if (firstMatch && onProvinceClick) {
                    onProvinceClick(firstMatch.name, firstMatch.code, firstMatch.latitude, firstMatch.longitude);
                  }
                }}
                title={i18n.language === "vi" ? "Lọc tỉnh thành nguy hiểm (Đỏ)" : "Filter hazard high risk provinces"}
              >
                <span className={styles.dot} style={{ background: "#EF4444" }} />
                <span>{i18n.language === "vi" ? "Rủi ro cao" : "Hazard"}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
