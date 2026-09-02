/**
 * Phase 5 / Phase 9 weather HTTP route bindings.
 *
 * The service modules (`weather-service.ts`, `weather-store.ts`,
 * `weather-cache.ts`) live at `apps/api/src/` root because Phase 5
 * delivered them before the directory restructure planned for Phase 9.
 * This barrel exposes the constructor + a thin request reader that the
 * server module wires into Fastify.
 */
export { WeatherService } from "../weather-service.js";
export {
  PostgresWeatherStore,
  UnavailableWeatherStore,
  type WeatherStore,
  type WeatherEnqueueResult
} from "../weather-store.js";
export {
  RedisWeatherCache,
  type WeatherCache
} from "../weather-cache.js";

export {
  WEATHERAPI_PROVIDER_KEY,
  WEATHERAPI_PARSER_VERSION,
  DEFAULT_FRESHNESS,
  SEVERE_CONDITION_THRESHOLDS
} from "./constants.js";

export {
  type WeatherCapabilitiesRoute,
  type WeatherQueryRoute,
  type WeatherObservationRoute
} from "./types.js";

export {
  buildWeatherRoutes,
  type WeatherRoutesOptions
} from "./routes.js";
