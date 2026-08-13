import type { Pool } from "pg";

import type { WeatherQueryTarget } from "@vietnam-weather/contracts";

export interface WeatherEnqueueResult {
  readonly runId: string;
  readonly status: string;
  readonly inserted: boolean;
}

export interface WeatherStore {
  capabilities(): Promise<unknown>;
  fetch(target: WeatherQueryTarget, asOf: Date): Promise<unknown>;
  enqueue(
    target: WeatherQueryTarget,
    requestKind: "current" | "hourly" | "daily" | "bundle",
    idempotencyKey: string,
    availableAt: Date
  ): Promise<WeatherEnqueueResult>;
}

function targetParameters(target: WeatherQueryTarget): readonly [string | null, number | null, number | null] {
  if ("locationId" in target) return [target.locationId, null, null];
  return [null, target.coordinates.longitude, target.coordinates.latitude];
}

export class PostgresWeatherStore implements WeatherStore {
  constructor(
    private readonly pool: Pool,
    private readonly providerKey: string,
    private readonly parserVersion: string
  ) {}

  async capabilities(): Promise<unknown> {
    const result = await this.pool.query<{ document: unknown }>(
      "SELECT app_weather.fetch_weather_capabilities($1::text) AS document",
      [this.providerKey]
    );
    return result.rows[0]?.document;
  }

  async fetch(target: WeatherQueryTarget, asOf: Date): Promise<unknown> {
    const [locationId, longitude, latitude] = targetParameters(target);
    const result = await this.pool.query<{ document: unknown }>(
      `SELECT app_weather.fetch_weather_bundle_public(
         $1::uuid, $2::double precision, $3::double precision, $4::timestamptz
       ) AS document`,
      [locationId, longitude, latitude, asOf]
    );
    return result.rows[0]?.document;
  }

  async enqueue(
    target: WeatherQueryTarget,
    requestKind: "current" | "hourly" | "daily" | "bundle",
    idempotencyKey: string,
    availableAt: Date
  ): Promise<WeatherEnqueueResult> {
    const [locationId, longitude, latitude] = targetParameters(target);
    const result = await this.pool.query<{
      run_id: string;
      run_status: string;
      inserted: boolean;
    }>(
      `SELECT * FROM app_weather.enqueue_weather_run_by_provider_key(
         $1::text, $2::text, $3::text, $4::text, $5::uuid,
         $6::double precision, $7::double precision, 3, $8::timestamptz,
         jsonb_build_object('request_class', 'application_api')
       )`,
      [
        this.providerKey,
        idempotencyKey,
        requestKind,
        this.parserVersion,
        locationId,
        longitude,
        latitude,
        availableAt
      ]
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Weather enqueue returned no result");
    return { runId: row.run_id, status: row.run_status, inserted: row.inserted };
  }
}

export class UnavailableWeatherStore implements WeatherStore {
  async capabilities(): Promise<never> { throw new Error("Weather store unavailable"); }
  async fetch(): Promise<never> { throw new Error("Weather store unavailable"); }
  async enqueue(): Promise<never> { throw new Error("Weather store unavailable"); }
}
