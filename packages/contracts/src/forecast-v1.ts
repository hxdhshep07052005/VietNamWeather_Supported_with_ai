/**
 * Phase 7 Forecast & Trend Contracts
 * Forecast and trend visualization for weather product
 *
 * Based on decisions FCAST-001..006
 * - Hourly max 72h, Daily max 3d
 * - Fixed timezone: Asia/Ho_Chi_Minh
 * - Core chart variables: temp, precip, wind
 */

// =============================================================================
// Constants (FCAST-001, FCAST-005)
// =============================================================================

/**
 * Maximum hourly forecast horizon in hours
 * Per FCAST-001: Hourly max 72h per WeatherAPI baseline
 */
export const FORECAST_HOURLY_MAX_HOURS = 72;

/**
 * Maximum daily forecast horizon in days
 * Per FCAST-001: Daily max 3d
 */
export const FORECAST_DAILY_MAX_DAYS = 3;

/**
 * Display timezone for forecast
 * Per FCAST-005: Fixed to Vietnam (ICT)
 */
export const DISPLAY_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Display timezone offset for Vietnam (UTC+7)
 */
export const DISPLAY_TIMEZONE_OFFSET_HOURS = 7;

// =============================================================================
// Timezone (FCAST-005)
// =============================================================================

/**
 * Format timestamp for display in Vietnam timezone
 */
