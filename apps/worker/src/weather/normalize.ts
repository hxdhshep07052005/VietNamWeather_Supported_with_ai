import type {
  Attribution,
  NormalizedWeatherField,
  WeatherQuality
} from "@vietnam-weather/contracts";

import { calculateNormalizedPayloadChecksum } from "./checksum.js";
import { WeatherProviderError, weatherSchemaError } from "./errors.js";
import {
  WEATHER_UNITS,
  type CurrentWeatherObservation,
  type DailyWeatherForecast,
  type HourlyWeatherForecast,
  type NormalizedWeatherPayload,
  type WeatherCapabilities,
  type WeatherConditionCode,
  type WeatherPoint
} from "./types.js";

export const WEATHERAPI_PARSER_VERSION = "weatherapi-forecast-v1";
export const WEATHERAPI_PROVIDER_ID = "weatherapi";
export const WEATHERAPI_ATTRIBUTION: Attribution = Object.freeze({
  name: "WeatherAPI.com",
  url: "https://www.weatherapi.com/"
});

const CURRENT_RETENTION_MILLISECONDS = 60 * 60 * 1_000;
const FORECAST_RETENTION_MILLISECONDS = 24 * 60 * 60 * 1_000;
const MIN_WEATHER_EPOCH_SECONDS = 946_684_800;
const MAX_WEATHER_EPOCH_SECONDS = 4_102_444_800;
const WEATHERAPI_CONDITION_CODES: Readonly<Record<number, WeatherConditionCode>> = Object.freeze({
  1000: "clear",
  1003: "partly_cloudy",
  1006: "cloudy",
  1009: "cloudy",
  1030: "fog",
  1036: "fog",      // Smoky haze
  1039: "fog",      // Smog
  1042: "fog",      // Severe smog
  1063: "rain",
  1066: "snow",
  1069: "sleet",
  1072: "drizzle",
  1087: "thunderstorm",
  1114: "snow",
  1117: "snow",
  1135: "fog",
  1147: "fog",
  1150: "drizzle",
  1153: "drizzle",
  1168: "drizzle",
  1171: "drizzle",
  1180: "rain",
  1183: "rain",
  1186: "rain",
  1189: "rain",
  1192: "heavy_rain",
  1195: "heavy_rain",
  1198: "rain",
  1201: "rain",
  1204: "sleet",
  1207: "sleet",
  1210: "snow",
  1213: "snow",
  1216: "snow",
  1219: "snow",
  1222: "snow",
  1225: "snow",
  1237: "hail",
  1240: "rain",
  1243: "heavy_rain",
  1246: "heavy_rain",
  1249: "sleet",
  1252: "sleet",
  1255: "snow",
  1258: "snow",
  1261: "hail",
  1264: "hail",
  1273: "thunderstorm",
  1276: "thunderstorm",
  1279: "thunderstorm",
  1282: "thunderstorm"
});

interface NormalizationContext {
  readonly target: WeatherPoint;
  readonly forecastDays: number;
  readonly fetchedAt: Date;
}

interface NormalizedDay {
  readonly daily: DailyWeatherForecast;
  readonly hourly: readonly HourlyWeatherForecast[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw weatherSchemaError();
  }
  return value;
}

function requiredArray(record: Record<string, unknown>, key: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw weatherSchemaError();
  }
  return value;
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw weatherSchemaError();
  }
  return Object.is(value, -0) ? 0 : value;
}

function requiredNumber(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number
): number {
  return boundedNumber(record[key], minimum, maximum);
}

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number
): number | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  return boundedNumber(value, minimum, maximum);
}

function requiredInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number
): number {
  const value = requiredNumber(record, key, minimum, maximum);
  if (!Number.isInteger(value)) {
    throw weatherSchemaError();
  }
  return value;
}

function epochToIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1_000).toISOString();
}

