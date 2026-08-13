export type WeatherProviderErrorCode =
  | "WEATHER_PROVIDER_AUTH_FAILED"
  | "WEATHER_PROVIDER_CONFIGURATION_INVALID"
  | "WEATHER_PROVIDER_QUOTA_EXHAUSTED"
  | "WEATHER_PROVIDER_RATE_LIMITED"
  | "WEATHER_PROVIDER_REQUEST_ABORTED"
  | "WEATHER_PROVIDER_REQUEST_INVALID"
  | "WEATHER_PROVIDER_RESPONSE_REJECTED"
  | "WEATHER_PROVIDER_SCHEMA_INVALID"
  | "WEATHER_PROVIDER_TIMEOUT"
  | "WEATHER_PROVIDER_UNAVAILABLE";

export interface WeatherProviderErrorOptions {
  readonly statusCode?: number;
  readonly providerCode?: number;
}

export class WeatherProviderError extends Error {
  readonly statusCode: number | null;
  readonly providerCode: number | null;

  constructor(
    readonly code: WeatherProviderErrorCode,
    readonly retryable: boolean,
    message: string,
    options: WeatherProviderErrorOptions = {}
  ) {
    super(message);
    this.name = "WeatherProviderError";
    this.statusCode = options.statusCode ?? null;
    this.providerCode = options.providerCode ?? null;
  }

  toJSON(): Readonly<Record<string, boolean | number | string | null>> {
    return {
      name: this.name,
      code: this.code,
      retryable: this.retryable,
      statusCode: this.statusCode,
      providerCode: this.providerCode,
      message: this.message
    };
  }
}

export function weatherSchemaError(): WeatherProviderError {
  return new WeatherProviderError(
    "WEATHER_PROVIDER_SCHEMA_INVALID",
    false,
    "Weather provider response did not match the expected schema."
  );
}
