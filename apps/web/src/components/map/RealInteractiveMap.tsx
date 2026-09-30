/**
 * Real Interactive Map Component
 * Powered by MapLibre GL with real road network tiles (Esri World Street Map & Satellite, NO API key required),
 * GeoJSON boundary risk overlays, zoom-dependent layer fading, on-demand risk overlay toggle,
 * single active province tag on click, snappy smooth zoom, and interactive layer controls.
 */

import { useEffect, useRef, useState, useCallback } from "react";
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
  Moon,
  Sparkles,
  Radio,
  Flame,
  ShieldCheck,
  ShieldOff,
  RotateCcw,
} from "lucide-react";
import {
  getAllProvincesData,
  getProvincePropertiesByCode,
  ProvinceGeoFeatureProperties,
} from "@/data/vietnamGeoJsonWGS84";
import styles from "./RealInteractiveMap.module.css";
import { provinceWeatherGeoJson, provinceFillPaint, provinceBorderPaint } from "./provinceOverlay";
import { weatherConditionText } from "@/utils/reportRisk";

export interface RealInteractiveMapProps {
  provinces?: ProvinceGeoFeatureProperties[];
  /** Stable GIS ID or name; legacy codes are accepted only when unambiguous. */
  selectedProvinceCode?: string | null;
  onSelectProvince?: (province: ProvinceGeoFeatureProperties) => void;
  radarEnabled?: boolean;
  heatmapEnabled?: boolean;
  onToggleProLayer?: (layer: "radar" | "heatmap") => void;
  isPro?: boolean;
  showRiskOverlay?: boolean;
  onToggleRiskOverlay?: () => void;
  riskFilter?: "all" | "low" | "caution" | "high" | "saved";
  onRiskFilterChange?: (filter: "all" | "low" | "caution" | "high") => void;
}

