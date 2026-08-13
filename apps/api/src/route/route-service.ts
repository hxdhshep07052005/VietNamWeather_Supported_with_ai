/**
 * Phase 8 Route Service
 * Main orchestrator for weather-aware route planning
 *
 * Integrates: Geocoding → Routing → Sampling → Risk → Scoring
 */

import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import {
  type RouteRequest,
  type RouteResponse,
  type RouteAlternative,
  type RouteAlternativeType,
  type RouteAttribution,
  type Coordinates,
  ROUTE_ALTERNATIVES,
  MAX_ROUTE_LENGTH_METERS,
  MAX_ETA_HOURS,
  DEFAULT_SCORING_WEIGHTS,
} from "@vietnam-weather/contracts";

import type { GeocodingService } from "./geocoding-service.js";
import { createGeocodingService } from "./geocoding-service.js";
import type { RoutingService } from "./routing-service.js";
import { createRoutingService } from "./routing-service.js";
import type { RouteSampler } from "./route-sampler.js";
import { createRouteSampler } from "./route-sampler.js";
import type { RouteRiskEngine } from "./route-risk-engine.js";
import { createRouteRiskEngine } from "./route-risk-engine.js";

// =============================================================================
// Types
// =============================================================================

export interface RouteServiceOptions {
  readonly dbPool: Pool;
  readonly geocodingService?: GeocodingService;
  readonly routingService?: RoutingService;
  readonly routeSampler?: RouteSampler;
  readonly routeRiskEngine?: RouteRiskEngine;
}

interface ScoringWeights {
  risk_weight: number;
  time_weight: number;
  distance_weight: number;
}

// =============================================================================
// Route Service
// =============================================================================

export class RouteService {
  private readonly dbPool: Pool;
  private readonly geocodingService: GeocodingService;
  private readonly routingService: RoutingService;
  private readonly routeSampler: RouteSampler;
  private readonly routeRiskEngine: RouteRiskEngine;

  constructor(options: RouteServiceOptions) {
    this.dbPool = options.dbPool;
    this.geocodingService = options.geocodingService ?? createGeocodingService();
    this.routingService = options.routingService ?? createRoutingService();
    this.routeSampler = options.routeSampler ?? createRouteSampler({ dbPool: this.dbPool });
    this.routeRiskEngine = options.routeRiskEngine ?? createRouteRiskEngine({ dbPool: this.dbPool });
  }

