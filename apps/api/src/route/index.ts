/**
 * Phase 8 Route Module
 * Weather-aware route planning services
 */

export { GeocodingService, GeocodingError, createGeocodingService, type GeocodingServiceOptions } from "./geocoding-service.js";

export { RoutingService, createRoutingService, type RoutingServiceOptions } from "./routing-service.js";

export { RouteSampler, createRouteSampler, type RouteSamplerOptions } from "./route-sampler.js";

export { RouteRiskEngine, createRouteRiskEngine, type RouteRiskEngineOptions } from "./route-risk-engine.js";

export { RouteService, RouteServiceError, createRouteService, type RouteServiceOptions } from "./route-service.js";

export { buildRouteRoutes, type RouteRoutesOptions } from "./routes.js";
