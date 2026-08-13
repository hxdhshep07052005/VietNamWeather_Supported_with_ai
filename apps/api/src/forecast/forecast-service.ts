/**
 * Phase 7 Forecast Service
 * Handles forecast data formatting, timezone conversion, and horizon enforcement
 *
 * Based on decisions FCAST-001..006
 */

import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import {
  FORECAST_HOURLY_MAX_HOURS,
  FORECAST_DAILY_MAX_DAYS,
  formatDisplayTime,
  formatDisplayDate,
  FRESHNESS_STATES,
  FORECAST_ERROR_CODES,
  type FreshnessState,
  type ForecastRequest,
  type ForecastSeries,
  type HourlyForecastPoint,
  type DailyForecastPoint,
  type ForecastAttribution,
  type ForecastErrorCode,
} from "@vietnam-weather/contracts";

// =============================================================================
// Types
// =============================================================================

export interface ForecastServiceOptions {
  readonly dbPool: Pool;
  readonly cacheTtlSeconds?: number;
}

interface RawHourlyData {
  time: string;
  temp_c: number | null;
  feels_like_c: number | null;
  wind_speed: number | null;
  wind_dir_deg: number | null;
  humidity: number | null;
  precip_probability: number | null;
  precip_mm: number | null;
  uv_index: number | null;
  vis_km: number | null;
  condition_code: number | null;
  condition_text: string | null;
  freshness: FreshnessState;
}

interface RawDailyData {
  date: string;
  max_temp_c: number | null;
  min_temp_c: number | null;
  avg_temp_c: number | null;
  max_wind_speed: number | null;
  total_precip_mm: number | null;
  avg_humidity: number | null;
  uv_index: number | null;
  sunrise: string | null;
  sunset: string | null;
  moon_phase: string | null;
  condition_code: number | null;
  condition_text: string | null;
  freshness: FreshnessState;
}

// =============================================================================
// Wind Direction Mapping
// =============================================================================

const WIND_DIRECTIONS: Record<number, string> = {
  0: "N", 22.5: "NNE", 45: "NE", 67.5: "ENE",
  90: "E", 112.5: "ESE", 135: "SE", 157.5: "SSE",
  180: "S", 202.5: "SSW", 225: "SW", 247.5: "WSW",
  270: "W", 292.5: "WNW", 315: "NW", 337.5: "NNW",
  360: "N"
};

function getWindDirection(degrees: number | null): string | null {
  if (degrees === null) return null;
  const nearest = Math.round(degrees / 22.5) * 22.5;
  const key = nearest === 360 ? 0 : nearest;
  return WIND_DIRECTIONS[key] ?? null;
}

// =============================================================================
// Forecast Service
// =============================================================================

export class ForecastService {
  private readonly dbPool: Pool;
  private readonly cacheTtlSeconds: number;

  constructor(options: ForecastServiceOptions) {
    this.dbPool = options.dbPool;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 300;
  }

  /**
   * Get forecast for a location
   */
  async getForecast(request: ForecastRequest): Promise<ForecastSeries> {
    const locationId = request.location_id;
    const hourlyHours = this.enforceHourlyLimit(request.hourly_hours ?? FORECAST_HOURLY_MAX_HOURS);
    const dailyDays = this.enforceDailyLimit(request.daily_days ?? FORECAST_DAILY_MAX_DAYS);
    const language = request.language ?? "vi";

    // Get location info
    const location = await this.getLocation(locationId);
    if (!location) {
      throw new ForecastServiceError(
        FORECAST_ERROR_CODES.INVALID_LOCATION,
        "Location not found",
        randomUUID(),
        false
      );
    }

    // Get hourly data
    const hourlyData = await this.getHourlyData(locationId, hourlyHours);

    // Get daily data
    const dailyData = await this.getDailyData(locationId, dailyDays);

    // Format hourly points
    const hourlyPoints = this.formatHourlyPoints(hourlyData);

    // Format daily points
    const dailyPoints = this.formatDailyPoints(dailyData, language);

    // Detect gaps
    const hourlyWithGaps = this.detectHourlyGaps(hourlyPoints, hourlyHours);
    const dailyWithGaps = this.detectDailyGaps(dailyPoints, dailyDays);

    // Build attribution
    const attribution = this.buildAttribution(hourlyData);

    // Determine overall freshness
    const freshness = this.determineOverallFreshness([...hourlyData, ...dailyData]);

    // Build response with conditional warnings
    const warnings: { stale_warning?: string; horizon_warning?: string } = {};

    // Add stale warning if needed
    if (freshness === FRESHNESS_STATES.STALE) {
      warnings.stale_warning = language === "vi"
        ? "Dữ liệu có thể không còn mới nhất"
        : "Data may not be the latest available";
    }

    // Add horizon warning if data is truncated
    if (hourlyPoints.length < hourlyHours || dailyPoints.length < dailyDays) {
      warnings.horizon_warning = language === "vi"
        ? "Dữ liệu bị giới hạn bởi khả năng cung cấp của nhà cung cấp"
        : "Data limited by provider capability";
    }

    // Build response
    const response: ForecastSeries = {
      location_id: locationId,
      location_name: location.name,
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      requested_hourly_hours: hourlyHours,
      hourly_points: hourlyWithGaps,
      requested_daily_days: dailyDays,
      daily_points: dailyWithGaps,
      attribution,
      freshness,
      ...warnings,
    };

    return response;
  }

