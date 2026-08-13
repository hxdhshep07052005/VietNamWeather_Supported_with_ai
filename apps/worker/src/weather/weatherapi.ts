import { WeatherProviderError, weatherSchemaError } from "./errors.js";
import { normalizeWeatherApiResponse, WEATHERAPI_PROVIDER_ID } from "./normalize.js";
import type {
  NormalizedWeatherPayload,
  WeatherProviderAdapter,
  WeatherProviderRequest
} from "./types.js";

export const WEATHERAPI_ALLOWED_ORIGIN = "https://api.weatherapi.com";
export const WEATHERAPI_FORECAST_PATH = "/v1/forecast.json";
export const WEATHERAPI_FORECAST_ENDPOINT = `${WEATHERAPI_ALLOWED_ORIGIN}${WEATHERAPI_FORECAST_PATH}`;

export interface WeatherApiAdapterOptions {
  readonly apiKey: string;
  readonly timeoutMilliseconds: number;
  readonly endpoint?: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function validateEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new WeatherProviderError(
      "WEATHER_PROVIDER_CONFIGURATION_INVALID",
      false,
      "Weather provider endpoint is invalid."
    );
  }

  if (
    url.origin !== WEATHERAPI_ALLOWED_ORIGIN ||
    url.pathname !== WEATHERAPI_FORECAST_PATH ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new WeatherProviderError(
      "WEATHER_PROVIDER_CONFIGURATION_INVALID",
      false,
      "Weather provider endpoint is not allowlisted."
    );
  }
  return url;
}

function validateOptions(options: WeatherApiAdapterOptions): void {
  if (
    typeof options.apiKey !== "string" ||
    options.apiKey.length < 8 ||
    options.apiKey.length > 256 ||
    options.apiKey.trim() !== options.apiKey ||
    hasControlCharacter(options.apiKey) ||
    !Number.isInteger(options.timeoutMilliseconds) ||
    options.timeoutMilliseconds < 1 ||
    options.timeoutMilliseconds > 60_000 ||
    (options.endpoint !== undefined && typeof options.endpoint !== "string") ||
    (options.fetch !== undefined && typeof options.fetch !== "function") ||
    (options.now !== undefined && typeof options.now !== "function")
  ) {
    throw new WeatherProviderError(
      "WEATHER_PROVIDER_CONFIGURATION_INVALID",
      false,
      "Weather provider configuration is invalid."
    );
  }
}

function validateRequest(request: WeatherProviderRequest): void {
  if (
    !Number.isFinite(request.target.latitude) ||
    request.target.latitude < -90 ||
    request.target.latitude > 90 ||
    !Number.isFinite(request.target.longitude) ||
    request.target.longitude < -180 ||
    request.target.longitude > 180 ||
    !Number.isInteger(request.forecastDays) ||
    request.forecastDays < 1 ||
    request.forecastDays > 3
  ) {
    throw new WeatherProviderError(
      "WEATHER_PROVIDER_REQUEST_INVALID",
      false,
      "Weather provider request is invalid."
    );
  }
}

function providerErrorCode(value: unknown): number | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }
  const code = value.error.code;
  return typeof code === "number" && Number.isInteger(code) && code >= 1_000 && code <= 9_999
    ? code
    : null;
}

