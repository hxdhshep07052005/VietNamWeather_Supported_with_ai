/**
 * Vietnam 63 Provinces GeoJSON in WGS-84 coordinate system
 * Sourced from official GIS boundaries (EPSG:4326), aligned 100% with real road and satellite maps
 * Annotated with standard regions, registry weather sampling points, and baseline weather/risk attributes
 */

import vietnamWgs84Data from "./vietnam-wgs84-clean.json";
import { findVietnamProvinceByName, type WeatherConditionCode } from "@vietnam-weather/contracts";
import { type VietnamRegion, VIETNAM_REGIONS } from "./provinces";

export interface ProvinceGeoFeatureProperties {
  id: string;
  code: string;
  name: string;
  region: VietnamRegion;
  regionVi: string;
  regionColor: string;
  /** Official weather sampling point; independent of the polygon centroid. */
  latitude: number;
  longitude: number;
  centroidLatitude?: number;
  centroidLongitude?: number;
  temp: number;
  feelsLike: number;
  conditionCode: WeatherConditionCode;
  conditionText: string;
  humidity: number;
  windSpeedKmh: number;
  windGustKmh: number;
  precipitationMm: number;
  rainProbabilityPercent?: number;
  uvIndex: number;
  visibilityKm: number;
  pressureHpa: number;
  cloudCoverPercent: number;
  riskLevel: "low" | "caution" | "high" | "unknown";
  riskScore: number | null;
  assessment?: import("@vietnam-weather/contracts").ReportAssessment;
  weatherTargetTime?: string;
  dataState?: "loading" | "ready" | "error";
  confidencePercent: number;
  freshnessState: "fresh" | "aging" | "stale" | "expired" | "unavailable";
  riskColor: string;
  riskText: string;
}

// Clean baseline properties for GIS features
function getBaselineProvinceProperties(_name: string, _region: VietnamRegion) {
  return {
    temp: NaN,
    feelsLike: NaN,
    conditionCode: "unknown" as const,
    conditionText: "Chưa có dữ liệu thời tiết",
    humidity: NaN,
    windSpeedKmh: NaN,
    windGustKmh: NaN,
    precipitationMm: NaN,
    uvIndex: NaN,
    visibilityKm: NaN,
    pressureHpa: NaN,
    cloudCoverPercent: NaN,
    riskLevel: "unknown" as const,
    riskScore: null,
    confidencePercent: 0,
    freshnessState: "unavailable" as const,
    riskColor: "#64748B",
    riskText: "Chưa đủ dữ liệu",
  };
}

// Convert all 63 features to standard GeoJSON FeatureCollection
let cachedGeoJson: GeoJSON.FeatureCollection | null = null;
let cachedProvinceMap: Map<string, ProvinceGeoFeatureProperties | undefined> | null = null;

export function getVietnamProvincesGeoJson(): GeoJSON.FeatureCollection {
  if (cachedGeoJson) return cachedGeoJson;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFeatures: any[] = (vietnamWgs84Data as any).features || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: GeoJSON.Feature[] = rawFeatures.map((f: any) => {
    const rawProps = f.properties || {};
    const id = f.id || rawProps.id || rawProps.code;
    const name = rawProps.name || "Không xác định";
    const code = rawProps.code || "";
    const region = (rawProps.region || "Red River Delta") as VietnamRegion;
    const regionMeta = VIETNAM_REGIONS[region] || { vi: "Việt Nam", color: "#64748B" };

    const samplingPoint = findVietnamProvinceByName(name);
    if (!samplingPoint) {
      throw new Error(`Missing weather sampling point for province: ${name}`);
    }

    const weatherData = getBaselineProvinceProperties(name, region);

    const properties: ProvinceGeoFeatureProperties = {
      id,
      code,
      name,
      region,
      regionVi: regionMeta.vi,
      regionColor: regionMeta.color,
      latitude: samplingPoint.latitude,
      longitude: samplingPoint.longitude,
      centroidLatitude: rawProps.latitude,
      centroidLongitude: rawProps.longitude,
      ...weatherData,
    };

    return {
      type: "Feature",
      id,
      properties: properties as unknown as GeoJSON.GeoJsonProperties,
      geometry: f.geometry,
    };
  });

  cachedGeoJson = {
    type: "FeatureCollection",
    features,
  };

  return cachedGeoJson;
}

export function getAllProvincesData(): ProvinceGeoFeatureProperties[] {
  const geojson = getVietnamProvincesGeoJson();
  return geojson.features.map((f) => f.properties as unknown as ProvinceGeoFeatureProperties);
}

/** Resolve a stable GIS ID, display name, or unambiguous legacy code (case-insensitive). */
export function getProvincePropertiesByCode(identifier: string): ProvinceGeoFeatureProperties | undefined {
  if (!cachedProvinceMap) {
    cachedProvinceMap = new Map();
    const list = getAllProvincesData();
    for (const item of list) {
      for (const alias of [item.id, item.name, item.code]) {
        const key = alias.trim().toLowerCase();
        if (!key) continue;
        // Keep collisions unresolved instead of letting the last province win.
        if (cachedProvinceMap.has(key) && cachedProvinceMap.get(key)?.id !== item.id) {
          cachedProvinceMap.set(key, undefined);
        } else if (!cachedProvinceMap.has(key)) {
          cachedProvinceMap.set(key, item);
        }
      }
    }
  }
  return cachedProvinceMap.get(identifier.trim().toLowerCase());
}
