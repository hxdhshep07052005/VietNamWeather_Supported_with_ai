/**
 * Phase 8 Route Planner Contracts
 * Weather-aware route planning with risk evaluation
 *
 * Based on decisions ROUTE-001..008
 * - Vehicle types: Car, Motorcycle
 * - 3 alternatives: Fastest, Shortest, Weather-safer
 * - Max route: 50km
 */

// =============================================================================
// Constants (ROUTE-001, ROUTE-003, ROUTE-005)
// =============================================================================

/**
 * Supported vehicle types
 * Per ROUTE-001: Car and Motorcycle
 */
export const VEHICLE_TYPES = {
  CAR: "car",
  MOTORCYCLE: "motorcycle"
} as const;

export type VehicleType = (typeof VEHICLE_TYPES)[keyof typeof VEHICLE_TYPES];

/**
 * Route alternative types
 * Per ROUTE-003: Fastest, Shortest, Weather-safer
 */
export const ROUTE_ALTERNATIVES = {
  FASTEST: "fastest",
  SHORTEST: "shortest",
  WEATHER_SAFER: "weather_safer"
} as const;

export type RouteAlternativeType = (typeof ROUTE_ALTERNATIVES)[keyof typeof ROUTE_ALTERNATIVES];

/**
 * Maximum route length in meters
 * Per ROUTE-005: 50 km
 */
export const MAX_ROUTE_LENGTH_METERS = 50_000;

/**
 * Maximum ETA for risk scoring in hours
 * Per DATA-004 and ROUTE-002
 */
export const MAX_ETA_HOURS = 72;

// =============================================================================
// Scoring Configuration (ROUTE-004)
// =============================================================================

/**
 * Default scoring weights
 * Per ROUTE-004: risk=0.5, time=0.3, distance=0.2
 */
export const DEFAULT_SCORING_WEIGHTS = {
  risk_weight: 0.5,
  time_weight: 0.3,
  distance_weight: 0.2
} as const;

/**
 * Maximum deviation threshold in meters
 * Per ROUTE-008: 100m
 */
export const DEVIATION_THRESHOLD_METERS = 100;

/**
 * Minimum reroute interval in seconds
 * Per ROUTE-008: 60s
 */
export const MIN_REROUTE_INTERVAL_SECONDS = 60;

// =============================================================================
// Sampling Configuration
// =============================================================================

/**
 * Sample interval: time in minutes
 */
export const SAMPLE_INTERVAL_MINUTES = 15;

/**
 * Sample interval: distance in meters
 */
export const SAMPLE_INTERVAL_METERS = 5_000;

// =============================================================================
// Geoapify Transport Modes
// =============================================================================

/**
 * Geoapify transport mode mapping
 */
export const GEOAPIFY_TRANSPORT_MODES: Record<VehicleType, string> = {
  [VEHICLE_TYPES.CAR]: "driving-car",
  [VEHICLE_TYPES.MOTORCYCLE]: "driving-hgv"
} as const;

// =============================================================================
// Coordinates
// =============================================================================

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

// =============================================================================
// Location
// =============================================================================

export type LocationInput =
  | { type: "text"; value: string }
  | { type: "coordinates"; value: Coordinates };

export interface ResolvedLocation {
  readonly original: LocationInput;
  readonly coordinates: Coordinates;
  readonly display_name?: string;
}

// =============================================================================
// Route Request
// =============================================================================

export interface RouteRequest {
  /** Origin: text query or coordinates */
  readonly origin: LocationInput;
  /** Destination: text query or coordinates */
  readonly destination: LocationInput;
  /** Vehicle type */
  readonly vehicle_type: VehicleType;
  /** Departure time (ISO 8601). If not provided, defaults to now. */
  readonly departure_time?: string;
  /** Language for display (default: vi) */
  readonly language?: "vi" | "en";
  /** Scoring weights override */
  readonly scoring_weights?: {
    readonly risk_weight?: number;
    readonly time_weight?: number;
    readonly distance_weight?: number;
  };
}

// =============================================================================
// Route Geometry
// =============================================================================

export interface RouteGeometry {
  /** GeoJSON LineString coordinates */
  readonly coordinates: ReadonlyArray<Coordinates>;
  /** Total distance in meters */
  readonly distance_meters: number;
  /** Total duration in seconds */
  readonly duration_seconds: number;
}

// =============================================================================
// Sample Point
// =============================================================================

export interface SamplePoint {
  /** Coordinates */
  readonly coordinates: Coordinates;
  /** Distance from route start in meters */
  readonly distance_from_start_meters: number;
  /** Time from departure in seconds */
  readonly time_from_departure_seconds: number;
  /** ETA at this point */
  readonly eta: string;
  /** Is this point interpolated? */
  readonly is_interpolated: boolean;
  /** Weather data available? */
  readonly has_weather_data: boolean;
  /** Freshness of weather data */
  readonly weather_freshness?: string;
}

// =============================================================================
// Segment Risk
// =============================================================================

export interface SegmentRisk {
  /** Segment start index */
  readonly segment_start: number;
  /** Segment end index */
  readonly segment_end: number;
  /** Risk level at this segment */
  readonly risk_level: "low" | "caution" | "high" | "unknown";
  /** Risk score 0-1 */
  readonly risk_score: number;
  /** Risk severity 0-3 */
  readonly severity: number;
  /** Contributing factors */
  readonly factors: ReadonlyArray<string>;
  /** Weather conditions summary */
  readonly conditions_summary: {
    vi: string;
    en: string;
  };
}

