/**
 * Vietnam Map SVG Component - Detailed Province Map
 * Phase 9 - Landing Page Hero Visual
 *
 * Accurate Vietnam map with all provinces using d3-geo projection
 * Data: @xdev-asia/vietnam-map-34-provinces (Natural Earth)
 * Coordinate transform: derived from data analysis
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { geoNaturalEarth1, geoPath, GeoProjection, GeoPermissibleObjects } from "d3-geo";
import { vietnamGeoJson } from "@xdev-asia/vietnam-map-34-provinces/core";
import styles from "./VietnamMap.module.css";

interface VietnamMapProps {
  className?: string;
  interactive?: boolean;
  onProvinceClick?: (province: string, code: string) => void;
}

interface ProvinceData {
  id: string;
  name: string;
  code: string;
  path: string;
  centerX: number;
  centerY: number;
  region: string;
  color: string;
}

// Region colors matching Vietnam's 8 administrative regions
const REGION_COLORS: Record<string, string> = {
  "Northeast": "#4CAF50",         // Đông Bắc Bộ
  "Northwest": "#2196F3",          // Tây Bắc Bộ
  "Red River Delta": "#E91E63",   // Đồng bằng sông Hồng
  "North Central Coast": "#FF9800", // Bắc Trung Bộ
  "South Central Coast": "#9C27B0", // Nam Trung Bộ
  "Central Highlands": "#00BCD4",   // Tây Nguyên
  "Southeast": "#795548",           // Đông Nam Bộ
  "Mekong River Delta": "#FFC107", // Đồng bằng sông Cửu Long
};

const DEFAULT_COLOR = "#607D8B";

/**
 * Convert local coordinates from GeoJSON to lat/lng
 * Derived from linear regression on Vietnam province data:
 * - Data range: x=[130, 4188], y=[-933, 8614]
 * - Vietnam bounds: lng=[102, 110], lat=[8, 23.5]
 */
function convertCoord(x: number, y: number): [number, number] {
  const lng = 0.001971414489896501 * x + 101.74371611631345;
  const lat = 0.0016235466638734682 * y + 9.514769037393945;
  return [lng, lat];
}

