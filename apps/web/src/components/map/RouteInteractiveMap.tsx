/**
 * Route Interactive Map Component
 * Powered by MapLibre GL with real road network tiles (Esri World Street Map & Satellite, NO API key required),
 * dynamic GeoJSON polyline path rendering, Origin/Destination markers, weather checkpoint chips,
 * and automatic camera framing (fitBounds).
 */

import { useEffect, useRef, useState, useCallback, useMemo, useId } from "react";
import { useTranslation } from "react-i18next";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

// Configure MapLibre Web Worker URL for Vite bundling & dev server
if (typeof maplibregl.setWorkerUrl === "function") {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}
import {
  ZoomIn,
  ZoomOut,
  Compass,
  Navigation,
  Maximize2,
  Map as MapIcon,
  Globe,
  ShieldCheck,
  ShieldOff,
  Zap,
  Gauge,
  Moon,
  Sparkles,
} from "lucide-react";
import {
  buildRouteGeoDataFromCoordinates,
  type GeoCheckpoint,
} from "@/utils/routePathGenerator";
import type { ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { provinceWeatherGeoJson, provinceFillPaint, provinceBorderPaint } from "./provinceOverlay";
import { createCheckpointMarker, type CheckpointMarker } from "./checkpointMarker";
import styles from "./RouteInteractiveMap.module.css";

// Vietnam Geographical Center fallback
const VN_CENTER: [number, number] = [106.5, 16.2];
const VN_BOUNDS: [[number, number], [number, number]] = [
  [96.0, 6.0],
  [120.0, 25.5],
];

// Map Styles: Modern Google Maps & CARTO High-DPI Retina tiles (Zero API key, crisp, fast)
const MAP_STYLES = {
  google: {
    version: 8 as const,
    sources: {
      "google-streets": {
        type: "raster" as const,
        tiles: [
          "https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          "https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          "https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        ],
        tileSize: 256,
        attribution: "&copy; Google Maps",
      },
    },
    layers: [
      {
        id: "google-streets-layer",
        type: "raster" as const,
        source: "google-streets",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  },
  satellite: {
    version: 8 as const,
    sources: {
      "google-hybrid": {
        type: "raster" as const,
        tiles: [
          "https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          "https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          "https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        ],
        tileSize: 256,
        attribution: "&copy; Google Maps Satellite",
      },
    },
    layers: [
      {
        id: "google-hybrid-layer",
        type: "raster" as const,
        source: "google-hybrid",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  },
  voyager: {
    version: 8 as const,
    sources: {
      "carto-voyager": {
        type: "raster" as const,
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
          "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        attribution: "&copy; CARTO &copy; OpenStreetMap",
      },
    },
    layers: [
      {
        id: "carto-voyager-layer",
        type: "raster" as const,
        source: "carto-voyager",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  },
  dark: {
    version: 8 as const,
    sources: {
      "esri-dark": {
        type: "raster" as const,
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "&copy; Esri &copy; OpenStreetMap",
      },
      "esri-dark-labels": {
        type: "raster" as const,
        tiles: [
          "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "&copy; Esri",
      },
    },
    layers: [
      {
        id: "esri-dark-layer",
        type: "raster" as const,
        source: "esri-dark",
        minzoom: 0,
        maxzoom: 18,
      },
      {
        id: "esri-dark-labels-layer",
        type: "raster" as const,
        source: "esri-dark-labels",
        minzoom: 0,
        maxzoom: 18,
      },
    ],
  },
};

export interface RouteInteractiveMapProps {
  provinces?: readonly ProvinceGeoFeatureProperties[];
  originName: string;
  destinationName: string;
  checkpoints?: ReadonlyArray<Partial<GeoCheckpoint>>;
  segmentRisks?: ReadonlyArray<import("@vietnam-weather/contracts").SegmentRisk>;
  coordinates?: [number, number][];
  routeType?: "fastest" | "weather_safer" | "shortest";
  titleVi?: string;
  titleEn?: string;
  onSelectCheckpoint?: (index: number | null) => void;
  selectedCheckpointIndex?: number | null;
  hasPlanned?: boolean;
}

export function selectVisibleCheckpoints(
  checkpoints: ReadonlyArray<{ readonly risk: GeoCheckpoint["risk"] }>, selectedIndex: number | null,
): number[] {
  const count = checkpoints.length - 2;
  if (count <= 0) return [];
  const severity = { low: 1, caution: 2, high: 3, unknown: 0 };
  const indices: number[] = [];
  const groups = Math.min(5, count);
  for (let group = 0; group < groups; group++) {
    const start = 1 + Math.floor(group * count / groups);
    const end = 1 + Math.floor((group + 1) * count / groups);
    let candidate = Math.floor((start + end - 1) / 2);
    for (let index = start; index < end; index++) {
      if (severity[checkpoints[index]?.risk ?? "unknown"] > severity[checkpoints[candidate]?.risk ?? "unknown"]) candidate = index;
    }
    indices.push(candidate);
  }
  if (selectedIndex !== null && selectedIndex > 0 && selectedIndex < checkpoints.length - 1) indices.push(selectedIndex);
  return [...new Set(indices)].sort((a, b) => a - b);
}

export function RouteInteractiveMap({
  provinces,
  originName,
  destinationName,
  checkpoints = [],
  segmentRisks = [],
  coordinates,
  routeType = "weather_safer",
  titleVi = "Lộ trình di chuyển",
  titleEn,
  onSelectCheckpoint,
  selectedCheckpointIndex = null,
  hasPlanned = true,
}: RouteInteractiveMapProps) {
  const { i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const checkpointMarkersRef = useRef<CheckpointMarker[]>([]);
  const checkpointTooltipId = useId();

  const [activeTileStyle, setActiveTileStyle] = useState<"google" | "satellite" | "voyager" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vietnam-weather-map-style");
      if (saved === "dark" || saved === "satellite" || saved === "voyager" || saved === "google") {
        return saved as "google" | "satellite" | "voyager" | "dark";
      }
    }
    return "google";
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showRiskOverlay, setShowRiskOverlay] = useState(true);
  const provincesRef = useRef(provinces);
  provincesRef.current = provinces;
  const showRiskRef = useRef(showRiskOverlay);
  showRiskRef.current = showRiskOverlay;
  const styleReadyRef = useRef(false);
  const routeGeoData = useMemo(() => buildRouteGeoDataFromCoordinates(
    coordinates ?? [], checkpoints, routeType, originName, destinationName, segmentRisks,
  ), [coordinates, checkpoints, routeType, originName, destinationName, segmentRisks]);
  const latestRouteGeoDataRef = useRef(routeGeoData);
  latestRouteGeoDataRef.current = routeGeoData;
  const lastBoundsKeyRef = useRef<string>("");

  const addProvincesLayers = useCallback((map: maplibregl.Map) => {
    const geojson = provinceWeatherGeoJson(provincesRef.current);
    const source = map.getSource<maplibregl.GeoJSONSource>("vietnam-provinces");
    if (source) source.setData(geojson);
    else map.addSource("vietnam-provinces", { type: "geojson", data: geojson });
    const fill = provinceFillPaint(showRiskRef.current);
    const border = provinceBorderPaint(showRiskRef.current);
    const before = map.getLayer("route-glow-layer") ? "route-glow-layer" : undefined;
    if (!map.getLayer("provinces-fill")) {
      map.addLayer({ id: "provinces-fill", type: "fill", source: "vietnam-provinces", paint: fill }, before);
    } else {
      for (const key of ["fill-color", "fill-opacity"] as const) map.setPaintProperty("provinces-fill", key, fill[key]);
    }
    if (!map.getLayer("provinces-border")) {
      map.addLayer({ id: "provinces-border", type: "line", source: "vietnam-provinces", paint: border }, before);
    } else {
      for (const key of ["line-color", "line-width", "line-opacity"] as const) map.setPaintProperty("provinces-border", key, border[key]);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mapLoaded && styleReadyRef.current) addProvincesLayers(map);
  }, [provinces, showRiskOverlay, mapLoaded, addProvincesLayers]);

  // Sync polyline layers on the map (active route + alternative routes)
  const syncRouteLayers = useCallback((map: maplibregl.Map, geoData: typeof routeGeoData) => {
    if (!map || !map.getStyle() || !styleReadyRef.current) return;

    try {
      // Clean up any legacy secondary alternative layers so only the active route is rendered
      if (map.getLayer("route-alternatives-line")) map.removeLayer("route-alternatives-line");
      if (map.getLayer("route-alternatives-casing")) map.removeLayer("route-alternatives-casing");
      if (map.getSource("route-alternatives-source")) map.removeSource("route-alternatives-source");

      const source = map.getSource("route-source") as maplibregl.GeoJSONSource | undefined;

      // If route is not active/planned, clear polyline data completely
      if (!hasPlanned) {
        if (source) {
          source.setData({ type: "FeatureCollection", features: [] });
        }
        return;
      }

    // Active Route
    if (source) {
      source.setData(geoData.segmentsFeatureCollection);
    } else {
      map.addSource("route-source", {
        type: "geojson",
        data: geoData.segmentsFeatureCollection,
      });
    }

    // Layer 1: Glow / Shadow Underlay
    if (!map.getLayer("route-glow-layer")) {
      map.addLayer({
        id: "route-glow-layer",
        type: "line",
        source: "route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["coalesce", ["get", "riskColor"], "#10B981"],
          "line-width": 14,
          "line-opacity": 0.28,
          "line-blur": 3,
        },
      });
    }

    // Layer 2: Casing (Dark outline for high contrast on both street and satellite)
    if (!map.getLayer("route-casing-layer")) {
      map.addLayer({
        id: "route-casing-layer",
        type: "line",
        source: "route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0F172A",
          "line-width": 9,
          "line-opacity": 0.88,
        },
      });
    }

    // Layer 3: Main Core Line (dynamic risk color)
    if (!map.getLayer("route-core-layer")) {
      map.addLayer({
        id: "route-core-layer",
        type: "line",
        source: "route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["coalesce", ["get", "riskColor"], "#22C55E"],
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
    }

    // Ensure route line layers are always brought to the absolute top of the stack
    if (map.getLayer("route-glow-layer")) map.moveLayer("route-glow-layer");
    if (map.getLayer("route-casing-layer")) map.moveLayer("route-casing-layer");
    if (map.getLayer("route-core-layer")) map.moveLayer("route-core-layer");

    // Fit camera bounds smoothly to entire route only when the corridor actually changes
    if (geoData.bounds) {
      const [minLng, minLat, maxLng, maxLat] = geoData.bounds;
      const boundsKey = `${minLng.toFixed(1)}_${minLat.toFixed(1)}_${maxLng.toFixed(1)}_${maxLat.toFixed(1)}`;
      if (boundsKey !== lastBoundsKeyRef.current) {
        lastBoundsKeyRef.current = boundsKey;
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: { top: 75, bottom: 65, left: 65, right: 65 },
            duration: 800,
            maxZoom: 12.5,
          }
        );
      }
    }
  } catch (err) {
    console.error("[syncRouteLayers] error:", err);
  }
  }, [hasPlanned, originName, destinationName, routeType]);

  // Sync Markers (Origin, Destination, Weather Checkpoint Chips)
  const syncMarkers = useCallback((map: maplibregl.Map, geoData: typeof routeGeoData) => {
    const focusedTooltip = checkpointMarkersRef.current
      .find(marker => marker.element === document.activeElement)?.element.getAttribute("aria-describedby");
    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    checkpointMarkersRef.current = [];

    // If route is not active/planned, don't draw markers
    if (!hasPlanned) return;

    // 1. Origin Marker (Point A)
    const originEl = document.createElement("div");
    originEl.className = "origin-marker-pin";
    originEl.innerHTML = `
      <div class="origin-marker-chip">
        <span style="font-weight:900; font-size:10px;">A</span>
        <span></span>
      </div>
      <div class="origin-marker-pointer"></div>
      <div class="origin-marker-dot"></div>
    `;
    const originLabel = originEl.querySelector(".origin-marker-chip span:last-child");
    if (originLabel) originLabel.textContent = originName || (isEn ? "Origin" : "Xuất phát");
    const originMarker = new maplibregl.Marker({ element: originEl, anchor: "bottom" })
      .setLngLat(geoData.originCoords)
      .addTo(map);
    markersRef.current.push(originMarker);

    // 2. Destination Marker (Point B)
    const destEl = document.createElement("div");
    destEl.className = "destination-marker-pin";
    destEl.innerHTML = `
      <div class="destination-marker-chip">
        <span style="font-weight:900; font-size:10px;">B</span>
        <span></span>
      </div>
      <div class="destination-marker-pointer"></div>
      <div class="destination-marker-dot"></div>
    `;
    const destinationLabel = destEl.querySelector(".destination-marker-chip span:last-child");
    if (destinationLabel) destinationLabel.textContent = destinationName || (isEn ? "Destination" : "Điểm đến");
    const destMarker = new maplibregl.Marker({ element: destEl, anchor: "bottom" })
      .setLngLat(geoData.destinationCoords)
      .addTo(map);
    markersRef.current.push(destMarker);

    const focusedIndex = geoData.checkpointsWithCoords.findIndex((_, index) => `${checkpointTooltipId}-${index}` === focusedTooltip);
    const priorityIndex = selectedCheckpointIndex ?? (focusedIndex >= 0 ? focusedIndex : null);
    const markerIndices = selectVisibleCheckpoints(geoData.checkpointsWithCoords, priorityIndex);
    const visiblePixels: { x: number; y: number }[] = [];
    markerIndices.sort((a, b) => Number(b === priorityIndex) - Number(a === priorityIndex));
    markerIndices.forEach((actualIdx) => {
      const cp = geoData.checkpointsWithCoords[actualIdx];
      if (!cp) return;
      const isSelected = selectedCheckpointIndex === actualIdx;
      const position = map.project(cp.coordinates);
      if (actualIdx !== priorityIndex && visiblePixels.some(point => Math.hypot(point.x - position.x, point.y - position.y) < 42)) return;
      visiblePixels.push(position);
      const checkpoint = createCheckpointMarker(cp, {
        boundary: map.getContainer(),
        tooltipId: `${checkpointTooltipId}-${actualIdx}`, selected: isSelected, isEn,
        onSelect: () => onSelectCheckpoint?.(isSelected ? null : actualIdx),
      });
      const marker = new maplibregl.Marker({ element: checkpoint.element, anchor: "center" }).setLngLat(cp.coordinates).addTo(map);
      markersRef.current.push(marker);
      checkpointMarkersRef.current.push(checkpoint);
      if (checkpoint.element.getAttribute("aria-describedby") === focusedTooltip) checkpoint.element.focus({ preventScroll: true });
      checkpoint.reposition();
    });
  }, [originName, destinationName, checkpoints, coordinates, routeType, selectedCheckpointIndex, onSelectCheckpoint, hasPlanned, isEn, checkpointTooltipId]);

  const latestSyncRouteLayersRef = useRef(syncRouteLayers);
  latestSyncRouteLayersRef.current = syncRouteLayers;
  const latestSyncMarkersRef = useRef(syncMarkers);
  latestSyncMarkersRef.current = syncMarkers;

  // Initial Map Mount & Tile Setup
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const dismissTooltips = (event: KeyboardEvent) => {
      if (event.key === "Escape") checkpointMarkersRef.current.forEach(marker => marker.dismiss());
    };
    const repositionTooltips = () => checkpointMarkersRef.current.forEach(marker => marker.reposition());
    document.addEventListener("keydown", dismissTooltips);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLES[activeTileStyle],
        center: VN_CENTER,
        zoom: 5.5,
        minZoom: 4,
        maxZoom: 18,
        maxBounds: VN_BOUNDS,
        attributionControl: false,
      });

      const restoreStyle = () => {
        styleReadyRef.current = true;
        addProvincesLayers(map);
        latestSyncRouteLayersRef.current(map, latestRouteGeoDataRef.current);
        latestSyncMarkersRef.current(map, latestRouteGeoDataRef.current);
        setMapLoaded(true);
      };
      map.on("style.load", restoreStyle);
      map.on("render", repositionTooltips);
      map.on("load", () => {
        if (!styleReadyRef.current) restoreStyle();

        // Ensure canvas expands to fill container correctly
        setTimeout(() => {
          try {
            map.resize();
            latestSyncRouteLayersRef.current(map, latestRouteGeoDataRef.current);
          } catch {
            // ignore
          }
        }, 100);
      });

      mapRef.current = map;
    } catch (err) {
      console.warn("Failed to initialize MapLibre GL:", err);
    }

    return () => {
      document.removeEventListener("keydown", dismissTooltips);
      checkpointMarkersRef.current = [];
      if (mapRef.current) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        styleReadyRef.current = false;
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Route Polylines and Markers whenever routeGeoData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !styleReadyRef.current) return;

    syncRouteLayers(map, routeGeoData);
    syncMarkers(map, routeGeoData);
  }, [routeGeoData, mapLoaded, syncRouteLayers, syncMarkers]);

  // Switch Base Tile Style dynamically
  const handleSwitchStyle = (styleKey: "google" | "satellite" | "voyager" | "dark") => {
    if (styleKey === activeTileStyle) return;
    setActiveTileStyle(styleKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("vietnam-weather-map-style", styleKey);
    }
    const map = mapRef.current;
    if (!map) return;

    styleReadyRef.current = false;
    map.setStyle(MAP_STYLES[styleKey]);
  };

  // Nav Handlers
  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 300 });
  const handleResetNorth = () => mapRef.current?.resetNorthPitch({ duration: 400 });
  const handleFitRoute = () => {
    if (mapRef.current) {
      lastBoundsKeyRef.current = ""; // force re-fit
      syncRouteLayers(mapRef.current, routeGeoData);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 13,
          duration: 1200,
        });
      },
      () => {},
      { timeout: 5000 }
    );
  };

  return (
    <div className={styles.mapRootContainer}>
      <div ref={mapContainerRef} className={styles.mapCanvas} />

      {/* Floating Style Toolbar (Top Left) */}
      <div className={styles.topToolbar}>
        <div className={styles.styleToggleGroup}>
          <button
            type="button"
            className={`${styles.styleBtn} ${activeTileStyle === "google" ? styles.styleBtnActive : ""}`}
            onClick={() => handleSwitchStyle("google")}
            title={isEn ? "Google Maps High-DPI road network" : "Bản đồ đường bộ Google Maps sắc nét, quen thuộc"}
          >
            <MapIcon size={14} />
            <span>Google Maps</span>
          </button>
          <button
            type="button"
            className={`${styles.styleBtn} ${activeTileStyle === "satellite" ? styles.styleBtnActive : ""}`}
            onClick={() => handleSwitchStyle("satellite")}
            title={isEn ? "Google Hybrid satellite imagery with road network" : "Ảnh chụp vệ tinh Google Hybrid kèm mạng lưới đường phố"}
          >
            <Globe size={14} />
            <span>{isEn ? "Satellite" : "Vệ tinh"}</span>
          </button>
          <button
            type="button"
            className={`${styles.styleBtn} ${activeTileStyle === "voyager" ? styles.styleBtnActive : ""}`}
            onClick={() => handleSwitchStyle("voyager")}
            title={isEn ? "Modern Apple Maps Retina HD style" : "Bản đồ hiện đại phong cách Apple Maps Retina HD"}
          >
            <Sparkles size={14} />
            <span>Voyager HD</span>
          </button>
          <button
            type="button"
            className={`${styles.styleBtn} ${activeTileStyle === "dark" ? styles.styleBtnActive : ""}`}
            onClick={() => handleSwitchStyle("dark")}
            title={isEn ? "Dark tech-focused base style" : "Chế độ nền tối công nghệ cao"}
          >
            <Moon size={14} />
            <span>{isEn ? "Dark" : "Tối"}</span>
          </button>
        </div>

        {/* Toggle Risk Overlay */}
        <button
          type="button"
          className={`${styles.riskToggleBtn} ${showRiskOverlay ? styles.riskToggleBtnActive : ""}`}
          aria-pressed={showRiskOverlay}
          onClick={() => setShowRiskOverlay((v) => !v)}
          title={isEn ? (showRiskOverlay ? "Disable province risk borders" : "Enable province risk borders") : (showRiskOverlay ? "Tắt lớp viền cảnh báo các tỉnh thành để nhìn đường phố rõ hơn" : "Bật lớp viền cảnh báo rủi ro các tỉnh thành")}
        >
          {showRiskOverlay ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
          <span>{isEn ? (showRiskOverlay ? "Province Borders: ON" : "Province Borders: OFF") : (showRiskOverlay ? "Viền tỉnh: BẬT" : "Viền tỉnh: TẮT")}</span>
        </button>

        <div className={styles.routeTypeTag}>
          {routeType === "weather_safer" && <ShieldCheck size={14} color="#22C55E" />}
          {routeType === "fastest" && <Zap size={14} color="#22C55E" />}
          {routeType === "shortest" && <Gauge size={14} color="#F59E0B" />}
          <span>{isEn ? (titleEn || (routeType === "weather_safer" ? "Weather-Safer Route" : routeType === "fastest" ? "Fastest Route" : "Shortest Route")) : titleVi}</span>
        </div>

        {routeGeoData.isRealRoad ? (
          <div className={styles.realRoadBadge} title={isEn ? "Real road path from OpenStreetMap network" : "Tuyến đường thực tế chính xác theo mạng lưới giao thông đường bộ OpenStreetMap"}>
            <Navigation size={12} color="#34D399" />
            <span>{isEn ? `Real Road (${routeGeoData.distanceKm} km)` : `Đường thật (${routeGeoData.distanceKm} km)`}</span>
          </div>
        ) : null}
      </div>

      {/* Floating Navigation Controls (Bottom Right) */}
      <div className={styles.navControls}>
        <button type="button" className={styles.navBtn} onClick={handleZoomIn} title={isEn ? "Zoom in (+)" : "Phóng to (+)"}>
          <ZoomIn size={18} />
        </button>
        <button type="button" className={styles.navBtn} onClick={handleZoomOut} title={isEn ? "Zoom out (-)" : "Thu nhỏ (-)"}>
          <ZoomOut size={18} />
        </button>
        <button type="button" className={styles.navBtn} onClick={handleResetNorth} title={isEn ? "Reset North (Compass)" : "Đặt lại hướng Bắc (La bàn)"}>
          <Compass size={18} />
        </button>
        <button type="button" className={styles.navBtn} onClick={handleLocateMe} title={isEn ? "My GPS Location" : "Vị trí GPS của tôi"}>
          <Navigation size={18} />
        </button>
        <button type="button" className={styles.navBtn} onClick={handleFitRoute} title={isEn ? "Fit Entire Route" : "Bao trọn toàn bộ tuyến đường"}>
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Floating Route Risk Legend (Bottom Left) */}
      <div className={styles.legendBar}>
        <span style={{ color: "var(--color-text-secondary)", fontSize: "11px" }}>{checkpoints.some(point => point.provisional) ? (isEn ? "Provisional observed risk:" : "Rủi ro quan sát tạm tính:") : (isEn ? "Route:" : "Tuyến đường:")}</span>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#22C55E" }} />
          <span>{checkpoints.some(point => point.provisional) ? (isEn ? "Low observed risk" : "Rủi ro quan sát thấp") : (isEn ? "Safe" : "An toàn")}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#F59E0B" }} />
          <span>{isEn ? "Caution" : "Cẩn trọng"}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#EF4444" }} />
          <span>{isEn ? "Hazard" : "Nguy hiểm"}</span>
        </div>

        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#64748B" }} />
          <span>{isEn ? "Unknown" : "Chưa đủ dữ liệu"}</span>
        </div>
      </div>
    </div>
  );
}