// =============================================================================
// Route Alternative
// =============================================================================

export interface RouteAlternative {
  /** Alternative type */
  readonly alternative_type: RouteAlternativeType;
  /** Route geometry */
  readonly geometry: RouteGeometry;
  /** Sample points along route */
  readonly sample_points: SamplePoint[];
  /** Risk assessment for entire route */
  readonly route_risk: {
    readonly level: "low" | "caution" | "high" | "unknown";
    readonly score: number;
    readonly confidence: number;
  };
  /** Per-segment risks */
  readonly segment_risks: SegmentRisk[];
  /** Balanced score (0-1, lower is better) */
  readonly balanced_score: number;
  /** Summary text */
  readonly summary: {
    readonly vi: string;
    readonly en: string;
  };
  /** Warnings for this route */
  readonly warnings: ReadonlyArray<string>;
}

// =============================================================================
// Attribution
// =============================================================================

export interface RouteAttribution {
  readonly routing_provider: string;
  readonly weather_provider: string;
  readonly issue_time: string;
  readonly last_updated: string;
}

// =============================================================================
// Route Response
// =============================================================================

export interface RouteResponse {
  /** Request origin (resolved) */
  readonly origin: ResolvedLocation;
  /** Request destination (resolved) */
  readonly destination: ResolvedLocation;
  /** Departure time used */
  readonly departure_time: string;
  /** Available alternatives */
  readonly alternatives: RouteAlternative[];
  /** Best route recommendation (lowest balanced score) */
  readonly recommended_alternative: RouteAlternativeType;
  /** Attribution metadata */
  readonly attribution: RouteAttribution;
  /** Overall warnings */
  readonly warnings: ReadonlyArray<string>;
  /** Is route incomplete due to missing data? */
  readonly is_incomplete: boolean;
}

// =============================================================================
// GPS Progress
// =============================================================================

export interface GpsPosition {
  readonly coordinates: Coordinates;
  readonly timestamp: string;
  readonly accuracy_meters?: number;
}

export interface RouteProgress {
  /** Current position */
  readonly position: GpsPosition;
  /** Distance from current position to nearest route point */
  readonly distance_to_route_meters: number;
  /** Nearest point on route */
  readonly nearest_route_point: Coordinates;
  /** Progress along route (0-1) */
  readonly progress: number;
  /** Deviation detected? */
  readonly is_deviated: boolean;
  /** Time since last reroute offer */
  readonly time_since_last_reroute_seconds?: number;
}

// =============================================================================
// Error Codes
// =============================================================================

export const ROUTE_ERROR_CODES = {
  INVALID_ORIGIN: "ROUTE_INVALID_ORIGIN",
  INVALID_DESTINATION: "ROUTE_INVALID_DESTINATION",
  ORIGIN_NOT_FOUND: "ROUTE_ORIGIN_NOT_FOUND",
  DESTINATION_NOT_FOUND: "ROUTE_DESTINATION_NOT_FOUND",
  ROUTE_TOO_LONG: "ROUTE_TOO_LONG",
  ETA_EXCEEDS_LIMIT: "ROUTE_ETA_EXCEEDS_LIMIT",
  NO_ROUTE_FOUND: "ROUTE_NO_ROUTE_FOUND",
  PROVIDER_ERROR: "ROUTE_PROVIDER_ERROR",
  SERVICE_UNAVAILABLE: "ROUTE_SERVICE_UNAVAILABLE"
} as const;

export type RouteErrorCode = (typeof ROUTE_ERROR_CODES)[keyof typeof ROUTE_ERROR_CODES];

// =============================================================================
// JSON Schema for Validation
// =============================================================================

export const ROUTE_REQUEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["origin", "destination", "vehicle_type"],
  properties: {
    origin: {
      type: "object",
      oneOf: [
        { type: "object", required: ["type", "value"], properties: { type: { const: "text" }, value: { type: "string" } } },
        { type: "object", required: ["type", "value"], properties: { type: { const: "coordinates" }, value: { type: "object", required: ["latitude", "longitude"], properties: { latitude: { type: "number" }, longitude: { type: "number" } } } } }
      ]
    },
    destination: { $ref: "#/properties/origin" },
    vehicle_type: { type: "string", enum: ["car", "motorcycle"] },
    departure_time: { type: "string", format: "date-time" },
    language: { type: "string", enum: ["vi", "en"] },
    scoring_weights: {
      type: "object",
      properties: {
        risk_weight: { type: "number", minimum: 0, maximum: 1 },
        time_weight: { type: "number", minimum: 0, maximum: 1 },
        distance_weight: { type: "number", minimum: 0, maximum: 1 }
      }
    }
  }
} as const;

export const ROUTE_RESPONSE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["origin", "destination", "alternatives", "attribution"],
  properties: {
    origin: { type: "object" },
    destination: { type: "object" },
    departure_time: { type: "string" },
    alternatives: { type: "array" },
    recommended_alternative: { type: "string" },
    attribution: { type: "object" },
    warnings: { type: "array" },
    is_incomplete: { type: "boolean" }
  }
} as const;
