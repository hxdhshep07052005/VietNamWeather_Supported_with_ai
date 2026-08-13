import type {
  Attribution,
  CurrentWeatherValue,
  DailyWeatherValue,
  HourlyWeatherValue,
  WeatherUnits
} from "@vietnam-weather/contracts";

export type { WeatherConditionCode } from "@vietnam-weather/contracts";

export interface WeatherPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface WeatherProviderRequest {
  readonly target: WeatherPoint;
  readonly forecastDays: number;
  readonly signal?: AbortSignal;
}

export interface WeatherProviderAdapter {
  readonly providerId: string;
  getWeather(request: WeatherProviderRequest): Promise<NormalizedWeatherPayload>;
}

export const WEATHER_UNITS: WeatherUnits = Object.freeze({
  temperature: "celsius",
  windSpeed: "metres_per_second",
  precipitation: "millimetres",
  pressure: "hectopascals",
  visibility: "metres",
  relativeHumidity: "percent",
  probability: "percent",
  direction: "degrees"
});

export interface NormalizedWeatherSource {
  readonly provider: string;
  readonly attribution: Attribution;
  readonly parserVersion: string;
}

export interface CurrentWeatherObservation extends CurrentWeatherValue {
  readonly providerIssuedAt: string | null;
  readonly expiresAt: string;
}

export interface HourlyWeatherForecast extends HourlyWeatherValue {
  readonly granularity: "hour";
  readonly providerIssuedAt: string | null;
  readonly expiresAt: string;
}

export interface DailyWeatherForecast extends DailyWeatherValue {
  readonly granularity: "day";
  readonly providerIssuedAt: string | null;
  readonly expiresAt: string;
}

export interface WeatherTemporalCoverage {
  readonly available: boolean;
  readonly records: number;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

export interface WeatherCapabilities {
  readonly current: {
    readonly available: boolean;
    readonly observedAt: string | null;
  };
  readonly hourly: WeatherTemporalCoverage & {
    readonly intervalMinutes: 60;
  };
  readonly daily: WeatherTemporalCoverage & {
    readonly intervalDays: 1;
  };
  readonly operationalHorizonHours: 72;
  readonly day4To7Outlook: false;
}

export interface NormalizedWeatherPayload {
  readonly schemaVersion: "weather.v1";
  readonly source: NormalizedWeatherSource;
  readonly target: WeatherPoint;
  readonly providerIssuedAt: string | null;
  readonly fetchedAt: string;
  readonly units: WeatherUnits;
  readonly current: CurrentWeatherObservation;
  readonly hourly: readonly HourlyWeatherForecast[];
  readonly daily: readonly DailyWeatherForecast[];
  readonly capabilities: WeatherCapabilities;
  readonly normalizedPayloadChecksumSha256: string;
}
