import type { RouteWeatherRefresh } from "./route-weather-refresh.js";
import { provisionalRouteScore } from "./provisional-risk.js";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { type RouteRequest, type RouteResponse, type RouteAlternative, MAX_ROUTE_LENGTH_METERS, MAX_ETA_HOURS } from "@vietnam-weather/contracts";
import { createGeocodingService, type GeocodingService } from "./geocoding-service.js";
import { createRoutingService, type RoutingService } from "./routing-service.js";
import { createRouteSampler, type RouteSampler } from "./route-sampler.js";
import { createRouteRiskEngine, type RouteRiskEngine } from "./route-risk-engine.js";

import type { RestStopService } from "./rest-stop-service.js";

export interface RouteServiceOptions {
  readonly weatherRefresh?: Pick<RouteWeatherRefresh, "refresh">;
  readonly restStopService?: Pick<RestStopService, "findForRoute">;
  readonly dbPool: Pool;
  readonly geocodingService?: GeocodingService;
  readonly routingService?: RoutingService;
  readonly routeSampler?: RouteSampler;
  readonly routeRiskEngine?: RouteRiskEngine;
}

/** Report (3.14) weights; incomplete evidence uses the separately versioned provisional policy. */
export function rankAlternatives(alternatives: RouteAlternative[]): RouteAlternative[] {
  const maxTime = Math.max(...alternatives.map(a => a.geometry.duration_seconds));
  const maxDistance = Math.max(...alternatives.map(a => a.geometry.distance_meters));
  return alternatives.map(a => ({ ...a, balanced_score: (a.route_risk.score ?? a.route_risk.provisional?.score) == null || maxTime <= 0 || maxDistance <= 0 ? null :
    0.5 * (a.route_risk.score ?? a.route_risk.provisional?.score ?? 0) + 0.3 * a.geometry.duration_seconds / maxTime + 0.2 * a.geometry.distance_meters / maxDistance }));
}

export class RouteService {
  private readonly weatherRefresh?: Pick<RouteWeatherRefresh, "refresh">;
  private readonly geocodingService: GeocodingService;
  private readonly routingService: RoutingService;
  private readonly routeSampler: RouteSampler;
  private readonly routeRiskEngine: RouteRiskEngine;
  private readonly restStopService?: Pick<RestStopService, "findForRoute">;
  constructor(options: RouteServiceOptions) {
    this.weatherRefresh = options.weatherRefresh;
    this.restStopService = options.restStopService;
    this.geocodingService = options.geocodingService ?? createGeocodingService();
    this.routingService = options.routingService ?? createRoutingService();
    this.routeSampler = options.routeSampler ?? createRouteSampler({ dbPool: options.dbPool });
    this.routeRiskEngine = options.routeRiskEngine ?? createRouteRiskEngine({ dbPool: options.dbPool });
  }