function addSeconds(isoTimestamp: string, seconds: number): string {
  return new Date(Date.parse(isoTimestamp) + seconds * 1_000).toISOString();
}

function expiresAt(fetchedAt: Date, lifetimeMilliseconds: number): string {
  return new Date(fetchedAt.getTime() + lifetimeMilliseconds).toISOString();
}

function conditionCode(record: Record<string, unknown>): WeatherConditionCode {
  const condition = requiredRecord(record, "condition");
  const providerCode = requiredInteger(condition, "code", 1_000, 9_999);
  return WEATHERAPI_CONDITION_CODES[providerCode] ?? "unknown";
}

function optionalWindSpeed(record: Record<string, unknown>, key: string): number | null {
  const value = optionalNumber(record, key, 0, 500);
  return value === null ? null : kilometersPerHourToMetersPerSecond(value);
}

function optionalVisibility(record: Record<string, unknown>, key: string): number | null {
  const value = optionalNumber(record, key, 0, 1_000);
  return value === null ? null : kilometersToMeters(value);
}

function maximumNullable(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return Math.max(left, right);
}

function weatherQuality(
  fields: readonly (readonly [NormalizedWeatherField, number | string | null])[]
): WeatherQuality {
  const missingFields = fields
    .filter(([, value]) => value === null)
    .map(([field]) => field);
  return {
    state: missingFields.length === 0 ? "complete" : "partial",
    missingFields
  };
}

function normalizeCurrent(
  current: Record<string, unknown>,
  fetchedAt: Date
): CurrentWeatherObservation {
  const observedEpoch = requiredInteger(
    current,
    "last_updated_epoch",
    MIN_WEATHER_EPOCH_SECONDS,
    MAX_WEATHER_EPOCH_SECONDS
  );

  const observedAt = epochToIso(observedEpoch);
  const temperatureCelsius = requiredNumber(current, "temp_c", -150, 100);
  const apparentTemperatureCelsius = optionalNumber(current, "feelslike_c", -150, 150);
  const precipitationMillimetres = optionalNumber(current, "precip_mm", 0, 10_000);
  const windSpeedMetresPerSecond = optionalWindSpeed(current, "wind_kph");
  const windGustMetresPerSecond = optionalWindSpeed(current, "gust_kph");
  const windDirectionDegrees = optionalNumber(current, "wind_degree", 0, 360);
  const pressureHectopascals = optionalNumber(current, "pressure_mb", 0, 2_000);
  const relativeHumidityPercent = optionalNumber(current, "humidity", 0, 100);
  const cloudCoverPercent = optionalNumber(current, "cloud", 0, 100);
  const visibilityMetres = optionalVisibility(current, "vis_km");
  const uvIndex = optionalNumber(current, "uv", 0, 100);
  const normalizedConditionCode = conditionCode(current);

  return {
    kind: "observation",
    observedAt,
    validInterval: { from: observedAt, to: observedAt },
    quality: weatherQuality([
      ["temperatureCelsius", temperatureCelsius],
      ["apparentTemperatureCelsius", apparentTemperatureCelsius],
      ["relativeHumidityPercent", relativeHumidityPercent],
      ["windSpeedMetresPerSecond", windSpeedMetresPerSecond],
      ["windGustMetresPerSecond", windGustMetresPerSecond],
      ["windDirectionDegrees", windDirectionDegrees],
      ["precipitationMillimetres", precipitationMillimetres],
      ["pressureHectopascals", pressureHectopascals],
      ["visibilityMetres", visibilityMetres],
      ["uvIndex", uvIndex],
      ["cloudCoverPercent", cloudCoverPercent],
      ["conditionCode", normalizedConditionCode]
    ]),
    temperatureCelsius,
    apparentTemperatureCelsius,
    relativeHumidityPercent,
    windSpeedMetresPerSecond,
    windGustMetresPerSecond,
    windDirectionDegrees,
    precipitationMillimetres,
    pressureHectopascals,
    visibilityMetres,
    uvIndex,
    cloudCoverPercent,
    conditionCode: normalizedConditionCode,
    providerIssuedAt: null,
    expiresAt: expiresAt(fetchedAt, CURRENT_RETENTION_MILLISECONDS)
  };
}