// Vietnam Geographical Extents
const VN_CENTER: [number, number] = [106.5, 16.2];
const VN_DEFAULT_ZOOM = 5.6;
const VN_BOUNDS: [[number, number], [number, number]] = [
  [96.0, 6.0], // Southwest coords
  [120.0, 25.5], // Northeast coords
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

export function RealInteractiveMap({
  provinces,
  selectedProvinceCode: selectedProvinceIdentifier,
  onSelectProvince,
  radarEnabled = false,
  heatmapEnabled = false,
  onToggleProLayer,
  isPro = false,
  showRiskOverlay: controlledShowRiskOverlay,
  onToggleRiskOverlay,
  riskFilter,
  onRiskFilterChange,
}: RealInteractiveMapProps) {
  const { i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const provincesRef = useRef(provinces);
  provincesRef.current = provinces;
  const onSelectProvinceRef = useRef(onSelectProvince);
  onSelectProvinceRef.current = onSelectProvince;
  const styleReadyRef = useRef(false);
  const mapHandlersRegisteredRef = useRef(false);

  // Local state for risk color overlay (toggled on/off to reduce bright colors)
  const [localShowRiskOverlay, setLocalShowRiskOverlay] = useState(true);
  const showRiskOverlay = controlledShowRiskOverlay !== undefined ? controlledShowRiskOverlay : localShowRiskOverlay;

  // Risk filtering state: can be driven by props or interactive legend click
  const [internalRiskFilter, setInternalRiskFilter] = useState<"all" | "low" | "caution" | "high">("all");
  const activeRiskFilter: "all" | "low" | "caution" | "high" =
    riskFilter && riskFilter !== "saved" ? riskFilter : internalRiskFilter;

  const handleRiskClick = (level: "low" | "caution" | "high") => {
    const next = activeRiskFilter === level ? "all" : level;
    setInternalRiskFilter(next);
    if (onRiskFilterChange) {
      onRiskFilterChange(next);
    }
  };

  const handleToggleRisk = () => {
    if (onToggleRiskOverlay) {
      onToggleRiskOverlay();
    } else {
      setLocalShowRiskOverlay((v) => !v);
    }
  };

  const [activeTileStyle, setActiveTileStyle] = useState<"google" | "satellite" | "voyager" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vietnam-weather-map-style");
      if (saved === "google" || saved === "satellite" || saved === "voyager" || saved === "dark") {
        return saved as "google" | "satellite" | "voyager" | "dark";
      }
    }
    return "google";
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);

  // Helper to add GeoJSON boundaries & risk styling
  const addProvincesLayers = useCallback((map: maplibregl.Map) => {
    const geojson = provinceWeatherGeoJson(provincesRef.current);
    const heatmapData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: (provincesRef.current ?? []).filter(p => p.assessment && p.assessment.severity > 0).map(p => ({
        type: "Feature",
        id: p.id,
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
        properties: { id: p.id, riskWeight: p.assessment!.severity },
      })),
    };

    if (map.getSource("vietnam-provinces")) {
      (map.getSource("vietnam-provinces") as maplibregl.GeoJSONSource).setData(geojson);
      (map.getSource("provinces-heatmap-points") as maplibregl.GeoJSONSource | undefined)?.setData(heatmapData);
      return;
    }

    map.addSource("vietnam-provinces", {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: "provinces-fill", type: "fill", source: "vietnam-provinces",
      paint: provinceFillPaint(showRiskOverlay, activeRiskFilter),
    });
    map.addLayer({
      id: "provinces-border", type: "line", source: "vietnam-provinces",
      paint: provinceBorderPaint(showRiskOverlay, activeRiskFilter),
    });

    // 3. Highlight Border Layer (Selected Province)
    map.addLayer({
      id: "provinces-selected-glow",
      type: "line",
      source: "vietnam-provinces",
      filter: ["==", ["get", "id"], ""] as unknown as maplibregl.FilterSpecification,
      paint: {
        "line-color": "#FFFFFF",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 4.5,
          9, 3.2,
          11, 1.5,
          12, 0.0,
        ],
        "line-blur": 2,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 1.0,
          10.5, 0.5,
          12, 0.0,
        ],
      },
    });

    map.addLayer({
      id: "provinces-selected-border",
      type: "line",
      source: "vietnam-provinces",
      filter: ["==", ["get", "id"], ""] as unknown as maplibregl.FilterSpecification,
      paint: {
        "line-color": "#0066CC",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 3.0,
          9, 2.2,
          11, 1.0,
          12, 0.0,
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, 1.0,
          10.5, 0.7,
          12, 0.0,
        ],
      },
    });

    map.addLayer({
      id: "provinces-selected-fill",
      type: "fill",
      source: "vietnam-provinces",
      filter: ["==", ["get", "id"], ""] as unknown as maplibregl.FilterSpecification,
      paint: {
        "fill-color": ["get", "riskColor"],
        "fill-opacity": showRiskOverlay
          ? [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, 0.32,
              8.5, 0.18,
              10.0, 0.0,
            ]
          : 0.001,
      },
    });

    // 4. Pro Layer: RainViewer Live Radar Tiles
    if (!map.getSource("rainviewer-radar")) {
      map.addSource("rainviewer-radar", {
        type: "raster",
        tiles: [
          "https://tilecache.rainviewer.com/v2/radar/nowcast_0/256/{z}/{x}/{y}/2/1_1.png",
        ],
        tileSize: 256,
      });
    }

    if (!map.getLayer("rainviewer-radar-layer")) {
      map.addLayer({
        id: "rainviewer-radar-layer",
        type: "raster",
        source: "rainviewer-radar",
        paint: {
          "raster-opacity": 0.72,
        },
        layout: {
          visibility: radarEnabled ? "visible" : "none",
        },
      });
    }

    // 5. Pro Layer: Risk Heatmap Points & Gradient Layer
    if (!map.getSource("provinces-heatmap-points")) {
      map.addSource("provinces-heatmap-points", {
        type: "geojson",
        data: heatmapData,
      });
    }

    if (!map.getLayer("provinces-heatmap-layer")) {
      map.addLayer({
        id: "provinces-heatmap-layer",
        type: "heatmap",
        source: "provinces-heatmap-points",
        paint: {
          "heatmap-weight": ["get", "riskWeight"],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 1.2,
            8, 2.5,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(34, 197, 94, 0)",
            0.2, "rgba(34, 197, 94, 0.45)",
            0.5, "rgba(234, 179, 8, 0.65)",
            0.75, "rgba(249, 115, 22, 0.8)",
            1, "rgba(239, 68, 68, 0.95)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 25,
            7, 50,
            10, 80,
          ],
          "heatmap-opacity": 0.8,
        },
        layout: {
          visibility: heatmapEnabled ? "visible" : "none",
        },
      });
    }

  }, [showRiskOverlay, activeRiskFilter, radarEnabled, heatmapEnabled]);

  // Update polygon highlight filter
  const updateHighlight = useCallback((map: maplibregl.Map, identifier?: string | null) => {
    const activeId = identifier ? getProvincePropertiesByCode(identifier)?.id ?? "" : "";
    const filter = ["==", ["get", "id"], activeId] as unknown as maplibregl.FilterSpecification;

    if (map.getLayer("provinces-selected-glow")) {
      map.setFilter("provinces-selected-glow", filter);
    }
    if (map.getLayer("provinces-selected-border")) {
      map.setFilter("provinces-selected-border", filter);
    }
    if (map.getLayer("provinces-selected-fill")) {
      map.setFilter("provinces-selected-fill", filter);
    }
  }, []);

  // Render tag/marker ONLY for the currently selected province (no cluttered tags by default)
  const syncSelectedMarker = useCallback(
    (map: maplibregl.Map, identifier?: string | null) => {
      // Clear all existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // If no province is selected, keep the map completely tag-free
      if (!identifier) return;

      const selected = getProvincePropertiesByCode(identifier);
      const p = (provincesRef.current ?? getAllProvincesData()).find((item) => item.id === selected?.id);
      if (!p) return;

      const el = document.createElement("div");
      el.className = "selected-city-pin";

      const themeColor = showRiskOverlay ? p.riskColor : "#0066CC";
      const glowColor = showRiskOverlay ? `${p.riskColor}66` : "rgba(0, 102, 204, 0.45)";
      const badgeBg = showRiskOverlay ? `${p.riskColor}22` : "rgba(0, 102, 204, 0.15)";

      el.style.setProperty("--risk-color", themeColor);
      el.style.setProperty("--risk-glow", glowColor);
      el.style.setProperty("--risk-badge-bg", badgeBg);

      const displayCondition = weatherConditionText(p.conditionCode, isEn);
      const displayRisk = isEn
        ? (p.riskLevel === "high" ? "High Risk" : p.riskLevel === "caution" ? "Caution" : p.riskLevel === "low" ? "Low" : "Unknown")
        : p.riskText;

      el.innerHTML = `
        <div class="selected-city-card">
          <div class="selected-city-top">
            <span class="selected-city-dot"></span>
            <span class="selected-city-name">${p.name}</span>
            <span class="selected-city-temp">${Number.isFinite(p.temp) ? p.temp : "—"}°C</span>
          </div>
          <div class="selected-city-sub">
            <span>${displayCondition}</span>
            <span>•</span>
            <span class="selected-city-badge">${displayRisk}</span>
          </div>
        </div>
        <div class="selected-city-pointer"></div>
        <div class="selected-city-pulse"></div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onSelectProvince) {
          onSelectProvince(p);
        }
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([p.longitude, p.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    },
    [onSelectProvince, showRiskOverlay, isEn]
  );

  // Style loading is asynchronous: restore the latest data/selection, not the
  // props captured when the user started switching basemaps.
  const styleSyncRef = useRef(() => {});
  styleSyncRef.current = () => {
    const map = mapRef.current;
    if (!map) return;
    addProvincesLayers(map);
    updateHighlight(map, selectedProvinceIdentifier);
    syncSelectedMarker(map, selectedProvinceIdentifier);
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[activeTileStyle],
      center: VN_CENTER,
      zoom: VN_DEFAULT_ZOOM,
      minZoom: 4.5,
      maxZoom: 16,
      maxBounds: VN_BOUNDS,
      attributionControl: false,
      fadeDuration: 0, // Rapid tile appearance, no 300ms fade delay!
    });

    map.on("style.load", () => {
      styleReadyRef.current = true;
      styleSyncRef.current();
      if (!mapHandlersRegisteredRef.current) {
        map.on("click", "provinces-fill", (e: maplibregl.MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id;
          const province = (provincesRef.current ?? getAllProvincesData()).find(p => p.id === id);
          if (province) onSelectProvinceRef.current?.(province);
        });
        map.on("mouseenter", "provinces-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "provinces-fill", () => {
          map.getCanvas().style.cursor = "";
        });
        mapHandlersRegisteredRef.current = true;
      }
      setMapLoaded(true);
      setStyleRevision(revision => revision + 1);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      styleReadyRef.current = false;
      mapHandlersRegisteredRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !styleReadyRef.current) return;
    addProvincesLayers(map);
    syncSelectedMarker(map, selectedProvinceIdentifier);
  }, [provinces, mapLoaded, styleRevision, addProvincesLayers, syncSelectedMarker, selectedProvinceIdentifier]);

  // Dynamic update when showRiskOverlay or activeRiskFilter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const fill = provinceFillPaint(showRiskOverlay, activeRiskFilter);
    const border = provinceBorderPaint(showRiskOverlay, activeRiskFilter);
    if (map.getLayer("provinces-fill")) {
      for (const key of ["fill-color", "fill-opacity"] as const) map.setPaintProperty("provinces-fill", key, fill[key]);
    }
    if (map.getLayer("provinces-border")) {
      for (const key of ["line-color", "line-width", "line-opacity"] as const) map.setPaintProperty("provinces-border", key, border[key]);
    }

    if (map.getLayer("provinces-selected-fill")) {
      map.setPaintProperty(
        "provinces-selected-fill",
        "fill-opacity",
        showRiskOverlay
          ? [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, 0.32,
              8.5, 0.18,
              10.0, 0.0,
            ]
          : 0.001
      );
    }

    syncSelectedMarker(map, selectedProvinceIdentifier);
  }, [showRiskOverlay, activeRiskFilter, mapLoaded, styleRevision, syncSelectedMarker, selectedProvinceIdentifier]);

  // Dynamic toggle of Pro Radar & Heatmap layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer("rainviewer-radar-layer")) {
      map.setLayoutProperty(
        "rainviewer-radar-layer",
        "visibility",
        radarEnabled ? "visible" : "none"
      );
    }

    if (map.getLayer("provinces-heatmap-layer")) {
      map.setLayoutProperty(
        "provinces-heatmap-layer",
        "visibility",
        heatmapEnabled ? "visible" : "none"
      );
    }
  }, [radarEnabled, heatmapEnabled, mapLoaded, styleRevision]);

  // Handle switching map tile style smoothly
  const handleSwitchStyle = (styleKey: "google" | "satellite" | "voyager" | "dark") => {
    if (styleKey === activeTileStyle || !mapRef.current) return;
    setActiveTileStyle(styleKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("vietnam-weather-map-style", styleKey);
    }
    const map = mapRef.current;
    styleReadyRef.current = false;
    map.setStyle(MAP_STYLES[styleKey]);
  };

  // Update Highlight & Selected Marker when the selected identifier changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    updateHighlight(map, selectedProvinceIdentifier);
    syncSelectedMarker(map, selectedProvinceIdentifier);

    // Snappy fly to the selected province (fast, direct curve, maxDuration 800ms)
    if (selectedProvinceIdentifier) {
      const p = getProvincePropertiesByCode(selectedProvinceIdentifier);
      if (p) {
        map.flyTo({
          center: [p.longitude, p.latitude],
          zoom: 8.8,
          speed: 2.0,
          curve: 1.0,
          maxDuration: 800,
          essential: true,
        });
      }
    }
  }, [selectedProvinceIdentifier, mapLoaded, updateHighlight, syncSelectedMarker]);

  // Navigation handlers (Optimized snappy speed)
  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 250 });
  const handleResetNorth = () => mapRef.current?.resetNorthPitch({ duration: 300 });
  const handleResetView = () => {
    mapRef.current?.flyTo({
      center: VN_CENTER,
      zoom: VN_DEFAULT_ZOOM,
      speed: 2.0,
      curve: 1.0,
      maxDuration: 800,
      essential: true,
    });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 11,
          speed: 2.0,
          curve: 1.0,
          maxDuration: 800,
          essential: true,
        });
      },
      () => {
        handleResetView();
      }
    );
  };

  return (
    <div className={styles.mapWrapper}>
      {/* MapLibre DOM Node */}
      <div ref={mapContainerRef} className={styles.mapContainer} />

      {/* Floating Top Controls (Map Style, Risk Overlay Toggle & Pro Layers) */}
      <div className={styles.topControls}>
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
            title={isEn ? "Dark tech-focused base style" : "Chế độ tối công nghệ cao"}
          >
            <Moon size={14} />
            <span>{isEn ? "Dark" : "Tối"}</span>
          </button>
        </div>

        {/* Toggle Risk Colored Overlay (Tắt / Bật màu cảnh báo rủi ro) */}
        <button
          type="button"
          className={`${styles.layerToggleBtn} ${showRiskOverlay ? styles.layerToggleBtnActive : ""}`}
          onClick={handleToggleRisk}
          title={isEn ? (showRiskOverlay ? "Disable risk color layer" : "Enable risk color layer") : (showRiskOverlay ? "Tắt lớp màu cảnh báo rủi ro (Giúp bản đồ tối giản, không sặc sỡ)" : "Bật lại lớp màu cảnh báo rủi ro (Xanh / Vàng / Đỏ)")}
        >
          {showRiskOverlay ? <ShieldCheck size={14} color="#22C55E" /> : <ShieldOff size={14} color="#94A3B8" />}
          <span>{isEn ? (showRiskOverlay ? "Risk Color: ON" : "Risk Color: OFF") : (showRiskOverlay ? "Màu rủi ro: BẬT" : "Màu rủi ro: ĐÃ TẮT")}</span>
        </button>

        {/* Pro Layer Toggles */}
        <button
          type="button"
          className={`${styles.layerToggleBtn} ${radarEnabled ? styles.layerToggleBtnActive : ""}`}
          onClick={() => onToggleProLayer?.("radar")}
          title={isEn ? "Toggle cloud radar & storm layer" : (isPro ? "Bật/tắt Radar mây giông" : "Radar mây giông thời gian thực (Dành riêng cho PRO)")}
        >
          <Radio size={14} />
          <span>{isEn ? "Radar & Storm" : "Radar Mây & Giông"}</span>
          {!isPro && <span className={styles.proPill}>PRO</span>}
        </button>

        <button
          type="button"
          className={`${styles.layerToggleBtn} ${heatmapEnabled ? styles.layerToggleBtnActive : ""}`}
          onClick={() => onToggleProLayer?.("heatmap")}
          title={isEn ? "Toggle risk heatmap layer" : (isPro ? "Bật/tắt Bản đồ nhiệt rủi ro" : "Bản đồ nhiệt rủi ro cao cấp (Dành riêng cho PRO)")}
        >
          <Flame size={14} />
          <span>{isEn ? "Risk Heatmap" : "Bản đồ nhiệt rủi ro"}</span>
          {!isPro && <span className={styles.proPill}>PRO</span>}
        </button>
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
        <button type="button" className={styles.navBtn} onClick={handleLocateMe} title={isEn ? "My GPS Location" : "Định vị GPS của tôi"}>
          <Navigation size={18} />
        </button>
        <button type="button" className={styles.navBtn} onClick={handleResetView} title={isEn ? "Vietnam Overview" : "Toàn cảnh Việt Nam"}>
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Floating Risk Legend (Bottom Left - Only shown when risk overlay is enabled) */}
      {showRiskOverlay && (
        <div className={styles.legendBar}>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "11px" }}>{isEn ? "Risk Level:" : "Mức độ rủi ro:"}</span>
          <button
            type="button"
            className={`${styles.legendBtn} ${activeRiskFilter === "low" ? styles.legendBtnActive : ""}`}
            onClick={() => handleRiskClick("low")}
            title={isEn ? "Filter low risk safe provinces" : "Lọc tỉnh thành mức độ an toàn"}
          >
            <span className={styles.legendDot} style={{ background: "#22C55E", color: "#22C55E" }} />
            <span>{isEn ? "Safe" : "An toàn"}</span>
          </button>
          <button
            type="button"
            className={`${styles.legendBtn} ${activeRiskFilter === "caution" ? styles.legendBtnActive : ""}`}
            onClick={() => handleRiskClick("caution")}
            title={isEn ? "Filter caution risk provinces" : "Lọc tỉnh thành mức độ chú ý"}
          >
            <span className={styles.legendDot} style={{ background: "#EAB308", color: "#EAB308" }} />
            <span>{isEn ? "Caution" : "Chú ý"}</span>
          </button>
          <button
            type="button"
            className={`${styles.legendBtn} ${activeRiskFilter === "high" ? styles.legendBtnActive : ""}`}
            onClick={() => handleRiskClick("high")}
            title={isEn ? "Filter hazard high risk provinces" : "Lọc tỉnh thành mức độ nguy hiểm"}
          >
            <span className={styles.legendDot} style={{ background: "#EF4444", color: "#EF4444" }} />
            <span>{isEn ? "Hazard" : "Nguy hiểm"}</span>
          </button>
          {activeRiskFilter !== "all" && (
            <button
              type="button"
              className={styles.legendResetBtn}
              onClick={() => handleRiskClick(activeRiskFilter)}
              title={isEn ? "Show all risk levels" : "Xem tất cả cấp độ rủi ro"}
            >
              <RotateCcw size={10} />
              <span>{isEn ? "All" : "Tất cả"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
