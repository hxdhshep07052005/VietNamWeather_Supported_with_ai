/**
 * Phase 5 weather provider constants — mirrored from the worker
 * (`apps/worker/src/weather/normalize.ts`). The API must agree with
 * the worker's provider_key + parser_version because both write to the
 * same `app_weather.*` tables and the `app_weather.fetch_weather_bundle_public`
 * SQL function joins on `provider_key`.
 */
export const WEATHERAPI_PROVIDER_KEY = "weatherapi";
export const WEATHERAPI_PARSER_VERSION = "weatherapi-forecast-v1";

/**
 * Default per-feature freshness budgets (in seconds). The values match
 * the `feature(...)` constructor in `weather-service.ts` so server
 * defaults and store defaults stay aligned.
 */
export const DEFAULT_FRESHNESS = Object.freeze({
  currentFreshForSeconds: 900,
  currentStaleDisplayForSeconds: 3_600,
  hourlyFreshForSeconds: 21_600,
  hourlyStaleDisplayForSeconds: 86_400,
  dailyFreshForSeconds: 21_600,
  dailyStaleDisplayForSeconds: 86_400
});

/**
 * Severe-condition thresholds used by the advisory service. These are
 * observation-time triggers, not risk thresholds; the risk engine still
 * decides the level. Values are intentionally expressed as numeric
 * ranges so they can be moved to Directus in a later phase without
 * breaking the response shape.
 */
export const SEVERE_CONDITION_THRESHOLDS = Object.freeze({
  windSpeedMetresPerSecond: 17,
  precipitationMillimetres: 50,
  visibilityMetres: 1_000,
  thunderstormConditionCodes: Object.freeze([1087, 1273, 1276, 1279, 1282] as readonly number[])
});
