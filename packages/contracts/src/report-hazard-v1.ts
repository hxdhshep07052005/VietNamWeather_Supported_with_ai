import type { VehicleType } from "./route-v1.js";

export type ReportSeverity = 0 | 1 | 2 | 3;
export type ReportLevel = "unknown" | "low" | "caution" | "high";
export type ReportFreshness = "fresh" | "aging" | "stale" | "unavailable";
export type ReportDimension = "rain" | "wind" | "temperature" | "visibility" | "storm" | "alert";
export interface ReportWeatherEvidence {
  /** Persisted sampling position selected within the supported weather radius. */
  matched_coordinates?: { readonly latitude: number; readonly longitude: number };
  distance_meters?: number;
  rain_source?: {
    readonly kind: "hourly_forecast";
    readonly source: string;
    readonly source_time: string | null;
    readonly fetched_at: string | null;
    readonly valid_from: string;
    readonly valid_to: string;
  };
  precipitation_probability_source?: ReportWeatherEvidence["rain_source"];
  /** Display measurements; missing provider fields stay null. Not hazard scores. */
  humidity_percent?: number | null;
  wind_kmh?: number | null;
  feels_like_c?: number | null;
  pressure_hpa?: number | null;
  precipitation_mm?: number | null;
  condition_code?: string | null;
  uv_index?: number | null;
  cloud_cover_percent?: number | null;
  precipitation_probability_percent?: number | null;
  /** Ingestion time is not a provider issuance timestamp. */
  fetched_at?: string | null;
  rain_mm_per_hour: number | null;
  gust_kmh: number | null;
  temperature_c: number | null;
  visibility_m: number | null;
  storm: "none" | "distant" | "cumulonimbus" | "direct" | "hail" | "unclassified" | null;
  /** 0 explicitly means no official alert in a covered source; null means no evidence. */
  official_alert_level: number | null;
  freshness: ReportFreshness;
  coverage: "covered" | "outside" | "unavailable";
  source: string | null;
  source_time: string | null;
  valid_from: string | null;
  valid_to: string | null;
  reasons: string[];
}
export interface ReportAssessment {
  level: ReportLevel;
  severity: ReportSeverity;
  score: number | null;
  display_score: number | null;
  vehicle: VehicleType | null;
  rule_set_version: string | null;
  freshness: ReportFreshness;
  coverage: ReportWeatherEvidence["coverage"];
  source: string | null;
  source_time: string | null;
  reasons: string[];
  evidence: Array<{ dimension: ReportDimension; severity: ReportSeverity; value: number | string | null;
    source_kind?: "hourly_forecast" | "observation"; valid_from?: string; valid_to?: string; source_time?: string | null }>;
}
export interface ReportPointResponse {
  weather: ReportWeatherEvidence;
  assessment: ReportAssessment;
}