function normalizeHour(
  hour: Record<string, unknown>,
  fetchedAt: Date
): HourlyWeatherForecast {
  const validEpoch = requiredInteger(
    hour,
    "time_epoch",
    MIN_WEATHER_EPOCH_SECONDS,
    MAX_WEATHER_EPOCH_SECONDS
  );
  const validFrom = epochToIso(validEpoch);
  const rainProbability = optionalNumber(hour, "chance_of_rain", 0, 100);
  const snowProbability = optionalNumber(hour, "chance_of_snow", 0, 100);
  const temperatureCelsius = requiredNumber(hour, "temp_c", -150, 100);
  const apparentTemperatureCelsius = optionalNumber(hour, "feelslike_c", -150, 150);
  const relativeHumidityPercent = optionalNumber(hour, "humidity", 0, 100);
  const windSpeedMetresPerSecond = optionalWindSpeed(hour, "wind_kph");
  const windGustMetresPerSecond = optionalWindSpeed(hour, "gust_kph");
  const windDirectionDegrees = optionalNumber(hour, "wind_degree", 0, 360);
  const precipitationMillimetres = optionalNumber(hour, "precip_mm", 0, 10_000);
  const pressureHectopascals = optionalNumber(hour, "pressure_mb", 0, 2_000);
  const visibilityMetres = optionalVisibility(hour, "vis_km");
  const uvIndex = optionalNumber(hour, "uv", 0, 100);
  const cloudCoverPercent = optionalNumber(hour, "cloud", 0, 100);
  const normalizedConditionCode = conditionCode(hour);
  const precipitationProbabilityPercent = maximumNullable(rainProbability, snowProbability);

  return {
    kind: "forecast",
    granularity: "hour",
    validInterval: { from: validFrom, to: addSeconds(validFrom, 60 * 60) },
    quality: weatherQuality([
      ["temperatureCelsius", temperatureCelsius],
      ["apparentTemperatureCelsius", apparentTemperatureCelsius],
      ["relativeHumidityPercent", relativeHumidityPercent],
      ["windSpeedMetresPerSecond", windSpeedMetresPerSecond],
      ["windGustMetresPerSecond", windGustMetresPerSecond],
      ["windDirectionDegrees", windDirectionDegrees],
      ["precipitationMillimetres", precipitationMillimetres],
      ["pressureHectopascals", pressureHectopascals],
      ["visibilityMetres", visibilityMetres],
      ["uvIndex", uvIndex],
      ["cloudCoverPercent", cloudCoverPercent],
      ["conditionCode", normalizedConditionCode],
      ["precipitationProbabilityPercent", precipitationProbabilityPercent]
    ]),
    temperatureCelsius,
    apparentTemperatureCelsius,
    relativeHumidityPercent,
    windSpeedMetresPerSecond,
    windGustMetresPerSecond,
    windDirectionDegrees,
    precipitationMillimetres,
    pressureHectopascals,
    visibilityMetres,
    uvIndex,
    cloudCoverPercent,
    conditionCode: normalizedConditionCode,
    precipitationProbabilityPercent,
    providerIssuedAt: null,
    expiresAt: expiresAt(fetchedAt, FORECAST_RETENTION_MILLISECONDS)
  };
}

