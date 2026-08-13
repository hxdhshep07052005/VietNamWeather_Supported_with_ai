import {
  calculateNormalizedPayloadChecksum,
  type DailyWeatherForecast,
  type HourlyWeatherForecast,
  type NormalizedWeatherPayload
} from "../weather/index.js";

import type {
  WeatherForecastSqlRecord,
  WeatherObservationSqlRecord,
  WeatherPersistenceBundle,
  WeatherRequestKind
} from "./types.js";

const COORDINATE_SCALE = 1_000_000;
const CURRENT_FRESHNESS_MILLISECONDS = 15 * 60 * 1_000;
const FORECAST_FRESHNESS_MILLISECONDS = 6 * 60 * 60 * 1_000;

function normalizedCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new WeatherRuntimeMappingError();
  }
  const rounded = Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function rowIdentity(
  payload: NormalizedWeatherPayload,
  kind: "observation" | "hourly" | "daily",
  validFrom: string,
  validTo: string
): string {
  return `weather:v1:${kind}:${calculateNormalizedPayloadChecksum({
    provider: payload.source.provider,
    parser_version: payload.source.parserVersion,
    target: {
      latitude: normalizedCoordinate(payload.target.latitude),
      longitude: normalizedCoordinate(payload.target.longitude)
    },
    logical_snapshot: payload.current.observedAt,
    valid_from: validFrom,
    valid_to: validTo
  })}`;
}

function freshnessExpiry(
  fetchedAt: string,
  providerExpiry: string,
  maximumFreshnessMilliseconds: number
): string {
  const fetchedTime = Date.parse(fetchedAt);
  const providerExpiryTime = Date.parse(providerExpiry);
  if (!Number.isFinite(fetchedTime) || !Number.isFinite(providerExpiryTime)) {
    throw new WeatherRuntimeMappingError();
  }
  return new Date(Math.min(
    providerExpiryTime,
    fetchedTime + maximumFreshnessMilliseconds
  )).toISOString();
}

function rowChecksum(record: object): string {
  const logicalRecord = Object.fromEntries(Object.entries(record).filter(
    ([key]) => key !== "fetched_at" && key !== "expires_at"
  ));
  return calculateNormalizedPayloadChecksum(logicalRecord);
}

function withObservationIdentity(
  payload: NormalizedWeatherPayload,
  record: Omit<WeatherObservationSqlRecord, "idempotency_key" | "normalized_payload_checksum_sha256">
): WeatherObservationSqlRecord {
  return {
    idempotency_key: rowIdentity(
      payload,
      "observation",
      record.observed_at,
      record.observed_at
    ),
    normalized_payload_checksum_sha256: rowChecksum(record),
    ...record
  };
}

function withForecastIdentity(
  payload: NormalizedWeatherPayload,
  record: Omit<WeatherForecastSqlRecord, "idempotency_key" | "normalized_payload_checksum_sha256">
): WeatherForecastSqlRecord {
  return {
    idempotency_key: rowIdentity(
      payload,
      record.horizon_kind,
      record.valid_from,
      record.valid_to
    ),
    normalized_payload_checksum_sha256: rowChecksum(record),
    ...record
  };
}

function mapObservation(payload: NormalizedWeatherPayload): WeatherObservationSqlRecord {
  const current = payload.current;
  return withObservationIdentity(payload, {
    provider_record_id: null,
    observed_at: current.observedAt,
    fetched_at: payload.fetchedAt,
    expires_at: freshnessExpiry(
      payload.fetchedAt,
      current.expiresAt,
      CURRENT_FRESHNESS_MILLISECONDS
    ),
    condition_code: current.conditionCode,
    temperature_celsius: current.temperatureCelsius,
    feels_like_celsius: current.apparentTemperatureCelsius,
    humidity_percent: current.relativeHumidityPercent,
    precipitation_mm: current.precipitationMillimetres,
    wind_speed_mps: current.windSpeedMetresPerSecond,
    wind_gust_mps: current.windGustMetresPerSecond,
    wind_direction_degrees: current.windDirectionDegrees,
    pressure_hpa: current.pressureHectopascals,
    visibility_meters: current.visibilityMetres,
    source_quality: "reported",
    status: "valid"
  });
}

