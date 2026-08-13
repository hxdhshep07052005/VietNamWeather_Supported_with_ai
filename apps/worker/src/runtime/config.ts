import type { WeatherRuntimeConfig, WeatherRuntimeSecrets } from "./types.js";

const WORKER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function environmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue?: string
): string {
  const value = environment[name] ?? defaultValue;
  if (value === undefined || value === "" || value.trim() !== value) {
    throw new Error(`Invalid or missing environment variable: ${name}`);
  }
  return value;
}

function integerValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number,
  defaultValue: number
): number {
  const value = Number(environmentValue(environment, name, String(defaultValue)));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid integer environment variable: ${name}`);
  }
  return value;
}

function ratioValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number
): number {
  const value = Number(environmentValue(environment, name, String(defaultValue)));
  if (!Number.isFinite(value) || value < 0 || value > 0.5) {
    throw new Error(`Invalid ratio environment variable: ${name}`);
  }
  return value;
}

export function parseWeatherRuntimeConfig(environment: NodeJS.ProcessEnv): WeatherRuntimeConfig {
  const workerId = environmentValue(environment, "WEATHER_WORKER_ID");
  if (!WORKER_ID_PATTERN.test(workerId)) {
    throw new Error("Invalid environment variable: WEATHER_WORKER_ID");
  }

  const leaseDurationMilliseconds = integerValue(
    environment,
    "WEATHER_WORKER_LEASE_DURATION_MS",
    5_000,
    15 * 60_000,
    60_000
  );
  const heartbeatIntervalMilliseconds = integerValue(
    environment,
    "WEATHER_WORKER_HEARTBEAT_INTERVAL_MS",
    250,
    5 * 60_000,
    20_000
  );
  if (heartbeatIntervalMilliseconds >= leaseDurationMilliseconds) {
    throw new Error("Weather heartbeat interval must be shorter than the lease duration");
  }

  const retryBaseDelayMilliseconds = integerValue(
    environment,
    "WEATHER_WORKER_RETRY_BASE_DELAY_MS",
    100,
    60 * 60_000,
    1_000
  );
  const retryMaximumDelayMilliseconds = integerValue(
    environment,
    "WEATHER_WORKER_RETRY_MAX_DELAY_MS",
    100,
    24 * 60 * 60_000,
    5 * 60_000
  );
  if (retryMaximumDelayMilliseconds < retryBaseDelayMilliseconds) {
    throw new Error("Weather retry maximum delay must not be shorter than its base delay");
  }

  return {
    workerId,
    pollIntervalMilliseconds: integerValue(
      environment,
      "WEATHER_WORKER_POLL_INTERVAL_MS",
      10,
      60_000,
      1_000
    ),
    leaseDurationMilliseconds,
    heartbeatIntervalMilliseconds,
    providerTimeoutMilliseconds: integerValue(
      environment,
      "WEATHER_PROVIDER_TIMEOUT_MS",
      1,
      60_000,
      5_000
    ),
    retryBaseDelayMilliseconds,
    retryMaximumDelayMilliseconds,
    retryJitterRatio: ratioValue(environment, "WEATHER_WORKER_RETRY_JITTER_RATIO", 0.2),
    circuitFailureThreshold: integerValue(
      environment,
      "WEATHER_PROVIDER_CIRCUIT_FAILURE_THRESHOLD",
      1,
      20,
      3
    ),
    circuitResetMilliseconds: integerValue(
      environment,
      "WEATHER_PROVIDER_CIRCUIT_RESET_MS",
      1_000,
      60 * 60_000,
      60_000
    ),
    forecastDays: integerValue(environment, "WEATHERAPI_FORECAST_DAYS", 1, 3, 3)
  };
}

export function parseWeatherRuntimeSecrets(environment: NodeJS.ProcessEnv): WeatherRuntimeSecrets {
  const apiKey = environmentValue(environment, "WEATHERAPI_API_KEY");
  if (
    apiKey.length < 8 ||
    apiKey.length > 256 ||
    Array.from(apiKey).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    throw new Error("Invalid environment variable: WEATHERAPI_API_KEY");
  }
  return { WEATHERAPI_API_KEY: apiKey };
}
