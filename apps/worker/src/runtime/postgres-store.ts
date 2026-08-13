import type {
  ClaimedWeatherRun,
  WeatherPersistenceBundle,
  WeatherPersistenceResult,
  WeatherRequestKind,
  WeatherRetryResult,
  WeatherRunCompletionStatus,
  WeatherRuntimeStore
} from "./types.js";

export interface SqlQueryResult<Row> {
  readonly rows: readonly Row[];
}

export interface WeatherRuntimeSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<SqlQueryResult<Row>>;
  end?(): Promise<void>;
}

interface ClaimRow extends Record<string, unknown> {
  run_id: string;
  provider_id: string;
  provider_key: string;
  provider_base_url: string;
  credential_reference: string;
  request_kind: string;
  target_location_id: string | null;
  target_longitude: number;
  target_latitude: number;
  parser_version: string;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
  lease_expires_at: Date | string;
  sanitized_metadata: Record<string, unknown> | null;
}

interface PersistenceRow extends Record<string, unknown> {
  observations_inserted: number;
  observations_existing: number;
  forecasts_inserted: number;
  forecasts_existing: number;
}

interface RetryRow extends Record<string, unknown> {
  run_status: string;
  available_at: Date | string;
  dead_lettered_at: Date | string | null;
}

const REQUEST_KINDS = new Set<WeatherRequestKind>([
  "current",
  "hourly",
  "daily",
  "bundle",
  "capability_probe"
]);

function runtimeDataError(): TypeError {
  return new TypeError("Weather runtime store returned an invalid result.");
}

function dateValue(value: unknown): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw runtimeDataError();
  }
  return date;
}

function nullableDateValue(value: unknown): Date | null {
  return value === null ? null : dateValue(value);
}

function countValue(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw runtimeDataError();
  }
  return count;
}

function mapClaim(row: ClaimRow): ClaimedWeatherRun {
  if (
    typeof row.run_id !== "string" ||
    typeof row.provider_id !== "string" ||
    typeof row.provider_key !== "string" ||
    typeof row.provider_base_url !== "string" ||
    typeof row.credential_reference !== "string" ||
    !REQUEST_KINDS.has(row.request_kind as WeatherRequestKind) ||
    (row.target_location_id !== null && typeof row.target_location_id !== "string") ||
    typeof row.parser_version !== "string" ||
    typeof row.lease_token !== "string"
  ) {
    throw runtimeDataError();
  }
  const targetLongitude = Number(row.target_longitude);
  const targetLatitude = Number(row.target_latitude);
  const attemptCount = countValue(row.attempt_count);
  const maxAttempts = countValue(row.max_attempts);
  if (
    !Number.isFinite(targetLongitude) || targetLongitude < -180 || targetLongitude > 180 ||
    !Number.isFinite(targetLatitude) || targetLatitude < -90 || targetLatitude > 90 ||
    attemptCount < 1 || maxAttempts < 1 || attemptCount > maxAttempts ||
    (row.sanitized_metadata !== null && (
      typeof row.sanitized_metadata !== "object" || Array.isArray(row.sanitized_metadata)
    ))
  ) {
    throw runtimeDataError();
  }
  return {
    runId: row.run_id,
    providerId: row.provider_id,
    providerKey: row.provider_key,
    providerBaseUrl: row.provider_base_url,
    credentialReference: row.credential_reference,
    requestKind: row.request_kind as WeatherRequestKind,
    targetLocationId: row.target_location_id,
    targetLongitude,
    targetLatitude,
    parserVersion: row.parser_version,
    attemptCount,
    maxAttempts,
    leaseToken: row.lease_token,
    leaseExpiresAt: dateValue(row.lease_expires_at),
    sanitizedMetadata: row.sanitized_metadata
  };
}

function intervalValue(milliseconds: number): string {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 5_000 || milliseconds > 15 * 60_000) {
    throw new RangeError("Weather runtime lease duration is invalid.");
  }
  return `${milliseconds} milliseconds`;
}

export class PostgresWeatherRuntimeStore implements WeatherRuntimeStore {
  constructor(private readonly client: WeatherRuntimeSqlClient) {}