function mapHourly(
  payload: NormalizedWeatherPayload,
  hourly: HourlyWeatherForecast
): WeatherForecastSqlRecord {
  return withForecastIdentity(payload, {
    provider_record_id: null,
    horizon_kind: "hourly",
    provider_issued_at: hourly.providerIssuedAt ?? payload.providerIssuedAt,
    valid_from: hourly.validInterval.from,
    valid_to: hourly.validInterval.to,
    fetched_at: payload.fetchedAt,
    expires_at: freshnessExpiry(
      payload.fetchedAt,
      hourly.expiresAt,
      FORECAST_FRESHNESS_MILLISECONDS
    ),
    condition_code: hourly.conditionCode,
    temperature_celsius: hourly.temperatureCelsius,
    temperature_min_celsius: null,
    temperature_max_celsius: null,
    precipitation_mm: hourly.precipitationMillimetres,
    precipitation_probability_percent: hourly.precipitationProbabilityPercent,
    wind_speed_mps: hourly.windSpeedMetresPerSecond,
    wind_gust_mps: hourly.windGustMetresPerSecond,
    confidence_percent: null,
    status: "valid"
  });
}

function mapDaily(
  payload: NormalizedWeatherPayload,
  daily: DailyWeatherForecast
): WeatherForecastSqlRecord {
  return withForecastIdentity(payload, {
    provider_record_id: null,
    horizon_kind: "daily",
    provider_issued_at: daily.providerIssuedAt ?? payload.providerIssuedAt,
    valid_from: daily.validInterval.from,
    valid_to: daily.validInterval.to,
    fetched_at: payload.fetchedAt,
    expires_at: freshnessExpiry(
      payload.fetchedAt,
      daily.expiresAt,
      FORECAST_FRESHNESS_MILLISECONDS
    ),
    condition_code: daily.conditionCode,
    temperature_celsius: null,
    temperature_min_celsius: daily.minimumTemperatureCelsius,
    temperature_max_celsius: daily.maximumTemperatureCelsius,
    precipitation_mm: daily.precipitationMillimetres,
    precipitation_probability_percent: daily.maximumPrecipitationProbabilityPercent,
    wind_speed_mps: daily.maximumWindSpeedMetresPerSecond,
    wind_gust_mps: null,
    confidence_percent: null,
    status: "valid"
  });
}

export class WeatherRuntimeMappingError extends Error {
  readonly code = "weather_provider_schema_invalid";
  readonly retryable = false;

  constructor() {
    super("Normalized weather data was rejected.");
    this.name = "WeatherRuntimeMappingError";
  }
}

export function mapNormalizedWeatherPayload(
  payload: NormalizedWeatherPayload,
  requestKind: WeatherRequestKind
): WeatherPersistenceBundle {
  try {
    const includeCurrent = requestKind === "current" || requestKind === "bundle";
    const includeHourly = requestKind === "hourly" || requestKind === "bundle";
    const includeDaily = requestKind === "daily" || requestKind === "bundle";
    const observations = includeCurrent ? [mapObservation(payload)] : [];
    const hourly = includeHourly ? payload.hourly.map((record) => mapHourly(payload, record)) : [];
    const daily = includeDaily ? payload.daily.map((record) => mapDaily(payload, record)) : [];
    const selectedQuality = [
      ...(includeCurrent ? [payload.current.quality] : []),
      ...(includeHourly ? payload.hourly.map((record) => record.quality) : []),
      ...(includeDaily ? payload.daily.map((record) => record.quality) : [])
    ];
    const records = observations.length + hourly.length + daily.length;

    return {
      observations,
      forecasts: [...hourly, ...daily],
      partial: requestKind !== "capability_probe" && (
        records === 0 || selectedQuality.some((quality) => quality.state === "partial")
      )
    };
  } catch (error) {
    if (error instanceof WeatherRuntimeMappingError) {
      throw error;
    }
    throw new WeatherRuntimeMappingError();
  }
}