function normalizeDay(
  value: unknown,
  fetchedAt: Date
): NormalizedDay {
  if (!isRecord(value)) {
    throw weatherSchemaError();
  }

  const dateEpoch = requiredInteger(
    value,
    "date_epoch",
    MIN_WEATHER_EPOCH_SECONDS,
    MAX_WEATHER_EPOCH_SECONDS
  );
  const validFrom = epochToIso(dateEpoch);
  const validTo = addSeconds(validFrom, 24 * 60 * 60);
  const day = requiredRecord(value, "day");
  const hourValues = requiredArray(value, "hour");
  if (hourValues.length < 1 || hourValues.length > 24) {
    throw weatherSchemaError();
  }

  const hourly = hourValues
    .map((hour) => {
      if (!isRecord(hour)) {
        throw weatherSchemaError();
      }
      return normalizeHour(hour, fetchedAt);
    })
    .filter((hour) => (
      hour.validInterval.from >= validFrom && hour.validInterval.from < validTo
    ));
  if (hourly.length < 1) {
    throw weatherSchemaError();
  }
  const rainProbability = optionalNumber(day, "daily_chance_of_rain", 0, 100);
  const snowProbability = optionalNumber(day, "daily_chance_of_snow", 0, 100);
  const minimumTemperatureCelsius = requiredNumber(day, "mintemp_c", -150, 100);
  const maximumTemperatureCelsius = requiredNumber(day, "maxtemp_c", -150, 100);
  const averageTemperatureCelsius = requiredNumber(day, "avgtemp_c", -150, 100);
  if (
    minimumTemperatureCelsius > averageTemperatureCelsius ||
    averageTemperatureCelsius > maximumTemperatureCelsius
  ) {
    throw weatherSchemaError();
  }
  const precipitationMillimetres = optionalNumber(day, "totalprecip_mm", 0, 100_000);
  const maximumPrecipitationProbabilityPercent = maximumNullable(rainProbability, snowProbability);
  const maximumWindSpeedMetresPerSecond = optionalWindSpeed(day, "maxwind_kph");
  const averageRelativeHumidityPercent = optionalNumber(day, "avghumidity", 0, 100);
  optionalVisibility(day, "avgvis_km");
  optionalNumber(day, "uv", 0, 100);
  const normalizedConditionCode = conditionCode(day);

  return {
    daily: {
      kind: "forecast",
      granularity: "day",
      date: validFrom.slice(0, 10),
      validInterval: { from: validFrom, to: validTo },
      quality: weatherQuality([
        ["minimumTemperatureCelsius", minimumTemperatureCelsius],
        ["maximumTemperatureCelsius", maximumTemperatureCelsius],
        ["precipitationMillimetres", precipitationMillimetres],
        ["maximumPrecipitationProbabilityPercent", maximumPrecipitationProbabilityPercent],
        ["maximumWindSpeedMetresPerSecond", maximumWindSpeedMetresPerSecond],
        ["averageRelativeHumidityPercent", averageRelativeHumidityPercent],
        ["conditionCode", normalizedConditionCode]
      ]),
      minimumTemperatureCelsius,
      maximumTemperatureCelsius,
      precipitationMillimetres,
      maximumPrecipitationProbabilityPercent,
      maximumWindSpeedMetresPerSecond,
      averageRelativeHumidityPercent,
      conditionCode: normalizedConditionCode,
      providerIssuedAt: null,
      expiresAt: expiresAt(fetchedAt, FORECAST_RETENTION_MILLISECONDS)
    },
    hourly
  };
}

function ensureUniqueAscendingTimestamps(
  timestamps: readonly string[]
): void {
  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];
    if (previous === undefined || current === undefined || current <= previous) {
      throw weatherSchemaError();
    }
  }
}

function temporalCoverage<T>(
  values: readonly T[],
  validFrom: (value: T) => string,
  validTo: (value: T) => string
): { readonly available: boolean; readonly records: number; readonly validFrom: string | null; readonly validTo: string | null } {
  const first = values[0];
  const last = values[values.length - 1];
  return {
    available: values.length > 0,
    records: values.length,
    validFrom: first === undefined ? null : validFrom(first),
    validTo: last === undefined ? null : validTo(last)
  };
}

