import type { FillLayerSpecification, LineLayerSpecification } from "maplibre-gl";
import { getVietnamProvincesGeoJson, type ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";

type RiskFilter = "all" | "low" | "caution" | "high";

export function provinceWeatherGeoJson(provinces?: readonly ProvinceGeoFeatureProperties[]): GeoJSON.FeatureCollection {
  const base = getVietnamProvincesGeoJson();
  const byId = new Map(provinces?.map(province => [province.id, province]));
  return { ...base, features: base.features.map(feature => ({
    ...feature, properties: byId.get(feature.properties?.id) ?? feature.properties,
  })) };
}

export function provinceFillPaint(showRisk: boolean, filter: RiskFilter = "all"): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": ["get", "riskColor"],
    "fill-opacity": !showRisk ? 0.001 : filter === "all"
      ? ["interpolate", ["linear"], ["zoom"], 5, 0.18, 8, 0.12, 9.2, 0.04, 10, 0]
      : ["interpolate", ["linear"], ["zoom"],
        5, ["case", ["==", ["get", "riskLevel"], filter], 0.36, 0.02],
        8, ["case", ["==", ["get", "riskLevel"], filter], 0.26, 0.02],
        9.2, ["case", ["==", ["get", "riskLevel"], filter], 0.1, 0.02],
        10, ["case", ["==", ["get", "riskLevel"], filter], 0, 0.02]],
  };
}

export function provinceBorderPaint(showRisk: boolean, filter: RiskFilter = "all"): NonNullable<LineLayerSpecification["paint"]> {
  return {
    "line-color": showRisk ? ["get", "riskColor"] : "rgba(100, 116, 139, 0.28)",
    "line-width": !showRisk ? 0.8 : filter === "all"
      ? ["interpolate", ["linear"], ["zoom"], 5, 1.8, 8.5, 1.4, 10, 0.8, 10.5, 0.3]
      : ["case", ["==", ["get", "riskLevel"], filter], 2.6, 0.6],
    "line-opacity": !showRisk ? 0.4 : filter === "all"
      ? ["interpolate", ["linear"], ["zoom"], 5, 0.85, 8.5, 0.6, 9.8, 0.2, 10.5, 0]
      : ["case", ["==", ["get", "riskLevel"], filter], 1, 0.12],
  };
}