function classifyHttpError(statusCode: number, code: number | null): WeatherProviderError {
  if (statusCode === 429) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_RATE_LIMITED",
      true,
      "Weather provider rate limited the request.",
      { statusCode, providerCode: code ?? undefined }
    );
  }
  if (statusCode === 408 || statusCode >= 500) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_UNAVAILABLE",
      true,
      "Weather provider is temporarily unavailable.",
      { statusCode, providerCode: code ?? undefined }
    );
  }
  if (code === 1_002 || code === 2_006 || code === 2_008 || code === 2_009) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_AUTH_FAILED",
      false,
      "Weather provider authentication or access failed.",
      { statusCode, providerCode: code }
    );
  }
  if (code === 2_007) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_QUOTA_EXHAUSTED",
      false,
      "Weather provider hard quota is exhausted.",
      { statusCode, providerCode: code }
    );
  }
  if (code === 1_003 || code === 1_005 || code === 1_006) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_REQUEST_INVALID",
      false,
      "Weather provider rejected the request.",
      { statusCode, providerCode: code }
    );
  }
  if (statusCode === 401 || statusCode === 403) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_AUTH_FAILED",
      false,
      "Weather provider authentication or access failed.",
      { statusCode, providerCode: code ?? undefined }
    );
  }
  return new WeatherProviderError(
    "WEATHER_PROVIDER_RESPONSE_REJECTED",
    false,
    "Weather provider returned a rejected response.",
    { statusCode, providerCode: code ?? undefined }
  );
}

export class WeatherApiAdapter implements WeatherProviderAdapter {
  readonly providerId = WEATHERAPI_PROVIDER_ID;
  readonly #apiKey: string;
  readonly #timeoutMilliseconds: number;
  readonly #endpoint: URL;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;

  constructor(options: WeatherApiAdapterOptions) {
    validateOptions(options);
    this.#apiKey = options.apiKey;
    this.#timeoutMilliseconds = options.timeoutMilliseconds;
    this.#endpoint = validateEndpoint(options.endpoint ?? WEATHERAPI_FORECAST_ENDPOINT);
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async getWeather(request: WeatherProviderRequest): Promise<NormalizedWeatherPayload> {
    validateRequest(request);
    if (request.signal?.aborted) {
      throw new WeatherProviderError(
        "WEATHER_PROVIDER_REQUEST_ABORTED",
        false,
        "Weather provider request was aborted."
      );
    }

    const requestUrl = new URL(this.#endpoint);
    requestUrl.searchParams.set("key", this.#apiKey);
    requestUrl.searchParams.set("q", `${request.target.latitude},${request.target.longitude}`);
    requestUrl.searchParams.set("days", String(request.forecastDays));
    requestUrl.searchParams.set("aqi", "no");
    requestUrl.searchParams.set("alerts", "no");
    const timeoutSignal = AbortSignal.timeout(this.#timeoutMilliseconds);
    const signal = request.signal === undefined
      ? timeoutSignal
      : AbortSignal.any([request.signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.#fetch(requestUrl, {
        method: "GET",
        headers: {
          accept: "application/json"
        },
        redirect: "error",
        signal
      });
    } catch {
      throw classifyTransportFailure(request.signal, timeoutSignal);
    }

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      if (request.signal?.aborted || timeoutSignal.aborted) {
        throw classifyTransportFailure(request.signal, timeoutSignal);
      }
      if (!response.ok) {
        throw classifyHttpError(response.status, null);
      }
      throw weatherSchemaError();
    }

    if (!response.ok) {
      throw classifyHttpError(response.status, providerErrorCode(value));
    }

    let fetchedAt: Date;
    try {
      const currentTime = this.#now();
      fetchedAt = new Date(currentTime.getTime());
      if (!Number.isFinite(fetchedAt.getTime())) {
        throw new TypeError("Invalid clock value.");
      }
    } catch {
      throw new WeatherProviderError(
        "WEATHER_PROVIDER_UNAVAILABLE",
        true,
        "Weather provider clock is unavailable."
      );
    }

    return normalizeWeatherApiResponse(value, {
      target: request.target,
      forecastDays: request.forecastDays,
      fetchedAt
    });
  }
}

function classifyTransportFailure(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal
): WeatherProviderError {
  if (callerSignal?.aborted) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_REQUEST_ABORTED",
      false,
      "Weather provider request was aborted."
    );
  }
  if (timeoutSignal.aborted) {
    return new WeatherProviderError(
      "WEATHER_PROVIDER_TIMEOUT",
      true,
      "Weather provider request timed out."
    );
  }
  return new WeatherProviderError(
    "WEATHER_PROVIDER_UNAVAILABLE",
    true,
    "Weather provider request failed."
  );
}