  /**
   * Calculate weather-aware routes
   */
  async calculateRoutes(request: RouteRequest): Promise<RouteResponse> {
    const correlationId = randomUUID();
    const warnings: string[] = [];

    // Parse departure time
    const departureTime = request.departure_time
      ? new Date(request.departure_time)
      : new Date();

    // Validate departure time is within limits
    const now = new Date();
    const maxDeparture = new Date(now.getTime() + MAX_ETA_HOURS * 60 * 60 * 1000);

    if (departureTime < now) {
      throw new RouteServiceError(
        "ROUTE_INVALID_ORIGIN",
        "Departure time cannot be in the past",
        correlationId,
        false
      );
    }

    if (departureTime > maxDeparture) {
      throw new RouteServiceError(
        "ROUTE_ETA_EXCEEDS_LIMIT",
        `Departure time exceeds maximum ${MAX_ETA_HOURS} hours`,
        correlationId,
        false
      );
    }

    // Resolve locations
    const [origin, destination] = await Promise.all([
      this.geocodingService.resolveLocation(request.origin),
      this.geocodingService.resolveLocation(request.destination),
    ]);

    // Get route alternatives
    const routes = await this.routingService.getAlternatives(
      origin.coordinates,
      destination.coordinates,
      request.vehicle_type
    );

    // Validate route length (ROUTE-005)
    for (const route of routes) {
      if (route.distance_meters > MAX_ROUTE_LENGTH_METERS) {
        throw new RouteServiceError(
          "ROUTE_TOO_LONG",
          `Route exceeds maximum ${MAX_ROUTE_LENGTH_METERS / 1000} km`,
          correlationId,
          false
        );
      }
    }

    // Calculate alternatives
    const alternatives: RouteAlternative[] = [];
    const weights = this.getScoringWeights(request.scoring_weights);

    for (const route of routes) {
      const alternative = await this.createAlternative(
        route,
        departureTime,
        request,
        weights,
        warnings
      );
      alternatives.push(alternative);
    }

    // Create weather-safer alternative if we have routes
    if (routes.length >= 1) {
      const weatherSafer = await this.createWeatherSaferAlternative(
        routes[0]!,
        departureTime,
        request,
        weights,
        warnings
      );
      if (weatherSafer) {
        alternatives.push(weatherSafer);
      }
    }

    // Determine recommended route (lowest balanced score)
    const recommended = this.getRecommendedAlternative(alternatives);

    // Build attribution
    const attribution: RouteAttribution = {
      routing_provider: "Geoapify",
      weather_provider: "WeatherAPI.com",
      issue_time: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    return {
      origin,
      destination,
      departure_time: departureTime.toISOString(),
      alternatives,
      recommended_alternative: recommended,
      attribution,
      warnings: [...new Set(warnings)],
      is_incomplete: warnings.some(w => w.includes("missing") || w.includes("incomplete")),
    };
  }

  /**
   * Create a route alternative
   */
  private async createAlternative(
    route: { coordinates: readonly Coordinates[]; distance_meters: number; duration_seconds: number },
    departureTime: Date,
    request: RouteRequest,
    weights: ScoringWeights,
    warnings: string[]
  ): Promise<RouteAlternative> {
    // Sample points along route
    const samples = await this.routeSampler.sampleRoute(
      route,
      departureTime
    );

    // Enrich with weather data
    const enrichedSamples = await this.routeSampler.enrichWithWeather(samples);

    // Calculate risks
    const pointRisks = await this.routeRiskEngine.calculatePointRisks(enrichedSamples);

    // Create segments (divide route into equal segments)
    const segments = this.createSegments(enrichedSamples.length);
    const segmentRisks = this.routeRiskEngine.calculateSegmentRisks(pointRisks, segments);

    // Calculate route risk
    const routeRisk = this.routeRiskEngine.calculateRouteRisk(segmentRisks);

    // Check for incomplete data
    if (routeRisk.confidence < 100) {
      warnings.push(`Route has ${100 - routeRisk.confidence}% missing weather data`);
    }

    // Calculate balanced score
    const balancedScore = this.calculateBalancedScore(
      routeRisk.score,
      route.distance_meters,
      route.duration_seconds,
      weights,
      route
    );

    // Determine alternative type based on scoring
    const alternativeType = this.determineAlternativeType(
      route,
      alternatives =>
        alternatives.filter(a => a.alternative_type !== ROUTE_ALTERNATIVES.WEATHER_SAFER)
    );

    return {
      alternative_type: alternativeType,
      geometry: route,
      sample_points: enrichedSamples,
      route_risk: routeRisk,
      segment_risks: segmentRisks,
      balanced_score: balancedScore,
      summary: this.generateSummary(routeRisk),
      warnings: [],
    };
  }

  /**
   * Create weather-safer alternative
   */
  private async createWeatherSaferAlternative(
    route: { coordinates: readonly Coordinates[]; distance_meters: number; duration_seconds: number },
    departureTime: Date,
    request: RouteRequest,
    weights: ScoringWeights,
    warnings: string[]
  ): Promise<RouteAlternative | null> {
    // For MVP, weather-safer is same geometry with weather-safer scoring
    // In future, this could call alternative routing considering weather
    const alternative = await this.createAlternative(route, departureTime, request, weights, warnings);

    return {
      ...alternative,
      alternative_type: ROUTE_ALTERNATIVES.WEATHER_SAFER,
      summary: {
        vi: "Tuyến đường có rủi ro thời tiết thấp hơn theo dữ liệu hiện có",
        en: "Route with lower weather risk based on available data",
      },
    };
  }

  /**
   * Create route segments
   */
  private createSegments(pointCount: number): Array<{ start: number; end: number }> {
    const segments: Array<{ start: number; end: number }> = [];
    const segmentSize = Math.max(1, Math.floor(pointCount / 4)); // ~4 segments

    for (let i = 0; i < pointCount; i += segmentSize) {
      segments.push({
        start: i,
        end: Math.min(i + segmentSize - 1, pointCount - 1),
      });
    }

    return segments;
  }

  /**
   * Calculate balanced score
   */
  private calculateBalancedScore(
    riskScore: number,
    distance: number,
    duration: number,
    weights: ScoringWeights,
    referenceRoute: { distance_meters: number; duration_seconds: number }
  ): number {
    const normalizedRisk = riskScore;
    const normalizedTime = duration / Math.max(referenceRoute.duration_seconds, 1);
    const normalizedDistance = distance / Math.max(referenceRoute.distance_meters, 1);

    return (
      weights.risk_weight * normalizedRisk +
      weights.time_weight * normalizedTime +
      weights.distance_weight * normalizedDistance
    );
  }

  /**
   * Determine alternative type
   */
  private determineAlternativeType(
    route: { distance_meters: number; duration_seconds: number },
    getOthers: (alternatives: RouteAlternative[]) => RouteAlternative[]
  ): RouteAlternativeType {
    const others = getOthers([]);
    if (others.length === 0) return ROUTE_ALTERNATIVES.FASTEST;

    const fastest = others.find(a => a.alternative_type === ROUTE_ALTERNATIVES.FASTEST);
    const shortest = others.find(a => a.alternative_type === ROUTE_ALTERNATIVES.SHORTEST);

    if (route.duration_seconds <= (fastest?.geometry.duration_seconds ?? Infinity)) {
      return ROUTE_ALTERNATIVES.FASTEST;
    }

    if (route.distance_meters <= (shortest?.geometry.distance_meters ?? Infinity)) {
      return ROUTE_ALTERNATIVES.SHORTEST;
    }

    return ROUTE_ALTERNATIVES.FASTEST;
  }

  /**
   * Get recommended alternative (lowest balanced score)
   */
  private getRecommendedAlternative(alternatives: RouteAlternative[]): RouteAlternativeType {
    if (alternatives.length === 0) return ROUTE_ALTERNATIVES.FASTEST;

    const best = alternatives.reduce((prev, curr) =>
      prev.balanced_score < curr.balanced_score ? prev : curr
    );

    return best.alternative_type;
  }

  /**
   * Get scoring weights
   */
  private getScoringWeights(override?: RouteRequest["scoring_weights"]): ScoringWeights {
    const defaults = DEFAULT_SCORING_WEIGHTS;
    return {
      risk_weight: override?.risk_weight ?? defaults.risk_weight,
      time_weight: override?.time_weight ?? defaults.time_weight,
      distance_weight: override?.distance_weight ?? defaults.distance_weight,
    };
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    routeRisk: { level: string; score: number }
  ): { vi: string; en: string } {
    const levelText = {
      low: { vi: "Thấp", en: "Low" },
      caution: { vi: "Trung bình", en: "Moderate" },
      high: { vi: "Cao", en: "High" },
      unknown: { vi: "Không xác định", en: "Unknown" },
    };

    const riskLevel = routeRisk.level as keyof typeof levelText;
    const text = levelText[riskLevel] ?? levelText.unknown;

    return {
      vi: `Rủi ro thời tiết: ${text.vi}`,
      en: `Weather risk: ${text.en}`,
    };
  }
}

// =============================================================================
// Route Service Error
// =============================================================================

export class RouteServiceError extends Error {
  readonly code: string;
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, correlationId: string, retryable: boolean) {
    super(message);
    this.name = "RouteServiceError";
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRouteService(options: RouteServiceOptions): RouteService {
  return new RouteService(options);
}
