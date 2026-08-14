/**
 * Phase 6 Risk Engine Contracts
 * Config-Driven Weather Risk Evaluation
 *
 * Based on decisions RISK-001..007
 * - 4 levels: Low, Caution, High, Unknown
 * - 6 dimensions: precipitation, wind, temperature, visibility, storm, alert
 * - Max severity aggregation
 * - Stale data → Unknown
 */

// =============================================================================
// Risk Levels (RISK-001)
// =============================================================================

/**
 * Risk severity levels per RISK-001
 * - Low (1): Weather conditions are favorable for travel
 * - Caution (2): Be aware of weather conditions; minor disruptions possible
 * - High (3): Significant weather impact expected; reconsider travel
 * - Unknown (4): Insufficient data or data quality too poor to assess
 */
export const RISK_LEVELS = {
  LOW: "low",
  CAUTION: "caution",
  HIGH: "high",
  UNKNOWN: "unknown"
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

/**
 * Numeric severity score for comparison
 * Higher number = more severe
 * Per RISK-005: Max severity aggregation uses these scores
 */
export const RISK_SEVERITY_SCORES: Record<RiskLevel, number> = {
  [RISK_LEVELS.HIGH]: 3,
  [RISK_LEVELS.CAUTION]: 2,
  [RISK_LEVELS.LOW]: 1,
  [RISK_LEVELS.UNKNOWN]: 0
} as const;

// =============================================================================
// Risk Colors (RISK-001)
// =============================================================================

/**
 * Color codes for UI display per RISK-001
 */
export const RISK_COLORS: Record<RiskLevel, string> = {
  [RISK_LEVELS.LOW]: "#22C55E", // Green
  [RISK_LEVELS.CAUTION]: "#EAB308", // Yellow
  [RISK_LEVELS.HIGH]: "#F97316", // Orange
  [RISK_LEVELS.UNKNOWN]: "#9CA3AF" // Gray
} as const;

// =============================================================================
// Risk Dimensions (RISK-002)
// =============================================================================

/**
 * Risk evaluation dimensions per RISK-002
 */
export const RISK_DIMENSIONS = {
  PRECIPITATION: "precipitation",
  WIND: "wind",
  TEMPERATURE: "temperature",
  VISIBILITY: "visibility",
  STORM: "storm",
  ALERT: "alert"
} as const;

export type RiskDimension =
  (typeof RISK_DIMENSIONS)[keyof typeof RISK_DIMENSIONS];

// =============================================================================
// Risk Operators
// =============================================================================

/**
 * Supported operators for rule evaluation
 */
export const RISK_OPERATORS = {
  GT: "gt", // Greater than
  GTE: "gte", // Greater than or equal
  LT: "lt", // Less than
  LTE: "lte", // Less than or equal
  EQ: "eq", // Equal
  BETWEEN: "between", // Range (inclusive)
  IN: "in", // In list
  MISSING: "missing" // Field is missing/null
} as const;

export type RiskOperator =
  (typeof RISK_OPERATORS)[keyof typeof RISK_OPERATORS];

// =============================================================================
// Weather Input (from Phase 5 contracts)
// =============================================================================

/**
 * Normalized weather data from Phase 5 weather service
 */
export interface NormalizedWeatherInput {
  /** Temperature in Celsius */
  temp_c?: number;
  /** Wind speed in m/s */
  wind_speed?: number;
  /** Wind gust in m/s (optional) */
  wind_gust?: number;
  /** Visibility in kilometers */
  vis_km?: number;
  /** Rainfall in mm/h */
  rain_mm?: number;
  /** Snowfall in mm/h (water equivalent) */
  snow_mm?: number;
  /** Thunderstorm present (1 = yes, 0 = no) */
  thunderstorm?: 0 | 1;
  /** Weather condition code (normalized) */
  condition_code?: number;
  /** Humidity percentage */
  humidity?: number;
  /** UV index */
  uv_index?: number;
  /** Provider issued timestamp */
  issued_at?: string;
  /** Provider valid timestamp */
  valid_at?: string;
  /** Provider fetched timestamp */
  fetched_at?: string;
  /** Provider source identifier */
  provider?: string;
  /** Parser version */
  parser_version?: string;
}

// =============================================================================
// Freshness States (imported from forecast-v1)
// =============================================================================

// Import for use within this file (single source of truth)
import { FRESHNESS_STATES, type FreshnessState } from "./forecast-v1.js";

// Re-export for external consumers
export { FRESHNESS_STATES, type FreshnessState };

// =============================================================================
// Risk Assessment Request
// =============================================================================

/**
 * Request for risk assessment
 */
export interface RiskAssessmentRequest {
  /** Location ID to assess */
  location_id: string;
  /** Target timestamp for assessment (ISO 8601) */
  target_time?: string;
  /** Language for messages (default: vi) */
  language?: "vi" | "en";
  /** Whether to include triggered rules in response */
  include_triggered_rules?: boolean;
}

// =============================================================================
// Triggered Rule Evidence
// =============================================================================

/**
 * Individual triggered rule evidence
 */
export interface TriggeredRule {
  /** Rule external identifier */
  rule_id: string;
  /** Rule external key */
  external_key: string;
  /** Dimension this rule evaluates */
  dimension: RiskDimension;
  /** Severity level triggered */
  severity: RiskLevel;
  /** Actual value from weather data */
  actual_value: number;
  /** Threshold value from rule */
  threshold_value: number;
  /** Upper threshold (for BETWEEN operator) */
  threshold_upper_value?: number;
  /** Unit of measurement */
  unit?: string;
  /** Localized message */
  message?: string;
  /** Localized explanation */
  explanation?: string;
}

// =============================================================================
// Risk Assessment Response
// =============================================================================

/**
 * Response from risk assessment
 */
export interface RiskAssessmentResponse {
  /** Assessment ID (for audit/tracking) */
  assessment_id: string;
  /** Location ID assessed */
  location_id: string;
  /** Target time assessed */
  target_time: string;
  /** Overall risk level */
  level: RiskLevel;
  /** Color for UI display */
  color: string;
  /** Confidence percentage (0-100) */
  confidence_percent: number | null;
  /** Whether weather data was fresh */
  freshness_state: FreshnessState;
  /** Triggered rules count */
  triggered_rules_count: number;
  /** Triggered rules evidence */
  triggered_rules?: TriggeredRule[];
  /** Advisory message (localized) */
  advisory?: string;
  /** Disclaimer text (per RISK-007) */
  disclaimer: {
    vi: string;
    en: string;
  };
  /** Rule set version used */
  rule_set_version: number;
  /** Assessment timestamp */
  assessed_at: string;
  /** Attribution to data source */
  attribution?: string;
}

// =============================================================================
// Risk Capabilities Response
// =============================================================================

/**
 * Response for risk capabilities endpoint
 */
export interface RiskCapabilitiesResponse {
  /** Supported dimensions */
  dimensions: RiskDimension[];
  /** Supported risk levels */
  levels: RiskLevel[];
  /** Supported languages */
  languages: ("vi" | "en")[];
  /** Active rule set version */
  active_rule_set_version: number;
  /** Freshness requirements */
  freshness_requirements: {
    current_max_age_minutes: number;
    forecast_max_age_hours: number;
  };
}

// =============================================================================
// Risk Error Response
// =============================================================================

/**
 * Structured error response for risk service
 */
export interface RiskErrorResponse {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Correlation ID for debugging */
  correlation_id: string;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Additional details (optional) */
  details?: Record<string, unknown>;
}

// =============================================================================
// Risk Engine Errors
// =============================================================================

export const RISK_ERROR_CODES = {
  INVALID_LOCATION: "RISK_INVALID_LOCATION",
  INVALID_TIME: "RISK_INVALID_TIME",
  NO_DATA: "RISK_NO_DATA",
  RULE_SET_NOT_FOUND: "RISK_RULE_SET_NOT_FOUND",
  ASSESSMENT_FAILED: "RISK_ASSESSMENT_FAILED",
  SERVICE_UNAVAILABLE: "RISK_SERVICE_UNAVAILABLE"
} as const;

export type RiskErrorCode =
  (typeof RISK_ERROR_CODES)[keyof typeof RISK_ERROR_CODES];

// =============================================================================
// Disclaimer Text (RISK-007)
// =============================================================================

export const RISK_DISCLAIMERS = {
  vi: "Thông tin thời tiết chỉ mang tính tham khảo. Không thay thế cảnh báo chính thức từ cơ quan chức năng. Quyết định du lịch cuối cùng thuộc về bạn.",
  en: "Weather information is for reference only. Does not replace official advisories from authorities. Final travel decisions are yours."
} as const;

// =============================================================================
// Validation Schemas (for JSON Schema validation)
// =============================================================================

/**
 * JSON Schema for RiskAssessmentRequest
 */
export const RISK_ASSESSMENT_REQUEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["location_id"],
  properties: {
    location_id: {
      type: "string",
      format: "uuid"
    },
    target_time: {
      type: "string",
      format: "date-time"
    },
    language: {
      type: "string",
      enum: ["vi", "en"]
    },
    include_triggered_rules: {
      type: "boolean"
    }
  }
} as const;