  /**
   * Enforce hourly horizon limit (FCAST-001)
   */
  private enforceHourlyLimit(requested: number): number {
    return Math.min(Math.max(1, requested), FORECAST_HOURLY_MAX_HOURS);
  }

  /**
   * Enforce daily horizon limit (FCAST-001)
   */
  private enforceDailyLimit(requested: number): number {
    return Math.min(Math.max(1, requested), FORECAST_DAILY_MAX_DAYS);
  }

  /**
   * Get location info
   */
  private async getLocation(locationId: string): Promise<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  } | null> {
    const result = await this.dbPool.query<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
    }>(
      `SELECT id, name, ST_Y(coordinates::geometry) as latitude, ST_X(coordinates::geometry) as longitude
         FROM locations
        WHERE id = $1
          AND status = 'active'`,
      [locationId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Get hourly forecast data from Phase 5 weather store
   */
  private async getHourlyData(
    locationId: string,
    hours: number
  ): Promise<RawHourlyData[]> {
    const result = await this.dbPool.query<RawHourlyData>(
      `SELECT
         valid_at as time,
         temp_c,
         feels_like_c,
         wind_speed,
         wind_dir_deg,
         humidity,
         precip_probability,
         precip_mm,
         uv_index,
         vis_km,
         condition_code,
         condition_text,
         freshness
       FROM app_weather.weather_hourly_forecasts
      WHERE location_id = $1
        AND valid_at > NOW()
        AND valid_at <= NOW() + INTERVAL '${hours} hours'
      ORDER BY valid_at ASC
      LIMIT $2`,
      [locationId, hours]
    );
    return result.rows;
  }

  /**
   * Get daily forecast data from Phase 5 weather store
   */
  private async getDailyData(
    locationId: string,
    days: number
  ): Promise<RawDailyData[]> {
    const result = await this.dbPool.query<RawDailyData>(
      `SELECT
         valid_date as date,
         max_temp_c,
         min_temp_c,
         avg_temp_c,
         max_wind_speed,
         total_precip_mm,
         avg_humidity,
         uv_index,
         sunrise,
         sunset,
         moon_phase,
         condition_code,
         condition_text,
         freshness
       FROM app_weather.weather_daily_forecasts
      WHERE location_id = $1
        AND valid_date >= CURRENT_DATE
        AND valid_date < CURRENT_DATE + $2::integer
      ORDER BY valid_date ASC
      LIMIT $3`,
      [locationId, `${days} days`, days]
    );
    return result.rows;
  }

  /**
   * Format hourly data points with display values
   */
  private formatHourlyPoints(
    data: RawHourlyData[]
  ): HourlyForecastPoint[] {
    return data.map((row) => ({
      time: row.time,
      display_time: formatDisplayTime(row.time),
      temp_c: row.temp_c,
      feels_like_c: row.feels_like_c,
      wind_speed: row.wind_speed,
      wind_dir_deg: row.wind_dir_deg,
      wind_dir_text: getWindDirection(row.wind_dir_deg),
      humidity: row.humidity,
      precip_probability: row.precip_probability,
      precip_mm: row.precip_mm,
      uv_index: row.uv_index,
      vis_km: row.vis_km,
      condition_code: row.condition_code,
      condition_text: row.condition_text,
      is_gap: false,
      freshness: row.freshness,
    }));
  }

  /**
   * Format daily data points with display values
   */
  private formatDailyPoints(
    data: RawDailyData[],
    language: "vi" | "en"
  ): DailyForecastPoint[] {
    return data.map((row) => ({
      date: row.date,
      display_date: formatDisplayDate(row.date, language),
      day_of_week: new Date(row.date).getUTCDay() || 7, // 1=Monday
      max_temp_c: row.max_temp_c,
      min_temp_c: row.min_temp_c,
      avg_temp_c: row.avg_temp_c,
      max_wind_speed: row.max_wind_speed,
      total_precip_mm: row.total_precip_mm,
      avg_humidity: row.avg_humidity,
      uv_index: row.uv_index,
      sunrise: row.sunrise,
      sunset: row.sunset,
      moon_phase: row.moon_phase,
      condition_code: row.condition_code,
      condition_text: row.condition_text,
      is_gap: false,
      freshness: row.freshness,
    }));
  }

  /**
   * Detect gaps in hourly forecast (FCAST requirement)
   */
  private detectHourlyGaps(
    points: HourlyForecastPoint[],
    requestedHours: number
  ): HourlyForecastPoint[] {
    if (points.length === 0) return points;

    const result: HourlyForecastPoint[] = [];

    for (let i = 0; i < requestedHours; i++) {
      const expectedTime = new Date(points[0]!.time);
      expectedTime.setUTCHours(expectedTime.getUTCHours() + i);

      const matchingPoint = points.find((p) => {
        const pointTime = new Date(p.time);
        return Math.abs(pointTime.getTime() - expectedTime.getTime()) < 30 * 60 * 1000;
      });

      if (matchingPoint) {
        result.push(matchingPoint);
      } else {
        // Gap point
        result.push({
          time: expectedTime.toISOString(),
          display_time: formatDisplayTime(expectedTime.toISOString()),
          temp_c: null,
          feels_like_c: null,
          wind_speed: null,
          wind_dir_deg: null,
          wind_dir_text: null,
          humidity: null,
          precip_probability: null,
          precip_mm: null,
          uv_index: null,
          vis_km: null,
          condition_code: null,
          condition_text: null,
          is_gap: true,
          freshness: FRESHNESS_STATES.UNAVAILABLE,
        });
      }
    }

    return result;
  }

  /**
   * Detect gaps in daily forecast
   */
  private detectDailyGaps(
    points: DailyForecastPoint[],
    requestedDays: number
  ): DailyForecastPoint[] {
    if (points.length === 0) return points;

    const result: DailyForecastPoint[] = [];
    const firstPoint = points[0];
    if (!firstPoint) return points;

    const startDate = new Date(firstPoint.date);
    if (isNaN(startDate.getTime())) return points;

    for (let i = 0; i < requestedDays; i++) {
      const expectedDate = new Date(startDate);
      expectedDate.setUTCDate(expectedDate.getUTCDate() + i);
      const isoString = expectedDate.toISOString();
      const expectedDateStr = isoString.substring(0, 10);

      const matchingPoint = points.find((p) => p.date.startsWith(expectedDateStr));

      if (matchingPoint) {
        result.push(matchingPoint);
      } else {
        // Gap point
        result.push({
          date: expectedDate.toISOString(),
          display_date: formatDisplayDate(expectedDate.toISOString(), "vi"),
          day_of_week: expectedDate.getUTCDay() || 7,
          max_temp_c: null,
          min_temp_c: null,
          avg_temp_c: null,
          max_wind_speed: null,
          total_precip_mm: null,
          avg_humidity: null,
          uv_index: null,
          sunrise: null,
          sunset: null,
          moon_phase: null,
          condition_code: null,
          condition_text: null,
          is_gap: true,
          freshness: FRESHNESS_STATES.UNAVAILABLE,
        });
      }
    }

    return result;
  }

  /**
   * Build attribution metadata (FCAST requirement)
   */
  private buildAttribution(data: RawHourlyData[]): ForecastAttribution {
    const now = new Date().toISOString();
    const issueTime = data[0]?.time ?? now;

    return {
      provider: "WeatherAPI.com",
      attribution_text: "Powered by WeatherAPI.com",
      attribution_url: "https://www.weatherapi.com",
      issue_time: issueTime,
      last_updated: now,
    };
  }

  /**
   * Determine overall freshness state
   */
  private determineOverallFreshness(data: Array<{ freshness: FreshnessState }>): FreshnessState {
    if (data.length === 0) return FRESHNESS_STATES.UNAVAILABLE;

    // If any is expired, overall is expired
    if (data.some((d) => d.freshness === FRESHNESS_STATES.EXPIRED)) {
      return FRESHNESS_STATES.EXPIRED;
    }

    // If any is unavailable, overall is unavailable
    if (data.some((d) => d.freshness === FRESHNESS_STATES.UNAVAILABLE)) {
      return FRESHNESS_STATES.UNAVAILABLE;
    }

    // If any is stale, overall is stale
    if (data.some((d) => d.freshness === FRESHNESS_STATES.STALE)) {
      return FRESHNESS_STATES.STALE;
    }

    return FRESHNESS_STATES.FRESH;
  }
}

// =============================================================================
// Forecast Service Error
// =============================================================================

export class ForecastServiceError extends Error {
  readonly code: ForecastErrorCode;
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(
    code: ForecastErrorCode,
    message: string,
    correlationId: string,
    retryable: boolean
  ) {
    super(message);
    this.name = "ForecastServiceError";
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }

  toResponse() {
    return {
      code: this.code,
      message: this.message,
      correlation_id: this.correlationId,
      retryable: this.retryable,
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createForecastService(options: ForecastServiceOptions): ForecastService {
  return new ForecastService(options);
}
