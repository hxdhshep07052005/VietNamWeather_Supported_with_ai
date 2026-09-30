import { readHourlyRain } from "./hourly-rain.js";
import type { Pool } from "pg";
import type { Coordinates, ReportWeatherEvidence } from "@vietnam-weather/contracts";

export function unavailableWeather(reason: string): ReportWeatherEvidence {
  return { rain_mm_per_hour: null, gust_kmh: null, temperature_c: null, visibility_m: null,
    storm: null, official_alert_level: null, freshness: "unavailable", coverage: "unavailable",
    source: null, source_time: null, valid_from: null, valid_to: null, reasons: [reason] };
}

interface WeatherRow {
  latitude?: number; longitude?: number; distance_meters?: number;
  humidity_percent?: number | null; wind_kmh?: number | null;
  uv_index?: number | null; cloud_cover_percent?: number | null; precipitation_probability_percent?: number | null;
  fetched_at?: string | Date | null;
  feels_like_c?: number | null; pressure_hpa?: number | null; precipitation_mm?: number | null;
  temperature_c: number | null; gust_kmh: number | null; visibility_m: number | null;
  rain_mm_per_hour: number | null; condition_code: string | null;
  source: string; source_time: string | Date | null; expires_at: string | Date; status: string;
  valid_from: string | Date; valid_to: string | Date | null;
}
const iso = (value: string | Date | null) => value === null ? null : new Date(value).toISOString();

