import type { Pool } from "pg";
import type { Coordinates, ReportWeatherEvidence } from "@vietnam-weather/contracts";

type RainSource = NonNullable<ReportWeatherEvidence["rain_source"]>;
interface RainRow {
  readonly rain_mm_per_hour: number | null;
  readonly precipitation_probability_percent: number | null;
  readonly source: string;
  readonly source_time: Date | string | null;
  readonly fetched_at: Date | string;
  readonly valid_from: Date | string;
  readonly valid_to: Date | string;
}

/** Use the same sampled position and provider; a current amount has no defined accumulation period. */
export async function readHourlyRain(pool: Pool, coordinates: Coordinates, provider: string, target: Date, now: Date):
Promise<{ readonly value: number | null; readonly probability: number | null; readonly source?: RainSource; readonly failed?: true }> {
  try {
    const result = await pool.query<RainRow>(`
      SELECT (precipitation_mm / NULLIF(EXTRACT(EPOCH FROM (valid_to-valid_from))/3600, 0))::float AS rain_mm_per_hour,
        precipitation_probability_percent::float AS precipitation_probability_percent,
        provider_id::text AS source, provider_issued_at AS source_time, fetched_at, valid_from, valid_to
      FROM public.weather_forecasts
      WHERE horizon_kind = 'hourly' AND valid_from <= $3 AND valid_to > $3
        AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,1)
        AND provider_id::text = $5 AND status = 'valid' AND expires_at > $4
        AND fetched_at <= $4 AND fetched_at >= $4::timestamptz - INTERVAL '24 hours'
        AND (provider_issued_at IS NULL OR (provider_issued_at <= $4
          AND provider_issued_at >= $4::timestamptz - INTERVAL '24 hours'))
        AND (precipitation_mm IS NOT NULL OR precipitation_probability_percent IS NOT NULL)
      ORDER BY fetched_at DESC LIMIT 1`,
    [coordinates.longitude, coordinates.latitude, target.toISOString(), now.toISOString(), provider]);
    const row = result.rows[0];
    if (!row) return { value: null, probability: null };
    const value = row.rain_mm_per_hour != null && Number.isFinite(row.rain_mm_per_hour) && row.rain_mm_per_hour >= 0
      ? row.rain_mm_per_hour : null;
    const probability = row.precipitation_probability_percent != null && Number.isFinite(row.precipitation_probability_percent)
      && row.precipitation_probability_percent >= 0 && row.precipitation_probability_percent <= 100
      ? row.precipitation_probability_percent : null;
    if (value === null && probability === null) return { value, probability };
    return { value, probability, source: { kind: "hourly_forecast", source: row.source,
      source_time: row.source_time ? new Date(row.source_time).toISOString() : null,
      fetched_at: new Date(row.fetched_at).toISOString(), valid_from: new Date(row.valid_from).toISOString(),
      valid_to: new Date(row.valid_to).toISOString() } };
  } catch (error) {
    if (error instanceof Error) return { value: null, probability: null, failed: true };
    throw error;
  }
}
