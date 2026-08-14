/**
 * Phase 7 Trend Contracts
 * Trend calculation for weather forecasts
 *
 * Based on decision FCAST-002
 * - Trend = change within forecast window
 * - Temperature: >2°C = increasing/decreasing
 */

// =============================================================================
// Import Trend Direction and Threshold from forecast-v1
// (Single source of truth pattern)
// =============================================================================

import {
  TREND_DIRECTIONS,
  TEMP_TREND_THRESHOLD_C,
  type TrendDirection,
} from "./forecast-v1.js";

// Re-export for external consumers
export { TREND_DIRECTIONS, TEMP_TREND_THRESHOLD_C, type TrendDirection };

// =============================================================================
// Trend Variable Types
// =============================================================================

/**
 * Variables that can have trends calculated
 */
export const TREND_VARIABLES = {
  TEMPERATURE: "temperature",
  PRECIPITATION: "precipitation",
  WIND: "wind"
} as const;

export type TrendVariable = (typeof TREND_VARIABLES)[keyof typeof TREND_VARIABLES];

// =============================================================================
// Trend Calculation Result
// =============================================================================

export interface VariableTrend {
  /** Variable being trends */
  readonly variable: TrendVariable;
  /** Direction of trend */
  readonly direction: TrendDirection;
  /** Change amount (in variable units) */
  readonly change: number;
  /** Unit of measurement */
  readonly unit: string;
  /** Confidence in trend calculation (0-100) */
  readonly confidence: number;
  /** Number of data points used in calculation */
  readonly data_points: number;
  /** Time span covered by trend calculation (hours) */
  readonly span_hours: number;
}

// =============================================================================
// Trend Summary
// =============================================================================

export interface TrendSummary {
  /** Location ID */
  readonly location_id: string;
  /** Time range of trend calculation (start, UTC) */
  readonly period_start: string;
  /** Time range of trend calculation (end, UTC) */
  readonly period_end: string;
  /** Individual variable trends */
  readonly variable_trends: VariableTrend[];
  /** Overall weather trend description */
  readonly summary_text: {
    vi: string;
    en: string;
  };
  /** Display period in ICT timezone */
  readonly display_period: string;
}

// =============================================================================
// Trend Request
// =============================================================================

export interface TrendRequest {
  /** Location ID */
  readonly location_id: string;
  /** Period to calculate trend over (hours, default 24) */
  readonly period_hours?: number;
  /** Language (default: vi) */
  readonly language?: "vi" | "en";
}

// =============================================================================
// Trend Calculation Constants
// =============================================================================

/**
 * Minimum data points required for reliable trend calculation
 */
export const MIN_TREND_DATA_POINTS = 3;

/**
 * Maximum period for trend calculation (hours)
 */
export const MAX_TREND_PERIOD_HOURS = 72;

/**
 * Default period for trend calculation (hours)
 */
export const DEFAULT_TREND_PERIOD_HOURS = 24;

/**
 * Precipitation trend threshold (mm change)
 */
export const PRECIP_TREND_THRESHOLD_MM = 5;

/**
 * Wind trend threshold (m/s change)
 */
export const WIND_TREND_THRESHOLD_MS = 3;

// =============================================================================
// Trend Text Templates
// =============================================================================

export const TREND_TEXT = {
  vi: {
    temperature: {
      increasing: "Nhiệt độ có xu hướng tăng",
      decreasing: "Nhiệt độ có xu hướng giảm",
      stable: "Nhiệt độ ổn định"
    },
    precipitation: {
      increasing: "Khả năng mưa có xu hướng tăng",
      decreasing: "Khả năng mưa có xu hướng giảm",
      stable: "Khả năng mưa ổn định"
    },
    wind: {
      increasing: "Tốc độ gió có xu hướng tăng",
      decreasing: "Tốc độ gió có xu hướng giảm",
      stable: "Tốc độ gió ổn định"
    }
  },
  en: {
    temperature: {
      increasing: "Temperature is trending upward",
      decreasing: "Temperature is trending downward",
      stable: "Temperature is stable"
    },
    precipitation: {
      increasing: "Precipitation chance is increasing",
      decreasing: "Precipitation chance is decreasing",
      stable: "Precipitation chance is stable"
    },
    wind: {
      increasing: "Wind speed is increasing",
      decreasing: "Wind speed is decreasing",
      stable: "Wind speed is stable"
    }
  }
} as const;

// =============================================================================
// JSON Schema for Validation
// =============================================================================

export const TREND_REQUEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["location_id"],
  properties: {
    location_id: { type: "string", format: "uuid" },
    period_hours: { type: "integer", minimum: 1, maximum: 72 },
    language: { type: "string", enum: ["vi", "en"] }
  }
} as const;

export const TREND_SUMMARY_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["location_id", "period_start", "period_end", "variable_trends", "summary_text"],
  properties: {
    location_id: { type: "string" },
    period_start: { type: "string", format: "date-time" },
    period_end: { type: "string", format: "date-time" },
    variable_trends: {
      type: "array",
      items: {
        type: "object",
        required: ["variable", "direction", "change", "unit", "confidence"],
        properties: {
          variable: { type: "string" },
          direction: { type: "string", enum: ["increasing", "decreasing", "stable"] },
          change: { type: "number" },
          unit: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
          data_points: { type: "integer", minimum: 1 },
          span_hours: { type: "number" }
        }
      }
    },
    summary_text: {
      type: "object",
      required: ["vi", "en"],
      properties: {
        vi: { type: "string" },
        en: { type: "string" }
      }
    },
    display_period: { type: "string" }
  }
} as const;