// Recursively transform all coordinates in a geometry
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
  onProvinceClick,
}: VietnamMapProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Generate all province paths using Natural Earth projection
  const { provinces } = useMemo(() => {
    // Natural Earth projection - better for country-level maps
    const projection: GeoProjection = geoNaturalEarth1()
      .center([106, 16])
      .scale(2000)
      .translate([SVG_WIDTH / 2, SVG_HEIGHT * 0.5]);

    const pathGenerator = geoPath().projection(projection);

    const features = vietnamGeoJson.features;

    const provincesList: ProvinceData[] = features.map((feature: {
      id?: string;
      properties?: Record<string, string | null>;
      geometry: { type: string; coordinates: unknown };
    }) => {
      const props = feature.properties || {};
      const name = (props.name as string) || (props["hasc"] as string) || "Unknown";
      const code = (props["hc-a2"] as string) || (props.iso_3166_2 as string) || "";
      const region = (props.region as string) || "Unknown";
      const featureId = feature.id || code;
      const color = REGION_COLORS[region] || DEFAULT_COLOR;

      // Convert UTM-like coordinates to lat/lng
      const convertedGeometry = convertGeometry(feature.geometry);

      let path = "";
      let centerX = SVG_WIDTH / 2;
      let centerY = SVG_HEIGHT / 2;

      try {
        path = pathGenerator(convertedGeometry as GeoPermissibleObjects) || "";
      } catch {
        // Skip invalid geometries
      }

      try {
        const centroid = pathGenerator.centroid(convertedGeometry as GeoPermissibleObjects);
        if (centroid && centroid[0] !== undefined && centroid[1] !== undefined) {
          centerX = centroid[0];
          centerY = centroid[1];
        }
      } catch {
        // Keep default center
      }

      return {
        id: featureId,
        name,
        code,
        path,
        centerX,
        centerY,
        region,
        color,
      };
    });

    return { provinces: provincesList };
  }, []);

  // Calculate tight viewBox from rendered provinces
  const tightViewBox = useMemo(() => {
    if (provinces.length === 0) return `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    provinces.forEach((p) => {
      if (!p.path) return;
      // Extract coords from path string (rough parse)
      const matches = p.path.matchAll(/([ML])\s*([-\d.]+)[,\s]+([-\d.]+)/g);
      for (const m of matches) {
        const x = parseFloat(m[2]);
        const y = parseFloat(m[3]);
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      // Also include centroid
      if (p.centerX && p.centerY) {
        minX = Math.min(minX, p.centerX);
        minY = Math.min(minY, p.centerY);
        maxX = Math.max(maxX, p.centerX);
        maxY = Math.max(maxY, p.centerY);
      }
    });

    if (!isFinite(minX)) return `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;

    // Add small padding
    const padX = (maxX - minX) * 0.03;
    const padY = (maxY - minY) * 0.03;
    minX -= padX;
    minY -= padY;
    maxX += padX;
    maxY += padY;

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [provinces]);

  // Compute glow ellipse based on tightViewBox center
  const glowCenter = useMemo(() => {
    const parts = tightViewBox.split(" ").map(parseFloat);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      return { cx: parts[0] + parts[2] / 2, cy: parts[1] + parts[3] / 2, rx: parts[2] / 2, ry: parts[3] / 2 };
    }
    return { cx: SVG_WIDTH / 2, cy: SVG_HEIGHT / 2, rx: 160, ry: 360 };
  }, [tightViewBox]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleProvinceClick = useCallback(
    (province: ProvinceData) => {
      if (interactive && onProvinceClick) {
        onProvinceClick(province.name, province.code);
      }
    },
    [interactive, onProvinceClick]
  );

  return (
    <div className={`${styles.mapContainer} ${className || ""}`}>
      <svg
        viewBox={tightViewBox}
        className={`${styles.mapSvg} ${isLoaded ? styles.loaded : ""}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Drop shadow for provinces */}
          <filter id="mapShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
          </filter>

          {/* Ocean gradient background */}
          <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a237e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0d47a1" stopOpacity="0.15" />
          </linearGradient>

          {/* Glow effect under country */}
          <radialGradient id="countryGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 215, 0, 0.2)" />
            <stop offset="100%" stopColor="rgba(255, 215, 0, 0)" />
          </radialGradient>
        </defs>

        {/* Ocean background */}
        <rect
          x={parseFloat(tightViewBox.split(" ")[0]) - 50}
          y={parseFloat(tightViewBox.split(" ")[1]) - 50}
          width={parseFloat(tightViewBox.split(" ")[2]) + 100}
          height={parseFloat(tightViewBox.split(" ")[3]) + 100}
          fill="url(#oceanGradient)"
        />

        {/* Country glow effect */}
        <ellipse cx={glowCenter.cx} cy={glowCenter.cy} rx={glowCenter.rx} ry={glowCenter.ry} fill="url(#countryGlow)" />

        {/* Province polygons */}
        <g filter="url(#mapShadow)" className={styles.provincesGroup}>
          {provinces.map((province, index) => {
            const isHovered = hoveredProvince === province.id;
            return (
              <path
                key={province.id}
                d={province.path}
                fill={isHovered ? "#FFD700" : province.color}
                fillOpacity={isHovered ? 0.95 : 0.75}
                stroke="#FFFFFF"
                strokeWidth={isHovered ? 1.2 : 0.5}
                strokeOpacity={0.85}
                className={`${styles.province} ${interactive ? styles.interactive : ""}`}
                style={{ animationDelay: `${index * 0.01}s` }}
                onMouseEnter={() => setHoveredProvince(province.id)}
                onMouseLeave={() => setHoveredProvince(null)}
                onClick={() => handleProvinceClick(province)}
              />
            );
          })}
        </g>

        {/* Province label on hover */}
        {hoveredProvince && (() => {
          const province = provinces.find((p) => p.id === hoveredProvince);
          if (!province) return null;
          return (
            <g transform={`translate(${province.centerX}, ${province.centerY})`} className={styles.provinceLabel}>
              <rect x="-45" y="-11" width="90" height="22" rx="11" fill="rgba(0,0,0,0.85)" stroke="#FFD700" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700" style={{ pointerEvents: "none" }}>
                {province.name}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Hover tooltip (HTML overlay) */}
      {hoveredProvince && (
        <div className={styles.provinceTooltip}>
          {provinces.find((p) => p.id === hoveredProvince)?.name}
        </div>
      )}

      {/* Region legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#E91E63" }} />
          <span>ĐBS Hồng</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#4CAF50" }} />
          <span>Đông Bắc</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#2196F3" }} />
          <span>Tây Bắc</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#FF9800" }} />
          <span>Bắc Trung Bộ</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#9C27B0" }} />
          <span>Nam Trung Bộ</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#00BCD4" }} />
          <span>Tây Nguyên</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#795548" }} />
          <span>Đông Nam Bộ</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#FFC107" }} />
          <span>ĐBSCL</span>
        </div>
      </div>
    </div>
  );
}