/** No provider request or fabricated fallback: read persisted, spatially/temporally matched evidence. */
export async function readWeatherEvidence(pool: Pool, coordinates: Coordinates, target: Date, now = new Date()): Promise<ReportWeatherEvidence> {
  if (!Number.isFinite(target.getTime())) return unavailableWeather("invalid_target_time");
  const forecast = target.getTime() > now.getTime();
  try {
    const result = await pool.query<WeatherRow>(forecast ? `
      SELECT ST_Y(coordinates)::float AS latitude, ST_X(coordinates)::float AS longitude,
        ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance_meters,
        temperature_celsius::float AS temperature_c, (wind_gust_mps * 3.6)::float AS gust_kmh,
        humidity_percent::float AS humidity_percent, (wind_speed_mps * 3.6)::float AS wind_kmh,
        feels_like_celsius::float AS feels_like_c, pressure_hpa::float AS pressure_hpa, precipitation_mm::float AS precipitation_mm,
        visibility_meters::float AS visibility_m, uv_index::float AS uv_index, cloud_cover_percent::float AS cloud_cover_percent,
        precipitation_probability_percent::float AS precipitation_probability_percent, fetched_at,
        (precipitation_mm / NULLIF(EXTRACT(EPOCH FROM (valid_to-valid_from))/3600, 0))::float AS rain_mm_per_hour,
        condition_code, provider_id::text AS source, provider_issued_at AS source_time,
        expires_at, status, valid_from, valid_to
      FROM public.weather_forecasts
      WHERE horizon_kind = 'hourly' AND valid_from <= $3 AND valid_to > $3
        AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,15000)
        AND status IN ('valid','stale') AND (provider_issued_at IS NULL OR provider_issued_at <= $4) AND fetched_at <= $4
      ORDER BY (status = 'valid' AND expires_at > $4 AND
        COALESCE(provider_issued_at, fetched_at) >= $4::timestamptz - INTERVAL '24 hours') DESC,
        distance_meters ASC, fetched_at DESC
      LIMIT 1` : `
      SELECT ST_Y(coordinates)::float AS latitude, ST_X(coordinates)::float AS longitude,
        ST_Distance(coordinates::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance_meters,
        temperature_celsius::float AS temperature_c, (wind_gust_mps * 3.6)::float AS gust_kmh,
        humidity_percent::float AS humidity_percent, (wind_speed_mps * 3.6)::float AS wind_kmh,
        feels_like_celsius::float AS feels_like_c, pressure_hpa::float AS pressure_hpa, precipitation_mm::float AS precipitation_mm,
        uv_index::float AS uv_index, cloud_cover_percent::float AS cloud_cover_percent,
        NULL::float AS precipitation_probability_percent, fetched_at,
        visibility_meters::float AS visibility_m, NULL::float AS rain_mm_per_hour,
        condition_code, provider_id::text AS source, observed_at AS source_time,
        expires_at, status, observed_at AS valid_from, NULL::timestamptz AS valid_to
      FROM public.weather_observations
      WHERE observed_at <= $3 AND observed_at >= $3::timestamptz - INTERVAL '180 minutes'
        AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,15000)
        AND status IN ('valid','stale') AND fetched_at <= $4
      ORDER BY (status = 'valid' AND expires_at > $4 AND
        observed_at >= $4::timestamptz - INTERVAL '180 minutes') DESC,
        distance_meters ASC, observed_at DESC, fetched_at DESC
      LIMIT 1`, [coordinates.longitude, coordinates.latitude, target.toISOString(), now.toISOString()]);
    const row = result.rows[0];
    if (!row) return { ...unavailableWeather("no_matching_weather_within_15km"), coverage: "outside" };
    const sourceTime = iso(row.source_time);
    const fetchedAt = iso(row.fetched_at ?? null);
    const freshnessTime = sourceTime ?? (forecast ? fetchedAt : null);
    const ageMinutes = freshnessTime ? (now.getTime() - new Date(freshnessTime).getTime()) / 60000 : Infinity;
    const expired = new Date(row.expires_at).getTime() <= now.getTime();
    const stale = expired || row.status !== "valid" || ageMinutes < 0 || ageMinutes > (forecast ? 1440 : 180);
    const matchedCoordinates = { latitude: row.latitude ?? coordinates.latitude, longitude: row.longitude ?? coordinates.longitude };
    const rain = forecast ? { value: row.rain_mm_per_hour, probability: row.precipitation_probability_percent ?? null,
      source: (row.rain_mm_per_hour != null || row.precipitation_probability_percent != null) && row.valid_to ? {
      kind: "hourly_forecast" as const, source: row.source, source_time: sourceTime, fetched_at: fetchedAt,
      valid_from: new Date(row.valid_from).toISOString(), valid_to: new Date(row.valid_to).toISOString(),
    } : undefined, failed: false } : await readHourlyRain(pool, matchedCoordinates, row.source, target, now);
    const rainSource = rain.value != null ? rain.source : undefined;
    const probabilitySource = rain.probability != null ? rain.source : undefined;
    return {
      matched_coordinates: matchedCoordinates, distance_meters: row.distance_meters,
      ...(rainSource ? { rain_source: rainSource } : {}),
      ...(probabilitySource ? { precipitation_probability_source: probabilitySource } : {}),
      uv_index: row.uv_index ?? null, cloud_cover_percent: row.cloud_cover_percent ?? null,
      precipitation_probability_percent: rain.probability, fetched_at: fetchedAt,
      humidity_percent: row.humidity_percent ?? null, wind_kmh: row.wind_kmh ?? null,
      feels_like_c: row.feels_like_c ?? null, pressure_hpa: row.pressure_hpa ?? null,
      precipitation_mm: row.precipitation_mm ?? null, condition_code: row.condition_code,
      rain_mm_per_hour: rain.value, gust_kmh: row.gust_kmh,
      temperature_c: row.temperature_c, visibility_m: row.visibility_m,
      // Provider codes do not establish distant/direct storm or official-alert coverage.
      storm: row.condition_code === "hail" ? "hail" : row.condition_code === "thunderstorm" || ["1087","1273","1276","1279","1282"].includes(row.condition_code ?? "") ? "unclassified" : null,
      official_alert_level: null, freshness: stale ? "stale" : !forecast && ageMinutes > 60 ? "aging" : "fresh",
      coverage: "covered", source: row.source, source_time: sourceTime,
      valid_from: iso(row.valid_from), valid_to: iso(row.valid_to),
      reasons: ["official_alert_source_not_integrated", "storm_classification_unavailable",
        ...(!forecast && !rainSource ? ["observation_precipitation_interval_unspecified"] : []),
        ...(rainSource ? ["rain_from_hourly_forecast"] : []),
        ...(rain.failed ? ["hourly_rain_query_failed"] : []),
        ...(forecast && row.visibility_m == null ? ["forecast_visibility_unavailable"] : []),
        ...(forecast && !sourceTime ? ["provider_issue_time_unavailable_using_fetch_age"] : []),
        ...(stale ? ["weather_stale_or_expired"] : !forecast && ageMinutes > 60 ? ["aging_reduced_reliability"] : [])],
    };
  } catch {
    return unavailableWeather("weather_query_failed");
  }
}