  async claim(workerId: string, leaseDurationMilliseconds: number): Promise<ClaimedWeatherRun | null> {
    const result = await this.client.query<ClaimRow>(
      "SELECT * FROM app_weather.claim_weather_run($1::text, $2::interval)",
      [workerId, intervalValue(leaseDurationMilliseconds)]
    );
    const row = result.rows[0];
    return row === undefined ? null : mapClaim(row);
  }

  async heartbeat(
    runId: string,
    leaseToken: string,
    workerId: string,
    leaseDurationMilliseconds: number
  ): Promise<Date> {
    const result = await this.client.query<{ lease_expires_at: Date | string }>(
      `SELECT app_weather.heartbeat_weather_run(
         $1::uuid, $2::uuid, $3::text, $4::interval
       ) AS lease_expires_at`,
      [runId, leaseToken, workerId, intervalValue(leaseDurationMilliseconds)]
    );
    const row = result.rows[0];
    if (row === undefined) throw runtimeDataError();
    return dateValue(row.lease_expires_at);
  }

  async persist(
    runId: string,
    leaseToken: string,
    bundle: WeatherPersistenceBundle
  ): Promise<WeatherPersistenceResult> {
    const result = await this.client.query<PersistenceRow>(
      `SELECT * FROM app_weather.persist_weather_bundle(
         $1::uuid, $2::uuid, $3::jsonb, $4::jsonb
       )`,
      [runId, leaseToken, JSON.stringify(bundle.observations), JSON.stringify(bundle.forecasts)]
    );
    const row = result.rows[0];
    if (row === undefined) throw runtimeDataError();
    return {
      observationsInserted: countValue(row.observations_inserted),
      observationsExisting: countValue(row.observations_existing),
      forecastsInserted: countValue(row.forecasts_inserted),
      forecastsExisting: countValue(row.forecasts_existing)
    };
  }

  async complete(
    runId: string,
    leaseToken: string,
    status: WeatherRunCompletionStatus,
    recordsReceived: number,
    recordsWritten: number,
    errorCode: string | null,
    errorMessage: string | null
  ): Promise<WeatherRunCompletionStatus> {
    const result = await this.client.query<{ run_status: string }>(
      `SELECT app_weather.complete_weather_run(
         $1::uuid, $2::uuid, $3::text, $4::integer, $5::integer, $6::text, $7::text
       ) AS run_status`,
      [runId, leaseToken, status, recordsReceived, recordsWritten, errorCode, errorMessage]
    );
    const returnedStatus = result.rows[0]?.run_status;
    if (returnedStatus !== "succeeded" && returnedStatus !== "partial") {
      throw runtimeDataError();
    }
    return returnedStatus;
  }

  async retry(
    runId: string,
    leaseToken: string,
    retryAt: Date,
    errorCode: string,
    errorMessage: string | null
  ): Promise<WeatherRetryResult> {
    const result = await this.client.query<RetryRow>(
      `SELECT * FROM app_weather.retry_weather_run(
         $1::uuid, $2::uuid, $3::timestamptz, $4::text, $5::text
       )`,
      [runId, leaseToken, retryAt, errorCode, errorMessage]
    );
    const row = result.rows[0];
    if (row === undefined || (row.run_status !== "retry_wait" && row.run_status !== "dead_letter")) {
      throw runtimeDataError();
    }
    return {
      runStatus: row.run_status,
      availableAt: dateValue(row.available_at),
      deadLetteredAt: nullableDateValue(row.dead_lettered_at)
    };
  }

  async fail(
    runId: string,
    leaseToken: string,
    errorCode: string,
    errorMessage: string | null
  ): Promise<"failed"> {
    const result = await this.client.query<{ run_status: string }>(
      `SELECT app_weather.fail_weather_run(
         $1::uuid, $2::uuid, $3::text, $4::text
       ) AS run_status`,
      [runId, leaseToken, errorCode, errorMessage]
    );
    if (result.rows[0]?.run_status !== "failed") {
      throw runtimeDataError();
    }
    return "failed";
  }

  async close(): Promise<void> {
    await this.client.end?.();
  }
}