  async calculateRoutes(request: RouteRequest): Promise<RouteResponse> {
    const now = new Date();
    const departure = request.departure_time ? new Date(request.departure_time) : now;
    if (!Number.isFinite(departure.getTime()) || departure < now || departure.getTime() > now.getTime() + MAX_ETA_HOURS * 3600000)
      throw new RouteServiceError("ROUTE_ETA_EXCEEDS_LIMIT", "Departure must be within the forecast horizon", randomUUID(), false);
    const [origin, destination] = await Promise.all([
      this.geocodingService.resolveLocation(request.origin), this.geocodingService.resolveLocation(request.destination),
    ]);
    const routes = await this.routingService.getAlternatives(origin.coordinates, destination.coordinates, request.vehicle_type);
    const primaryRoute = [...routes].sort((a, b) => a.duration_seconds - b.duration_seconds)[0];
    const restStops = primaryRoute ? this.restStopService?.findForRoute(primaryRoute) : undefined;
    const candidates: RouteAlternative[] = [];
    for (const route of routes) {
      if (route.distance_meters > MAX_ROUTE_LENGTH_METERS) throw new RouteServiceError("ROUTE_TOO_LONG", "Route exceeds supported distance", randomUUID(), false);
      const samples = await this.routeSampler.sampleRoute(route, departure);
      const points = await this.routeRiskEngine.calculatePointRisks(samples, request.vehicle_type);
      const segments = this.routeRiskEngine.calculateSegmentRisks(points, samples);
      const strictRisk = this.routeRiskEngine.calculateRouteRisk(segments);
      const risk = { ...strictRisk, ...(strictRisk.score === null ? { provisional: provisionalRouteScore(samples) } : {}) };
      candidates.push({ alternative_type: "fastest", geometry: route, sample_points: samples,
        route_risk: { ...risk, dangerous_checkpoint_count: [...points.values()].filter(p => p.severity >= 2 || p.evidence.some(e => e.severity >= 2)).length,
          unknown_checkpoint_count: [...points.values()].filter(p => p.severity === 0).length },
        segment_risks: segments, balanced_score: null,
        summary: { vi: risk.provisional ? "Điểm sơ bộ theo thời tiết hiện có; đoạn thiếu dữ liệu bị tính mức phạt tối đa" : risk.score === null ? "Chưa đủ dữ liệu để đánh giá toàn tuyến" : `Rủi ro thời tiết: ${risk.level}`,
          en: risk.provisional ? "Provisional weather ranking; uncovered segments receive the maximum penalty" : risk.score === null ? "Insufficient evidence to assess the entire route" : `Weather risk: ${risk.level}` },
        warnings: risk.score === null ? ["incomplete_weather_evidence"] : [] });
    }
    let weatherRefresh: RouteResponse["weather_refresh"];
    if (this.weatherRefresh) {
      try {
        const refresh = await this.weatherRefresh.refresh(candidates.flatMap(candidate => candidate.sample_points));
        if (refresh.requested || refresh.deferred) weatherRefresh = {
          status: refresh.runs.some(run => ["pending", "running", "retry_wait"].includes(run.status)) ? "pending" : "unavailable",
          requested_points: refresh.requested, retry_after_seconds: 5,
        };
      } catch {
        weatherRefresh = { status: "unavailable", requested_points: 0, retry_after_seconds: 5 };
      }
    }
    const ranked = rankAlternatives(candidates);
    const fastest = [...ranked].sort((a,b) => a.geometry.duration_seconds - b.geometry.duration_seconds)[0];
    const shortest = [...ranked].sort((a,b) => a.geometry.distance_meters - b.geometry.distance_meters)[0];
    const eligible = ranked.filter(a => a.balanced_score !== null);
    const safer = [...eligible].sort((a,b) => a.balanced_score! - b.balanced_score!)[0];
    // Labels select real candidates; they never modify geometry, weather, risk or confidence.
    const alternatives: RouteAlternative[] = [];
    if (fastest) alternatives.push({ ...fastest, alternative_type: "fastest" });
    if (shortest && shortest !== fastest) alternatives.push({ ...shortest, alternative_type: "shortest" });
    if (safer && ranked.length > 1) alternatives.push({ ...safer, alternative_type: "weather_safer" });
    const best = alternatives.find(a => a.alternative_type === "weather_safer") ??
      alternatives.filter(a => a.balanced_score !== null).sort((a,b) => a.balanced_score! - b.balanced_score!)[0];
    const incomplete = ranked.length === 0 || ranked.some(a => a.route_risk.score === null || a.route_risk.level === "unknown");
    return { ...(weatherRefresh ? { weather_refresh: weatherRefresh } : {}), origin, destination, departure_time: departure.toISOString(), alternatives,
      ...(restStops ? { rest_stops: await restStops } : {}),
      recommended_alternative: best?.alternative_type ?? null,
      attribution: { routing_provider: "Geoapify", weather_provider: "Persisted weather evidence (see sample sources)",
        issue_time: now.toISOString(), last_updated: now.toISOString() },
      warnings: incomplete ? [ranked.some(a => a.route_risk.provisional) ? "provisional_weather_score: missing evidence remains unknown; review before travel" : "incomplete_weather_evidence"] : [], is_incomplete: incomplete };
  }
}
export class RouteServiceError extends Error {
  constructor(readonly code: string, message: string, readonly correlationId: string, readonly retryable: boolean) {
    super(message); this.name = "RouteServiceError";
  }
}
export function createRouteService(options: RouteServiceOptions): RouteService { return new RouteService(options); }