/**
 * JSON Schema for RiskAssessmentResponse
 */
export const RISK_ASSESSMENT_RESPONSE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [
    "assessment_id",
    "location_id",
    "target_time",
    "level",
    "color",
    "triggered_rules_count",
    "disclaimer",
    "rule_set_version",
    "assessed_at"
  ],
  properties: {
    assessment_id: { type: "string" },
    location_id: { type: "string" },
    target_time: { type: "string" },
    level: {
      type: "string",
      enum: ["low", "caution", "high", "unknown"]
    },
    color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    confidence_percent: { type: ["number", "null"], minimum: 0, maximum: 100 },
    freshness_state: {
      type: "string",
      enum: ["fresh", "stale", "expired", "unavailable"]
    },
    triggered_rules_count: { type: "integer", minimum: 0 },
    triggered_rules: {
      type: "array",
      items: {
        type: "object",
        required: ["rule_id", "external_key", "dimension", "severity", "actual_value", "threshold_value"],
        properties: {
          rule_id: { type: "string" },
          external_key: { type: "string" },
          dimension: { type: "string" },
          severity: {
            type: "string",
            enum: ["low", "caution", "high", "unknown"]
          },
          actual_value: { type: "number" },
          threshold_value: { type: "number" },
          threshold_upper_value: { type: "number" },
          unit: { type: "string" },
          message: { type: "string" },
          explanation: { type: "string" }
        }
      }
    },
    advisory: { type: "string" },
    disclaimer: {
      type: "object",
      required: ["vi", "en"],
      properties: {
        vi: { type: "string" },
        en: { type: "string" }
      }
    },
    rule_set_version: { type: "integer", minimum: 1 },
    assessed_at: { type: "string", format: "date-time" },
    attribution: { type: "string" }
  }
} as const;