export function kilometersPerHourToMetersPerSecond(kilometersPerHour: number): number {
  if (!Number.isFinite(kilometersPerHour) || kilometersPerHour < 0) {
    throw new RangeError("Wind speed must be a finite non-negative number.");
  }
  return kilometersPerHour / 3.6;
}

export function kilometersToMeters(kilometers: number): number {
  if (!Number.isFinite(kilometers) || kilometers < 0) {
    throw new RangeError("Distance must be a finite non-negative number.");
  }
  return kilometers * 1_000;
}

export function normalizeWeatherApiResponse(
  value: unknown,
  context: NormalizationContext
): NormalizedWeatherPayload {
  if (
    !Number.isFinite(context.target.latitude) ||
    context.target.latitude < -90 ||
    context.target.latitude > 90 ||
    !Number.isFinite(context.target.longitude) ||
    context.target.longitude < -180 ||
    context.target.longitude > 180 ||
    !Number.isInteger(context.forecastDays) ||
    context.forecastDays < 1 ||
    context.forecastDays > 3 ||
    !Number.isFinite(context.fetchedAt.getTime())
  ) {
    throw new WeatherProviderError(
      "WEATHER_PROVIDER_REQUEST_INVALID",
      false,
      "Weather normalization context is invalid."
    );
  }

  if (!isRecord(value)) {
    throw weatherSchemaError();
  }

  const location = requiredRecord(value, "location");
  requiredNumber(location, "lat", -90, 90);
  requiredNumber(location, "lon", -180, 180);
  const currentRecord = requiredRecord(value, "current");
  const forecast = requiredRecord(value, "forecast");
  const dayValues = requiredArray(forecast, "forecastday");
  if (dayValues.length < 1 || dayValues.length > context.forecastDays) {
    throw weatherSchemaError();
  }

  const normalizedDays = dayValues.map((day) => normalizeDay(day, context.fetchedAt));
  const daily = normalizedDays.map((day) => day.daily)
    .sort((left, right) => left.validInterval.from.localeCompare(right.validInterval.from));
  const hourly = normalizedDays.flatMap((day) => day.hourly)
    .sort((left, right) => left.validInterval.from.localeCompare(right.validInterval.from));
  ensureUniqueAscendingTimestamps(daily.map((day) => day.validInterval.from));
  ensureUniqueAscendingTimestamps(hourly.map((hour) => hour.validInterval.from));

  const current = normalizeCurrent(currentRecord, context.fetchedAt);
  const hourlyCoverage = temporalCoverage(
    hourly,
    (hour) => hour.validInterval.from,
    (hour) => hour.validInterval.to
  );
  const dailyCoverage = temporalCoverage(
    daily,
    (day) => day.validInterval.from,
    (day) => day.validInterval.to
  );
  const capabilities: WeatherCapabilities = {
    current: {
      available: true,
      observedAt: current.observedAt
    },
    hourly: {
      ...hourlyCoverage,
      intervalMinutes: 60
    },
    daily: {
      ...dailyCoverage,
      intervalDays: 1
    },
    operationalHorizonHours: 72,
    day4To7Outlook: false
  };
  const target = {
    latitude: Object.is(context.target.latitude, -0) ? 0 : context.target.latitude,
    longitude: Object.is(context.target.longitude, -0) ? 0 : context.target.longitude
  };
  const normalizedPayload = {
    schemaVersion: "weather.v1",
    source: {
      provider: WEATHERAPI_PROVIDER_ID,
      attribution: WEATHERAPI_ATTRIBUTION,
      parserVersion: WEATHERAPI_PARSER_VERSION
    },
    target,
    providerIssuedAt: null,
    fetchedAt: context.fetchedAt.toISOString(),
    units: WEATHER_UNITS,
    current,
    hourly,
    daily,
    capabilities
  } as const;

  return {
    ...normalizedPayload,
    normalizedPayloadChecksumSha256: calculateNormalizedPayloadChecksum(normalizedPayload)
  };
}
