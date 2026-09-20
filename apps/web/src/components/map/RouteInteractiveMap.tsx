/**
 * Route Interactive Map Component
 * Powered by MapLibre GL with real road network tiles (Esri World Street Map & Satellite, NO API key required),
 * dynamic GeoJSON polyline path rendering, Origin/Destination markers, weather checkpoint chips,
 * and automatic camera framing (fitBounds).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
  generateRouteGeoData,
  fetchRealRouteGeoData,
  getCorridorRoutesSync,
  buildRouteGeoDataFromCorridor,
  buildRouteGeoDataFromCoordinates,
  type RouteGeoData,
} from "@/utils/routePathGenerator";
import { getVietnamProvincesGeoJson } from "@/data/vietnamGeoJsonWGS84";
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
  originName: string;
  destinationName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkpoints?: any[];
  coordinates?: [number, number][];
  routeType?: "fastest" | "weather_safer" | "shortest";
  titleVi?: string;
  titleEn?: string;
  onSelectCheckpoint?: (index: number | null) => void;
  selectedCheckpointIndex?: number | null;
  hasPlanned?: boolean;
}

export function RouteInteractiveMap({
  originName,
  destinationName,
  checkpoints = [],
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
  const [routeGeoData, setRouteGeoData] = useState<RouteGeoData>(() => {
    if (coordinates && coordinates.length >= 2) {
      return buildRouteGeoDataFromCoordinates(coordinates, checkpoints, routeType, originName, destinationName);
    }
    const syncCorridor = getCorridorRoutesSync(originName, destinationName);
    if (syncCorridor) {
      return buildRouteGeoDataFromCorridor(syncCorridor, checkpoints, routeType, originName, destinationName);
    }
    return generateRouteGeoData(originName, destinationName, checkpoints, routeType);
  });
  const [isLoadingRealRoad, setIsLoadingRealRoad] = useState(false);
  const reqIdRef = useRef(0);
  const lastBoundsKeyRef = useRef<string>("");

  // Helper to add GeoJSON boundaries & risk styling (interpolates to 0 opacity when zoomed close >= 10)
  const addProvincesLayers = useCallback((map: maplibregl.Map, showRisk: boolean) => {
    const geojson = getVietnamProvincesGeoJson();

    if (map.getSource("vietnam-provinces")) {
      (map.getSource("vietnam-provinces") as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource("vietnam-provinces", {
        type: "geojson",
        data: geojson,
      });

      // 1. Fill Layer: Soft background color representing city risk level
      // Zoom-interpolated: fades to 0 opacity when zoomed in deep (zoom >= 10) so streets and landmarks are crystal clear!
      map.addLayer(
        {
          id: "provinces-fill",
          type: "fill",
          source: "vietnam-provinces",
          paint: {
            "fill-color": ["get", "riskColor"],
            "fill-opacity": showRisk
              ? [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5, 0.16,
                  8, 0.12,
                  9.2, 0.04,
                  10.0, 0.0,
                ]
              : 0.001,
          },
        },
        map.getLayer("route-glow-layer") ? "route-glow-layer" : undefined
      );

      // 2. Risk Border Line Layer: Fades out gently as zoom gets deeper so boundary lines don't clutter street view
      map.addLayer(
        {
          id: "provinces-border",
          type: "line",
          source: "vietnam-provinces",
          paint: {
            "line-color": showRisk ? ["get", "riskColor"] : "rgba(100, 116, 139, 0.28)",
            "line-width": showRisk
              ? [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5, 1.8,
                  8.5, 1.4,
                  10.0, 0.8,
                  10.5, 0.3,
                ]
              : 0.8,
            "line-opacity": showRisk
              ? [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  5, 0.85,
                  8.5, 0.6,
                  9.8, 0.2,
                  10.5, 0.0,
                ]
              : 0.4,
          },
        },
        map.getLayer("route-glow-layer") ? "route-glow-layer" : undefined
      );
    }
  }, []);

  // Dynamically update province risk overlay styling when toggled
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getStyle()) return;

    if (map.getLayer("provinces-fill")) {
      map.setPaintProperty(
        "provinces-fill",
        "fill-opacity",
        showRiskOverlay
          ? [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, 0.16,
              8, 0.12,
              9.2, 0.04,
              10.0, 0.0,
            ]
          : 0.001
      );
    }

    if (map.getLayer("provinces-border")) {
      map.setPaintProperty(
        "provinces-border",
        "line-color",
        showRiskOverlay ? ["get", "riskColor"] : "rgba(100, 116, 139, 0.28)"
      );
      map.setPaintProperty(
        "provinces-border",
        "line-width",
        showRiskOverlay
          ? [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, 1.8,
              8.5, 1.4,
              10.0, 0.8,
              10.5, 0.3,
            ]
          : 0.8
      );
      map.setPaintProperty(
        "provinces-border",
        "line-opacity",
        showRiskOverlay
          ? [
              "interpolate",
              ["linear"],
              ["zoom"],
              5, 0.85,
              8.5, 0.6,
              9.8, 0.2,
              10.5, 0.0,
            ]
          : 0.4
      );
    }
  }, [showRiskOverlay, mapLoaded]);

  // Fetch or retrieve real road network from corridor cache
  useEffect(() => {
    const currentReqId = ++reqIdRef.current;
    let isMounted = true;

    // 0. Use real coordinates directly if passed from backend routing response
    if (coordinates && coordinates.length >= 2) {
      const instantData = buildRouteGeoDataFromCoordinates(
        coordinates,
        checkpoints,
        routeType,
        originName,
        destinationName
      );
      setRouteGeoData(instantData);
      setIsLoadingRealRoad(false);
      return;
    }

    // 1. Check synchronous corridor cache or precalculated data (0ms, 100% instant switch)
    const syncCorridor = getCorridorRoutesSync(originName, destinationName);
    if (syncCorridor) {
      const instantData = buildRouteGeoDataFromCorridor(
        syncCorridor,
        checkpoints,
        routeType,
        originName,
        destinationName
      );
      setRouteGeoData(instantData);
      setIsLoadingRealRoad(false);
      return;
    }

    // 2. Custom corridor that needs asynchronous OSRM fetch
    setIsLoadingRealRoad(true);

    fetchRealRouteGeoData(originName, destinationName, checkpoints, routeType)
      .then((realData) => {
        if (isMounted && reqIdRef.current === currentReqId && realData) {
          setRouteGeoData(realData);
        }
      })
      .catch((err) => {
        console.warn("Could not load real road data, retaining current road:", err);
      })
      .finally(() => {
        if (isMounted && reqIdRef.current === currentReqId) {
          setIsLoadingRealRoad(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [originName, destinationName, checkpoints, routeType, coordinates]);

  // Sync polyline layers on the map (active route + alternative routes)
  const syncRouteLayers = useCallback((map: maplibregl.Map, geoData: typeof routeGeoData) => {
    if (!map || !map.getStyle()) return;

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
          "line-color": ["get", "riskColor"],
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
          "line-color": ["get", "riskColor"],
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });
    }

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
    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // If route is not active/planned, don't draw markers
    if (!hasPlanned) return;

    // 1. Origin Marker (Point A)
    const originEl = document.createElement("div");
    originEl.className = "origin-marker-pin";
    originEl.innerHTML = `
      <div class="origin-marker-chip">
        <span style="font-weight:900; font-size:10px;">A</span>
        <span>${originName || (isEn ? "Origin" : "Xuất phát")}</span>
      </div>
      <div class="origin-marker-pointer"></div>
      <div class="origin-marker-dot"></div>
    `;
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
        <span>${destinationName || (isEn ? "Destination" : "Điểm đến")}</span>
      </div>
      <div class="destination-marker-pointer"></div>
      <div class="destination-marker-dot"></div>
    `;
    const destMarker = new maplibregl.Marker({ element: destEl, anchor: "bottom" })
      .setLngLat(geoData.destinationCoords)
      .addTo(map);
    markersRef.current.push(destMarker);

    // 3. Intermediate Checkpoints (Skip index 0 and last index)
    const intermediateCheckpoints = geoData.checkpointsWithCoords.slice(1, -1);
    intermediateCheckpoints.forEach((cp, subIdx) => {
      const actualIdx = subIdx + 1;
      const isSelected = selectedCheckpointIndex === actualIdx;
      const riskBorderColor =
        cp.risk === "high" ? "#EF4444" : cp.risk === "caution" ? "#F59E0B" : (routeType === "weather_safer" ? "#10B981" : "#0EA5E9");
      const riskIconSvg =
        cp.risk === "high"
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
          : cp.risk === "caution"
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
          : "";

      const cpEl = document.createElement("div");
      cpEl.className = `checkpoint-marker-pin ${isSelected ? "checkpoint-marker-selected" : ""}`;
      cpEl.style.setProperty("--cp-border-color", riskBorderColor);

      cpEl.innerHTML = `
        <div class="checkpoint-marker-chip" style="${cp.risk === "high" ? "background: rgba(185, 28, 28, 0.9); border-color: #EF4444; box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);" : cp.risk === "caution" ? "background: rgba(180, 83, 9, 0.9); border-color: #F59E0B;" : ""}">
          <span>${riskIconSvg}${cp.name}</span>
          <span class="checkpoint-marker-temp">${cp.temp}°</span>
        </div>
        <div class="checkpoint-marker-dot"></div>
      `;

      cpEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onSelectCheckpoint) {
          onSelectCheckpoint(isSelected ? null : actualIdx);
        }
      });

      const cpMarker = new maplibregl.Marker({ element: cpEl, anchor: "bottom" })
        .setLngLat(cp.coordinates)
        .addTo(map);
      markersRef.current.push(cpMarker);
    });
  }, [originName, destinationName, checkpoints, coordinates, routeType, selectedCheckpointIndex, onSelectCheckpoint, hasPlanned, isEn]);

  // Sync routeGeoData if props change
  useEffect(() => {
    let cancelled = false;
    const currentReq = ++reqIdRef.current;

    // Fast sync preview first
    if (coordinates && coordinates.length >= 2) {
      setRouteGeoData(buildRouteGeoDataFromCoordinates(coordinates, checkpoints, routeType, originName, destinationName));
      return;
    }
    const syncCorridor = getCorridorRoutesSync(originName, destinationName);
    if (syncCorridor) {
      setRouteGeoData(buildRouteGeoDataFromCorridor(syncCorridor, checkpoints, routeType, originName, destinationName));
      return;
    }

    // Attempt real async routing if origin & destination are provided
    if (originName && destinationName) {
      setIsLoadingRealRoad(true);
      fetchRealRouteGeoData(originName, destinationName, checkpoints, routeType)
        .then((realData) => {
          if (!cancelled && currentReq === reqIdRef.current) {
            setRouteGeoData(realData);
          }
        })
        .catch(() => {
          // Fallback gracefully
          if (!cancelled && currentReq === reqIdRef.current) {
            setRouteGeoData(generateRouteGeoData(originName, destinationName, checkpoints, routeType));
          }
        })
        .finally(() => {
          if (!cancelled && currentReq === reqIdRef.current) {
            setIsLoadingRealRoad(false);
          }
        });
    } else {
      setRouteGeoData(generateRouteGeoData(originName, destinationName, checkpoints, routeType));
    }

    return () => {
      cancelled = true;
    };
  }, [originName, destinationName, checkpoints, routeType, coordinates]);

  // Initial Map Mount & Tile Setup
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

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

      map.on("load", () => {
        addProvincesLayers(map, showRiskOverlay);
        syncRouteLayers(map, routeGeoData);
        syncMarkers(map, routeGeoData);
        setMapLoaded(true);

        // Ensure canvas expands to fill container correctly
        setTimeout(() => {
          try {
            map.resize();
            syncRouteLayers(map, routeGeoData);
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
      if (mapRef.current) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Route Polylines and Markers whenever routeGeoData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    syncRouteLayers(map, routeGeoData);
    syncMarkers(map, routeGeoData);
  }, [routeGeoData, mapLoaded, syncRouteLayers, syncMarkers]);

  // Update risk overlay layer visibility without reloading style
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      if (map.getLayer("province-boundaries-layer")) {
        map.setLayoutProperty(
          "province-boundaries-layer",
          "visibility",
          showRiskOverlay ? "visible" : "none"
        );
      }
      if (map.getLayer("province-fills-layer")) {
        map.setLayoutProperty(
          "province-fills-layer",
          "visibility",
          showRiskOverlay ? "visible" : "none"
        );
      }
    } catch (e) {
      // ignore
    }
  }, [showRiskOverlay, mapLoaded]);

  // Switch Base Tile Style dynamically
  const handleSwitchStyle = (styleKey: "google" | "satellite" | "voyager" | "dark") => {
    if (styleKey === activeTileStyle) return;
    setActiveTileStyle(styleKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("vietnam-weather-map-style", styleKey);
    }
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(MAP_STYLES[styleKey]);
    map.once("style.load", () => {
      addProvincesLayers(map, showRiskOverlay);
      syncRouteLayers(map, routeGeoData);
      syncMarkers(map, routeGeoData);
    });
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
          onClick={() => setShowRiskOverlay((v) => !v)}
          title={isEn ? (showRiskOverlay ? "Disable province risk borders" : "Enable province risk borders") : (showRiskOverlay ? "Tắt lớp viền cảnh báo các tỉnh thành để nhìn đường phố rõ hơn" : "Bật lớp viền cảnh báo rủi ro các tỉnh thành")}
        >
          {showRiskOverlay ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
          <span>{isEn ? (showRiskOverlay ? "Risk Border: ON" : "Risk Border: OFF") : (showRiskOverlay ? "Viền rủi ro: BẬT" : "Viền rủi ro: TẮT")}</span>
        </button>

        <div className={styles.routeTypeTag}>
          {routeType === "weather_safer" && <ShieldCheck size={14} color="#22C55E" />}
          {routeType === "fastest" && <Zap size={14} color="#0EA5E9" />}
          {routeType === "shortest" && <Gauge size={14} color="#F59E0B" />}
          <span>{isEn ? (titleEn || (routeType === "weather_safer" ? "Weather-Safer Route" : routeType === "fastest" ? "Fastest Route" : "Shortest Route")) : titleVi}</span>
        </div>

        {isLoadingRealRoad ? (
          <div className={styles.loadingRoadTag}>
            <span className="spinner-border spinner-border-sm" role="status" style={{ width: 10, height: 10 }} />
            <span>{isEn ? "Loading real road network..." : "Đang tải mạng đường thật..."}</span>
          </div>
        ) : routeGeoData.isRealRoad ? (
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
        <span style={{ color: "var(--color-text-secondary)", fontSize: "11px" }}>{isEn ? "Route:" : "Tuyến đường:"}</span>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#0EA5E9" }} />
          <span>{isEn ? "Safe" : "An toàn"}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#F59E0B" }} />
          <span>{isEn ? "Caution" : "Cẩn trọng"}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: "#EF4444" }} />
          <span>{isEn ? "Hazard" : "Nguy hiểm"}</span>
        </div>

        {showRiskOverlay && (
          <>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "11px", marginLeft: "6px" }}>{isEn ? "Province border:" : "Viền tỉnh:"}</span>
            <div className={styles.legendItem}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              <span>{isEn ? "Safe" : "An toàn"}</span>
            </div>
            <div className={styles.legendItem}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EAB308", display: "inline-block" }} />
              <span>{isEn ? "Caution" : "Chú ý"}</span>
            </div>
            <div className={styles.legendItem}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />
              <span>{isEn ? "High Risk" : "Nguy cơ cao"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
