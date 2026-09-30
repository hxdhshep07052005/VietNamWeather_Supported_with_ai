import { createHash } from "node:crypto";
import { selectForecastWindow } from "./weather-forecast-window.js";

import {
  parseWeatherCapabilitiesResponse,
  parseWeatherQueryResponse,
  type Attribution,
  type CurrentWeatherSection,
  type DailyWeatherSection,
  type DatasetCoverage,
  type HourlyWeatherSection,
  type NormalizedWeatherField,
  type WeatherCapabilitiesResponse,
  type WeatherDataset,
  type WeatherDegradedIssue,
  type WeatherFreshness,
  type WeatherProvenance,
  type WeatherQuality,
  type WeatherQueryRequest,
  type WeatherQueryResponse,
  type WeatherQueryTarget
} from "@vietnam-weather/contracts";

import type { WeatherCache } from "./weather-cache.js";
import type { WeatherStore } from "./weather-store.js";

const UNITS = Object.freeze({
  temperature: "celsius" as const,
  windSpeed: "metres_per_second" as const,
  precipitation: "millimetres" as const,
  pressure: "hectopascals" as const,
  visibility: "metres" as const,
  relativeHumidity: "percent" as const,
  probability: "percent" as const,
  direction: "degrees" as const
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN_ACTIVE_STATES = new Set(["pending", "running", "retry_wait"]);
const COORDINATE_GRID_SCALE = 1_000;

interface WeatherServiceOptions {
  readonly store: WeatherStore;
  readonly cache?: WeatherCache;
  readonly cacheTtlSeconds: number;
  readonly pendingRetrySeconds: number;
  readonly now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid normalized weather document");
  return value;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isoValue(value: unknown): string {
  const date = dateValue(value);
  if (date === null) throw new Error("Invalid normalized weather timestamp");
  return date.toISOString();
}

function targetHash(target: WeatherQueryTarget): string {
  const logicalTarget = "locationId" in target
    ? { locationId: target.locationId }
    : {
      coordinates: {
        latitude: Math.round(target.coordinates.latitude * COORDINATE_GRID_SCALE) / COORDINATE_GRID_SCALE,
        longitude: Math.round(target.coordinates.longitude * COORDINATE_GRID_SCALE) / COORDINATE_GRID_SCALE
      }
    };
  return createHash("sha256").update(JSON.stringify(logicalTarget)).digest("hex");
}

function requestKind(include: readonly WeatherDataset[]): "current" | "hourly" | "daily" | "bundle" {
  return include.length === 1 ? include[0] as "current" | "hourly" | "daily" : "bundle";
}

function cacheKey(request: WeatherQueryRequest): string {
  return createHash("sha256").update(JSON.stringify({
    target: targetHash(request.target),
    include: [...request.include].sort()
  })).digest("hex");
}

function idempotencyKey(request: WeatherQueryRequest, now: Date): string {
  const bucketMilliseconds = request.include.includes("current") ? 15 * 60_000 : 6 * 60 * 60_000;
  const bucket = Math.floor(now.getTime() / bucketMilliseconds);
  const digest = createHash("sha256").update(JSON.stringify({
    target: targetHash(request.target),
    include: [...request.include].sort(),
    bucket
  })).digest("hex");
  return `weather:v1:${digest}`;
}

function unavailable(correlationId: string): WeatherQueryResponse {
  return parseWeatherQueryResponse({
    status: "unavailable",
    error: {
      code: "WEATHER_UNAVAILABLE",
      message: "Weather data is temporarily unavailable.",
      correlationId,
      retryable: true
    }
  });
}

function quality(fields: readonly (readonly [NormalizedWeatherField, number | string | null])[]): WeatherQuality {
  const missingFields = fields.filter(([, value]) => value === null).map(([field]) => field);
  return { state: missingFields.length === 0 ? "complete" : "partial", missingFields };
}

function freshness(
  fetchedAt: string,
  expiresAt: string,
  now: Date,
  staleSeconds: number
): WeatherFreshness {
  const fetched = new Date(fetchedAt);
  const freshUntil = new Date(expiresAt);
  if (!Number.isFinite(fetched.getTime()) || !Number.isFinite(freshUntil.getTime())) {
    throw new Error("Invalid normalized weather freshness");
  }
  const staleUntil = new Date(fetched.getTime() + staleSeconds * 1_000);
  const state = now <= freshUntil ? "fresh" : now <= staleUntil ? "stale" : "expired";
  return {
    state,
    assessedAt: now.toISOString(),
    freshUntil: freshUntil.toISOString(),
    staleUntil: staleUntil.toISOString(),
    displayEligible: state === "fresh" || state === "stale",
    riskEligible: state === "fresh",
    routeEligible: state === "fresh"
  };
}

function emptyCoverage(dataset: WeatherDataset, requested: boolean): DatasetCoverage {
  return {
    dataset,
    status: requested ? "unavailable" : "not_requested",
    validInterval: null,
    expectedIntervals: requested ? 0 : null,
    returnedIntervals: 0,
    gaps: []
  };
}

function temporalCoverage(
  dataset: "hourly" | "daily",
  rows: readonly Record<string, unknown>[],
  qualityPartial: boolean
): DatasetCoverage {
  if (rows.length === 0) return emptyCoverage(dataset, true);
  const from = isoValue(rows[0]?.valid_from);
  const to = isoValue(rows[rows.length - 1]?.valid_to);
  const intervalMilliseconds = dataset === "hourly" ? 60 * 60_000 : 24 * 60 * 60_000;
  const expectedIntervals = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / intervalMilliseconds));
  const gaps: { from: string; to: string }[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const previousTo = isoValue(rows[index - 1]?.valid_to);
    const currentFrom = isoValue(rows[index]?.valid_from);
    if (Date.parse(currentFrom) > Date.parse(previousTo)) gaps.push({ from: previousTo, to: currentFrom });
  }
  return {
    dataset,
    status: qualityPartial || gaps.length > 0 || rows.length < expectedIntervals ? "partial" : "complete",
    validInterval: { from, to },
    expectedIntervals,
    returnedIntervals: rows.length,
    gaps
  };
}

function provenance(row: Record<string, unknown>): WeatherProvenance {
  const snapshotId = stringValue(row.provider_run_id) ?? stringValue(row.id);
  if (snapshotId === null || !UUID_PATTERN.test(snapshotId)) throw new Error("Invalid weather snapshot identity");
  return {
    provider: "weatherapi",
    parserVersion: stringValue(row.parser_version) ?? "unknown",
    snapshotId,
    providerIssuedAt: dateValue(row.provider_issued_at)?.toISOString() ?? null,
    fetchedAt: isoValue(row.fetched_at),
    expiresAt: isoValue(row.expires_at)
  };
}

function currentSection(row: Record<string, unknown>, now: Date): CurrentWeatherSection {
  const observedAt = isoValue(row.observed_at);
  const currentQuality = quality([
    ["temperatureCelsius", numberValue(row.temperature_celsius)],
    ["apparentTemperatureCelsius", numberValue(row.feels_like_celsius)],
    ["relativeHumidityPercent", numberValue(row.humidity_percent)],
    ["windSpeedMetresPerSecond", numberValue(row.wind_speed_mps)],
    ["windGustMetresPerSecond", numberValue(row.wind_gust_mps)],
    ["windDirectionDegrees", numberValue(row.wind_direction_degrees)],
    ["precipitationMillimetres", numberValue(row.precipitation_mm)],
    ["pressureHectopascals", numberValue(row.pressure_hpa)],
    ["visibilityMetres", numberValue(row.visibility_meters)],
    ["uvIndex", numberValue(row.uv_index)],
    ["cloudCoverPercent", numberValue(row.cloud_cover_percent)],
    ["conditionCode", stringValue(row.condition_code)]
  ]);
  const currentCoverage: DatasetCoverage = {
    dataset: "current",
    status: currentQuality.state,
    validInterval: { from: observedAt, to: isoValue(row.expires_at) },
    expectedIntervals: 1,
    returnedIntervals: 1,
    gaps: []
  };
  return {
    provenance: provenance(row),
    freshness: freshness(isoValue(row.fetched_at), isoValue(row.expires_at), now, 3_600),
    coverage: currentCoverage,
    value: {
      kind: "observation",
      observedAt,
      validInterval: currentCoverage.validInterval as { from: string; to: string },
      quality: currentQuality,
      temperatureCelsius: numberValue(row.temperature_celsius),
      apparentTemperatureCelsius: numberValue(row.feels_like_celsius),
      relativeHumidityPercent: numberValue(row.humidity_percent),
      windSpeedMetresPerSecond: numberValue(row.wind_speed_mps),
      windGustMetresPerSecond: numberValue(row.wind_gust_mps),
      windDirectionDegrees: numberValue(row.wind_direction_degrees),
      precipitationMillimetres: numberValue(row.precipitation_mm),
      pressureHectopascals: numberValue(row.pressure_hpa),
      visibilityMetres: numberValue(row.visibility_meters),
      uvIndex: numberValue(row.uv_index),
      cloudCoverPercent: numberValue(row.cloud_cover_percent),
      conditionCode: stringValue(row.condition_code) as CurrentWeatherSection["value"]["conditionCode"]
    }
  };
}

function hourlySection(rows: readonly Record<string, unknown>[], now: Date): HourlyWeatherSection | null {
  if (rows.length === 0) return null;
  const values = rows.map((row) => {
    const rowQuality = quality([
      ["temperatureCelsius", numberValue(row.temperature_celsius)],
      ["apparentTemperatureCelsius", numberValue(row.feels_like_celsius)],
      ["relativeHumidityPercent", numberValue(row.humidity_percent)],
      ["windSpeedMetresPerSecond", numberValue(row.wind_speed_mps)],
      ["windGustMetresPerSecond", numberValue(row.wind_gust_mps)],
      ["windDirectionDegrees", numberValue(row.wind_direction_degrees)],
      ["precipitationMillimetres", numberValue(row.precipitation_mm)],
      ["pressureHectopascals", numberValue(row.pressure_hpa)],
      ["visibilityMetres", numberValue(row.visibility_meters)],
      ["uvIndex", numberValue(row.uv_index)],
      ["cloudCoverPercent", numberValue(row.cloud_cover_percent)],
      ["conditionCode", stringValue(row.condition_code)],
      ["precipitationProbabilityPercent", numberValue(row.precipitation_probability_percent)]
    ]);
    return {
      kind: "forecast" as const,
      validInterval: { from: isoValue(row.valid_from), to: isoValue(row.valid_to) },
      quality: rowQuality,
      temperatureCelsius: numberValue(row.temperature_celsius),
      apparentTemperatureCelsius: numberValue(row.feels_like_celsius),
      relativeHumidityPercent: numberValue(row.humidity_percent),
      windSpeedMetresPerSecond: numberValue(row.wind_speed_mps),
      windGustMetresPerSecond: numberValue(row.wind_gust_mps),
      windDirectionDegrees: numberValue(row.wind_direction_degrees),
      precipitationMillimetres: numberValue(row.precipitation_mm),
      pressureHectopascals: numberValue(row.pressure_hpa),
      visibilityMetres: numberValue(row.visibility_meters),
      uvIndex: numberValue(row.uv_index),
      cloudCoverPercent: numberValue(row.cloud_cover_percent),
      conditionCode: stringValue(row.condition_code) as HourlyWeatherSection["values"][number]["conditionCode"],
      precipitationProbabilityPercent: numberValue(row.precipitation_probability_percent)
    };
  });
  const sectionFreshness = freshness(
    isoValue(rows[0]?.fetched_at),
    isoValue(rows[0]?.expires_at),
    now,
    86_400
  );
  const coverage = temporalCoverage("hourly", rows, values.some((value) => value.quality.state === "partial"));
  return { provenance: provenance(rows[0] as Record<string, unknown>), freshness: sectionFreshness, coverage, values };
}

function dailySection(rows: readonly Record<string, unknown>[], now: Date): DailyWeatherSection | null {
  if (rows.length === 0) return null;
  const values = rows.map((row) => {
    const rowQuality = quality([
      ["minimumTemperatureCelsius", numberValue(row.temperature_min_celsius)],
      ["maximumTemperatureCelsius", numberValue(row.temperature_max_celsius)],
      ["precipitationMillimetres", numberValue(row.precipitation_mm)],
      ["maximumPrecipitationProbabilityPercent", numberValue(row.precipitation_probability_percent)],
      ["maximumWindSpeedMetresPerSecond", numberValue(row.wind_speed_mps)],
      ["averageRelativeHumidityPercent", numberValue(row.humidity_percent)],
      ["conditionCode", stringValue(row.condition_code)]
    ]);
    return {
      kind: "forecast" as const,
      date: new Date(Date.parse(isoValue(row.valid_from)) + 7 * 3600000).toISOString().slice(0, 10),
      validInterval: { from: isoValue(row.valid_from), to: isoValue(row.valid_to) },
      quality: rowQuality,
      minimumTemperatureCelsius: numberValue(row.temperature_min_celsius),
      maximumTemperatureCelsius: numberValue(row.temperature_max_celsius),
      precipitationMillimetres: numberValue(row.precipitation_mm),
      maximumPrecipitationProbabilityPercent: numberValue(row.precipitation_probability_percent),
      maximumWindSpeedMetresPerSecond: numberValue(row.wind_speed_mps),
      averageRelativeHumidityPercent: numberValue(row.humidity_percent),
      conditionCode: stringValue(row.condition_code) as DailyWeatherSection["values"][number]["conditionCode"]
    };
  });
  const sectionFreshness = freshness(
    isoValue(rows[0]?.fetched_at),
    isoValue(rows[0]?.expires_at),
    now,
    86_400
  );
  const coverage = temporalCoverage("daily", rows, values.some((value) => value.quality.state === "partial"));
  return { provenance: provenance(rows[0] as Record<string, unknown>), freshness: sectionFreshness, coverage, values };
}

function sourceAttribution(source: Record<string, unknown>): Attribution {
  const name = stringValue(source.display_name);
  const url = stringValue(source.terms_url);
  if (name === null || url === null || !url.startsWith("https://")) throw new Error("Invalid weather attribution");
  return { name, url };
}

function pending(correlationId: string, retryAfterSeconds: number): WeatherQueryResponse {
  return parseWeatherQueryResponse({ status: "pending", retryAfterSeconds, correlationId });
}

function feature(
  enabled: boolean,
  granularityMinutes: number | null,
  horizon: number,
  verifiedAt: string | null,
  freshForSeconds: number | null,
  staleDisplayForSeconds: number | null
): Record<string, unknown> {
  return {
    enabled,
    granularityMinutes,
    account: { supported: enabled, verifiedAt, maximumHorizonHours: enabled ? horizon : null },
    entitlement: { allowed: enabled, maximumHorizonHours: enabled ? horizon : null },
    providerCoverage: { available: enabled, maximumHorizonHours: enabled ? horizon : null },
    operationalMaximumHorizonHours: enabled ? 72 : 0,
    effectiveMaximumHorizonHours: enabled ? horizon : 0,
    freshnessPolicy: {
      freshForSeconds: enabled ? freshForSeconds : null,
      staleDisplayForSeconds: enabled ? staleDisplayForSeconds : null,
      staleDisplayEligible: enabled,
      staleRiskEligible: false,
      staleRouteEligible: false
    }
  };
}

export class WeatherService {
  readonly #store: WeatherStore;
  readonly #cache: WeatherCache | undefined;
  readonly #cacheTtlSeconds: number;
  readonly #pendingRetrySeconds: number;
  readonly #now: () => Date;

  constructor(options: WeatherServiceOptions) {
    this.#store = options.store;
    this.#cache = options.cache;
    this.#cacheTtlSeconds = options.cacheTtlSeconds;
    this.#pendingRetrySeconds = options.pendingRetrySeconds;
    this.#now = options.now ?? (() => new Date());
  }

  async capabilities(correlationId: string): Promise<WeatherCapabilitiesResponse> {
    const document = requiredRecord(await this.#store.capabilities());
    const source = requiredRecord(document.source);
    const capabilities = requiredRecord(document.capabilities);
    const verifiedAt = dateValue(document.last_verified_at)?.toISOString() ?? null;
    const horizon = Math.min(72, numberValue(capabilities.operational_horizon_hours) ?? 72);
    const attribution = sourceAttribution(source);
    return parseWeatherCapabilitiesResponse({
      status: "success",
      correlationId,
      data: {
        apiVersion: "v1",
        updatedAt: this.#now().toISOString(),
        canonicalTimezone: "Asia/Ho_Chi_Minh",
        units: UNITS,
        fallback: "none",
        providerMixing: false,
        operationalMaximumHorizonHours: 72,
        source: { provider: stringValue(source.display_name) ?? "WeatherAPI.com", attribution },
        features: {
          current: feature(capabilities.current === true, null, 0, verifiedAt, 900, 3_600),
          hourly: feature(capabilities.hourly === true, 60, horizon, verifiedAt, 21_600, 86_400),
          daily: feature(capabilities.daily === true, 1_440, horizon, verifiedAt, 21_600, 86_400),
          nowcast: feature(false, null, 0, null, null, null),
          alerts: feature(false, null, 0, null, null, null),
          spatialLayers: feature(false, null, 0, null, null, null)
        }
      }
    });
  }

  async query(request: WeatherQueryRequest, correlationId: string): Promise<WeatherQueryResponse> {
    const now = this.#now();
    const responseCacheKey = cacheKey(request);
    try {
      const cached = await this.#cache?.get(responseCacheKey);
      if (cached !== null && cached !== undefined) {
        return parseWeatherQueryResponse({ ...cached, correlationId });
      }
    } catch {
      // PostgreSQL remains authoritative when Redis is unavailable.
    }

    let document: Record<string, unknown>;
    try {
      document = requiredRecord(await this.#store.fetch(request.target, now));
    } catch {
      return unavailable(correlationId);
    }

    if (document.status !== "available") {
      return this.#enqueueOrUnavailable(request, correlationId, now);
    }
    try {
      const source = requiredRecord(document.source);
      const observation = isRecord(document.observation) ? document.observation : null;
      const allForecasts = Array.isArray(document.forecasts)
        ? document.forecasts.map(requiredRecord)
        : [];
      const hourlyRows = selectForecastWindow(allForecasts, "hourly", now);
      const dailyRows = selectForecastWindow(allForecasts, "daily", now);
      const requested = new Set(request.include);
      const current = requested.has("current") && observation !== null ? currentSection(observation, now) : null;
      const hourly = requested.has("hourly") ? hourlySection(hourlyRows, now) : null;
      const daily = requested.has("daily") ? dailySection(dailyRows, now) : null;
      const availableRequested = [
        requested.has("current") ? current : undefined,
        requested.has("hourly") ? hourly : undefined,
        requested.has("daily") ? daily : undefined
      ].filter((value) => value !== undefined && value !== null);
      if (availableRequested.length === 0 || availableRequested.every((section) => section?.freshness.displayEligible === false)) {
        return this.#enqueueOrUnavailable(request, correlationId, now);
      }

      const coverageDatasets = {
        current: current?.coverage ?? emptyCoverage("current", requested.has("current")),
        hourly: hourly?.coverage ?? emptyCoverage("hourly", requested.has("hourly")),
        daily: daily?.coverage ?? emptyCoverage("daily", requested.has("daily"))
      };
      const coverageEnds = [hourly, daily]
        .flatMap((section) => section?.coverage.validInterval?.to ?? [])
        .map((value) => Date.parse(value))
        .filter(Number.isFinite);
      const effectiveHorizonHours = coverageEnds.length === 0
        ? 0
        : Math.max(0, Math.min(72, Math.ceil((Math.max(...coverageEnds) - now.getTime()) / 3_600_000)));
      const issues: WeatherDegradedIssue[] = [];
      if (requested.has("current") && current === null) issues.push({ code: "CURRENT_UNAVAILABLE", dataset: "current", retryable: true });
      if (current?.coverage.status === "partial") {
        issues.push({ code: "COVERAGE_REDUCED", dataset: "current", retryable: false });
      }
      if (requested.has("hourly") && (hourly === null || hourly.coverage.status === "partial")) {
        issues.push({ code: "HOURLY_PARTIAL", dataset: "hourly", retryable: true });
      }
      if (requested.has("daily") && (daily === null || daily.coverage.status === "partial")) {
        issues.push({ code: "DAILY_PARTIAL", dataset: "daily", retryable: true });
      }
      if ([current, hourly, daily].some((section) => section?.freshness.state === "stale")) {
        issues.push({ code: "STALE_DATA", dataset: null, retryable: true });
      }
      const data = {
        target: {
          locationId: "locationId" in request.target ? request.target.locationId : null,
          timezone: "Asia/Ho_Chi_Minh" as const
        },
        units: UNITS,
        providerMixing: false as const,
        attribution: sourceAttribution(source),
        coverage: { requested: request.include, effectiveHorizonHours, datasets: coverageDatasets },
        current,
        hourly,
        daily
      };
      const response = parseWeatherQueryResponse(issues.length === 0
        ? { status: "success", data, correlationId }
        : { status: "degraded", data, issues, correlationId });
      try { await this.#cache?.set(responseCacheKey, response, this.#cacheTtlSeconds); } catch { /* optional */ }
      if (issues.some((issue) => issue.code.endsWith("UNAVAILABLE") || issue.code.endsWith("PARTIAL"))) {
        await this.#enqueue(request, now).catch(() => undefined);
      }
      return response;
    } catch {
      return unavailable(correlationId);
    }
  }

  async #enqueueOrUnavailable(
    request: WeatherQueryRequest,
    correlationId: string,
    now: Date
  ): Promise<WeatherQueryResponse> {
    try {
      const result = await this.#enqueue(request, now);
      return RUN_ACTIVE_STATES.has(result.status)
        ? pending(correlationId, this.#pendingRetrySeconds)
        : unavailable(correlationId);
    } catch {
      return unavailable(correlationId);
    }
  }

  #enqueue(request: WeatherQueryRequest, now: Date) {
    const target = "coordinates" in request.target
      ? {
        coordinates: {
          latitude: Math.round(request.target.coordinates.latitude * COORDINATE_GRID_SCALE) / COORDINATE_GRID_SCALE,
          longitude: Math.round(request.target.coordinates.longitude * COORDINATE_GRID_SCALE) / COORDINATE_GRID_SCALE
        }
      }
      : request.target;
    return this.#store.enqueue(
      target,
      requestKind(request.include),
      idempotencyKey(request, now),
      now
    );
  }
}