export function formatDisplayTime(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  // Convert UTC hours to ICT (UTC+7)
  let hours = date.getUTCHours() + DISPLAY_TIMEZONE_OFFSET_HOURS;
  // Handle overflow: ICT is ahead, so 20:00 UTC = 03:00 ICT next day
  if (hours >= 24) {
    hours = hours - 24;
  }
  const mins = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours.toString().padStart(2, "0")}:${mins} ICT`;
}

/**
 * Format date for display in Vietnam timezone
 */
export function formatDisplayDate(utcTimestamp: string, locale: "vi" | "en" = "vi"): string {
  const date = new Date(utcTimestamp);
  const day = date.getUTCDate();
  const month = date.getUTCMonth();

  const monthNamesVi = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const monthNamesEn = monthNamesVi;

  if (locale === "vi") {
    return `${day} thg ${monthNamesVi[month]}`;
  }
  return `${monthNamesEn[month]} ${day}`;
}

// =============================================================================
// Freshness States (from Phase 5)
// =============================================================================

export const FRESHNESS_STATES = {
  FRESH: "fresh",
  STALE: "stale",
  EXPIRED: "expired",
  UNAVAILABLE: "unavailable"
} as const;

export type FreshnessState = (typeof FRESHNESS_STATES)[keyof typeof FRESHNESS_STATES];

// =============================================================================
// Trend Direction (FCAST-002)
// =============================================================================

export const TREND_DIRECTIONS = {
  INCREASING: "increasing",
  DECREASING: "decreasing",
  STABLE: "stable"
} as const;

export type TrendDirection = (typeof TREND_DIRECTIONS)[keyof typeof TREND_DIRECTIONS];

/**
 * Temperature threshold for trend change (°C)
 * Per FCAST-002: >2°C = increasing/decreasing, else stable
 */
export const TEMP_TREND_THRESHOLD_C = 2;

// =============================================================================
// Chart Variables (FCAST-003)
// =============================================================================

/**
 * Primary chart variables for MVP
 */
export const CHART_VARIABLES = {
  TEMPERATURE: "temperature",
  PRECIPITATION_PROBABILITY: "precipitation_probability",
  PRECIPITATION_AMOUNT: "precipitation_amount",
  WIND_SPEED: "wind_speed",
  WEATHER_CONDITION: "weather_condition"
} as const;

export type ChartVariable = (typeof CHART_VARIABLES)[keyof typeof CHART_VARIABLES];

// =============================================================================
// Attribution (FCAST-004)
// =============================================================================

export interface ForecastAttribution {
  /** Provider name */
  readonly provider: string;
  /** Attribution text for display */
  readonly attribution_text: string;
  /** Attribution URL if available */
  readonly attribution_url?: string;
  /** Forecast issue time (UTC) */
  readonly issue_time: string;
  /** Last data update time (UTC) */
  readonly last_updated: string;
}

// =============================================================================
// Hourly Forecast Point
// =============================================================================

export interface HourlyForecastPoint {
  /** Forecast time (UTC ISO 8601) */
  readonly time: string;
  /** Display time in ICT format (HH:mm ICT) */
  readonly display_time: string;
  /** Temperature in Celsius */
  readonly temp_c: number | null;
  /** Feels like temperature in Celsius */
  readonly feels_like_c: number | null;
  /** Wind speed in m/s */
  readonly wind_speed: number | null;
  /** Wind direction in degrees */
  readonly wind_dir_deg: number | null;
  /** Wind direction text */
  readonly wind_dir_text: string | null;
  /** Humidity percentage */
  readonly humidity: number | null;
  /** Precipitation probability (0-100) */
  readonly precip_probability: number | null;
  /** Precipitation amount in mm */
  readonly precip_mm: number | null;
  /** UV index */
  readonly uv_index: number | null;
  /** Visibility in km */
  readonly vis_km: number | null;
  /** Weather condition code */
  readonly condition_code: number | null;
  /** Weather condition text */
  readonly condition_text: string | null;
  /** Whether this is a gap in forecast data */
  readonly is_gap: boolean;
  /** Freshness state */
  readonly freshness: FreshnessState;
}

// =============================================================================
// Daily Forecast Point
// =============================================================================

export interface DailyForecastPoint {
  /** Forecast date (UTC ISO 8601 for noon) */
  readonly date: string;
  /** Display date in locale format */
  readonly display_date: string;
  /** Day of week (1=Monday, 7=Sunday) */
  readonly day_of_week: number;
  /** Max temperature in Celsius */
  readonly max_temp_c: number | null;
  /** Min temperature in Celsius */
  readonly min_temp_c: number | null;
  /** Avg temperature in Celsius */
  readonly avg_temp_c: number | null;
  /** Max wind speed in m/s */
  readonly max_wind_speed: number | null;
  /** Total precipitation in mm */
  readonly total_precip_mm: number | null;
  /** Avg humidity percentage */
  readonly avg_humidity: number | null;
  /** UV index */
  readonly uv_index: number | null;
  /** Sunrise time (UTC) */
  readonly sunrise: string | null;
  /** Sunset time (UTC) */
  readonly sunset: string | null;
  /** Moon phase text */
  readonly moon_phase: string | null;
  /** Dominant weather condition code */
  readonly condition_code: number | null;
  /** Dominant weather condition text */
  readonly condition_text: string | null;
  /** Whether this is a gap in forecast data */
  readonly is_gap: boolean;
  /** Freshness state */
  readonly freshness: FreshnessState;
}

// =============================================================================
// Forecast Series
// =============================================================================

export interface ForecastSeries {
  /** Location ID */
  readonly location_id: string;
  /** Location name */
  readonly location_name: string;
  /** Coordinates */
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  };
  /** Requested hourly hours (max 72) */
  readonly requested_hourly_hours: number;
  /** Actual hourly points returned */
  readonly hourly_points: HourlyForecastPoint[];
  /** Requested daily days (max 3) */
  readonly requested_daily_days: number;
  /** Actual daily points returned */
  readonly daily_points: DailyForecastPoint[];
  /** Attribution metadata */
  readonly attribution: ForecastAttribution;
  /** Overall freshness state */
  readonly freshness: FreshnessState;
  /** Stale warning if applicable */
  readonly stale_warning?: string;
  /** Horizon limitation warning if data truncated */
  readonly horizon_warning?: string;
}

// =============================================================================
// Forecast Request
// =============================================================================

export interface ForecastRequest {
  /** Location ID to get forecast for */
  readonly location_id: string;
  /** Request hourly forecast hours (1-72, default 72) */
  readonly hourly_hours?: number;
  /** Request daily forecast days (1-3, default 3) */
  readonly daily_days?: number;
  /** Language for display text (default: vi) */
  readonly language?: "vi" | "en";
}

// =============================================================================
// Forecast Error
// =============================================================================

export const FORECAST_ERROR_CODES = {
  INVALID_LOCATION: "FORECAST_INVALID_LOCATION",
  HORIZON_EXCEEDED: "FORECAST_HORIZON_EXCEEDED",
  NO_DATA: "FORECAST_NO_DATA",
  SERVICE_UNAVAILABLE: "FORECAST_SERVICE_UNAVAILABLE"
} as const;

export type ForecastErrorCode = (typeof FORECAST_ERROR_CODES)[keyof typeof FORECAST_ERROR_CODES];

// =============================================================================
// JSON Schema for Validation
// =============================================================================

export const FORECAST_REQUEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["location_id"],
  properties: {
    location_id: { type: "string", format: "uuid" },
    hourly_hours: { type: "integer", minimum: 1, maximum: 72 },
    daily_days: { type: "integer", minimum: 1, maximum: 3 },
    language: { type: "string", enum: ["vi", "en"] }
  }
} as const;

export const FORECAST_SERIES_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["location_id", "hourly_points", "daily_points", "attribution", "freshness"],
  properties: {
    location_id: { type: "string" },
    location_name: { type: "string" },
    coordinates: {
      type: "object",
      required: ["latitude", "longitude"],
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" }
      }
    },
    requested_hourly_hours: { type: "integer", minimum: 1, maximum: 72 },
    hourly_points: { type: "array" },
    requested_daily_days: { type: "integer", minimum: 1, maximum: 3 },
    daily_points: { type: "array" },
    attribution: { type: "object" },
    freshness: { type: "string", enum: ["fresh", "stale", "expired", "unavailable"] },
    stale_warning: { type: "string" },
    horizon_warning: { type: "string" }
  }
} as const;
