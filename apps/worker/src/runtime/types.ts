import type { WeatherProviderAdapter } from "../weather/index.js";

export type WeatherRequestKind =
  | "current"
  | "hourly"
  | "daily"
  | "bundle"
  | "capability_probe";

export type WeatherRunCompletionStatus = "succeeded" | "partial";
export type WeatherRunRetryStatus = "retry_wait" | "dead_letter";
export type WeatherRunTerminalStatus = WeatherRunCompletionStatus | WeatherRunRetryStatus | "failed";

export interface ClaimedWeatherRun {
  readonly runId: string;
  readonly providerId: string;
  readonly providerKey: string;
  readonly providerBaseUrl: string;
  readonly credentialReference: string;
  readonly requestKind: WeatherRequestKind;
  readonly targetLocationId: string | null;
  readonly targetLongitude: number;
  readonly targetLatitude: number;
  readonly parserVersion: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly leaseToken: string;
  readonly leaseExpiresAt: Date;
  readonly sanitizedMetadata: Readonly<Record<string, unknown>> | null;
}

export interface WeatherObservationSqlRecord {
  readonly idempotency_key: string;
  readonly normalized_payload_checksum_sha256: string;
  readonly provider_record_id: string | null;
  readonly observed_at: string;
  readonly fetched_at: string;
  readonly expires_at: string;
  readonly condition_code: string | null;
  readonly temperature_celsius: number | null;
  readonly feels_like_celsius: number | null;
  readonly humidity_percent: number | null;
  readonly precipitation_mm: number | null;
  readonly wind_speed_mps: number | null;
  readonly wind_gust_mps: number | null;
  readonly wind_direction_degrees: number | null;
  readonly pressure_hpa: number | null;
  readonly visibility_meters: number | null;
  readonly uv_index: number | null;
  readonly cloud_cover_percent: number | null;
  readonly source_quality: "reported";
  readonly status: "valid";
}

export interface WeatherForecastSqlRecord {
  readonly idempotency_key: string;
  readonly normalized_payload_checksum_sha256: string;
  readonly provider_record_id: string | null;
  readonly horizon_kind: "hourly" | "daily";
  readonly provider_issued_at: string | null;
  readonly valid_from: string;
  readonly valid_to: string;
  readonly fetched_at: string;
  readonly expires_at: string;
  readonly condition_code: string | null;
  readonly temperature_celsius: number | null;
  readonly temperature_min_celsius: number | null;
  readonly temperature_max_celsius: number | null;
  readonly precipitation_mm: number | null;
  readonly precipitation_probability_percent: number | null;
  readonly wind_speed_mps: number | null;
  readonly wind_gust_mps: number | null;
  readonly feels_like_celsius: number | null;
  readonly humidity_percent: number | null;
  readonly wind_direction_degrees: number | null;
  readonly pressure_hpa: number | null;
  readonly visibility_meters: number | null;
  readonly uv_index: number | null;
  readonly cloud_cover_percent: number | null;
  readonly confidence_percent: number | null;
  readonly status: "valid";
}

export interface WeatherPersistenceBundle {
  readonly observations: readonly WeatherObservationSqlRecord[];
  readonly forecasts: readonly WeatherForecastSqlRecord[];
  readonly partial: boolean;
}

export interface WeatherPersistenceResult {
  readonly observationsInserted: number;
  readonly observationsExisting: number;
  readonly forecastsInserted: number;
  readonly forecastsExisting: number;
}

export interface WeatherRetryResult {
  readonly runStatus: WeatherRunRetryStatus;
  readonly availableAt: Date;
  readonly deadLetteredAt: Date | null;
}

export interface WeatherRuntimeStore {
  claim(workerId: string, leaseDurationMilliseconds: number): Promise<ClaimedWeatherRun | null>;
  heartbeat(
    runId: string,
    leaseToken: string,
    workerId: string,
    leaseDurationMilliseconds: number
  ): Promise<Date>;
  persist(
    runId: string,
    leaseToken: string,
    bundle: WeatherPersistenceBundle
  ): Promise<WeatherPersistenceResult>;
  complete(
    runId: string,
    leaseToken: string,
    status: WeatherRunCompletionStatus,
    recordsReceived: number,
    recordsWritten: number,
    errorCode: string | null,
    errorMessage: string | null
  ): Promise<WeatherRunCompletionStatus>;
  retry(
    runId: string,
    leaseToken: string,
    retryAt: Date,
    errorCode: string,
    errorMessage: string | null
  ): Promise<WeatherRetryResult>;
  fail(
    runId: string,
    leaseToken: string,
    errorCode: string,
    errorMessage: string | null
  ): Promise<"failed">;
  close?(): Promise<void>;
}

export interface WeatherRuntimeSecrets {
  readonly WEATHERAPI_API_KEY: string;
}

export interface WeatherRuntimeConfig {
  readonly workerId: string;
  readonly pollIntervalMilliseconds: number;
  readonly leaseDurationMilliseconds: number;
  readonly heartbeatIntervalMilliseconds: number;
  readonly providerTimeoutMilliseconds: number;
  readonly retryBaseDelayMilliseconds: number;
  readonly retryMaximumDelayMilliseconds: number;
  readonly retryJitterRatio: number;
  readonly circuitFailureThreshold: number;
  readonly circuitResetMilliseconds: number;
  readonly forecastDays: number;
}

export interface WeatherRuntimeWakeEvent {
  readonly type: "weather_run_state_changed";
  readonly status: WeatherRunTerminalStatus;
}

export interface WeatherRuntimeWakeChannel {
  waitForWake(signal: AbortSignal): Promise<void>;
  publish?(event: WeatherRuntimeWakeEvent): Promise<void>;
  close?(): Promise<void>;
}

export interface WeatherRuntimeLogEntry {
  readonly event:
    | "weather_runtime_ready"
    | "weather_runtime_poll_failed"
    | "weather_runtime_stopped"
    | "weather_run_transitioned"
    | "weather_run_transition_failed";
  readonly status?: WeatherRunTerminalStatus;
  readonly code?: string;
}

export interface WeatherRuntimeLogger {
  info(entry: WeatherRuntimeLogEntry): void;
  error(entry: WeatherRuntimeLogEntry): void;
}

export interface WeatherAdapterFactoryOptions {
  readonly apiKey: string;
  readonly timeoutMilliseconds: number;
}

export type WeatherAdapterFactory = (
  options: WeatherAdapterFactoryOptions
) => WeatherProviderAdapter;

export type WeatherRuntimeLifecycleState =
  | "stopped"
  | "starting"
  | "ready"
  | "degraded"
  | "stopping";

export interface WeatherRuntimeReadiness {
  readonly state: WeatherRuntimeLifecycleState;
  readonly ready: boolean;
  readonly acceptingWork: boolean;
  readonly activeRun: boolean;
  readonly consecutivePollFailures: number;
  readonly lastSuccessfulPollAt: Date | null;
}
