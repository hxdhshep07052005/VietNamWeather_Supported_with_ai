/**
 * Phase 8 Route Sampler
 * Extracts sample points along route geometry
 *
 * Based on ROUTE-002: ETA calculation based on departure time
 * Sample every 15 minutes or 5 km
 */

import type { Pool } from "pg";

import {
  type Coordinates,
  type RouteGeometry,
  type SamplePoint,
  SAMPLE_INTERVAL_MINUTES,
  SAMPLE_INTERVAL_METERS,
} from "@vietnam-weather/contracts";

// =============================================================================
// Types
// =============================================================================

export interface RouteSamplerOptions {
  readonly dbPool: Pool;
  readonly sampleIntervalMinutes?: number;
  readonly sampleIntervalMeters?: number;
}

// =============================================================================
// Route Sampler
// =============================================================================

export class RouteSampler {
  private readonly dbPool: Pool;
  private readonly sampleIntervalMinutes: number;
  private readonly sampleIntervalMeters: number;

  constructor(options: RouteSamplerOptions) {
    this.dbPool = options.dbPool;
    this.sampleIntervalMinutes = options.sampleIntervalMinutes ?? SAMPLE_INTERVAL_MINUTES;
    this.sampleIntervalMeters = options.sampleIntervalMeters ?? SAMPLE_INTERVAL_METERS;
  }

  /**
   * Sample points along route geometry
   */
  async sampleRoute(
    geometry: RouteGeometry,
    departureTime: Date
  ): Promise<SamplePoint[]> {
    const samples: SamplePoint[] = [];
    const coordinates = geometry.coordinates;

    if (coordinates.length < 2) {
      return samples;
    }

    let accumulatedDistance = 0;
    let accumulatedTime = 0;
    const avgSpeed = geometry.distance_meters / geometry.duration_seconds; // m/s

    // Start point
    samples.push(this.createSamplePoint(
      coordinates[0]!,
      0,
      0,
      departureTime,
      false
    ));

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1]!;
      const curr = coordinates[i]!;

      // Calculate segment distance
      const segmentDistance = this.calculateDistance(prev, curr);
      const segmentTime = segmentDistance / avgSpeed;

      accumulatedDistance += segmentDistance;
      accumulatedTime += segmentTime;

      // Check if we should add a sample point
      const timeSinceLastSample = this.getTimeSinceLastSample(samples, accumulatedTime);
      const distSinceLastSample = this.getDistanceSinceLastSample(samples, accumulatedDistance);

      if (
        distSinceLastSample >= this.sampleIntervalMeters ||
        timeSinceLastSample >= this.sampleIntervalMinutes * 60
      ) {
        samples.push(this.createSamplePoint(
          curr,
          accumulatedDistance,
          accumulatedTime,
          departureTime,
          false
        ));
      }
    }

    // Ensure we have a sample at the end
    const lastCoord = coordinates[coordinates.length - 1]!;
    if (samples.length === 0 || this.getDistanceSinceLastSample(samples, accumulatedDistance) > 100) {
      samples.push(this.createSamplePoint(
        lastCoord,
        accumulatedDistance,
        accumulatedTime,
        departureTime,
        false
      ));
    }

    return samples;
  }

  /**
   * Get weather data at sample points
   */
  async enrichWithWeather(samples: SamplePoint[]): Promise<SamplePoint[]> {
    if (samples.length === 0) return samples;

    const sampleTimes = samples.map(s => s.eta);
    const coords = samples.map(s => s.coordinates);

    try {
      const result = await this.dbPool.query<{
        valid_at: string;
        lat: number;
        lon: number;
        temp_c: number | null;
        freshness: string;
      }>(
        `SELECT 
           valid_at,
           ST_Y(coordinates::geometry) as lat,
           ST_X(coordinates::geometry) as lon,
           temp_c,
           freshness
         FROM app_weather.weather_hourly_forecasts
         WHERE (valid_at, coordinates) IN (
           SELECT DISTINCT ON (bucket_time)
             $1::timestamptz[],
             point::geometry
           FROM unnest($2::float[], $3::float[]) AS point(lat, lon)
         )
         ORDER BY valid_at ASC`,
        [sampleTimes, coords.map(c => c.latitude), coords.map(c => c.longitude)]
      );

      // Match weather data to sample points
      return samples.map(sample => {
        const match = result.rows.find(row => {
          const weatherTime = new Date(row.valid_at);
          const sampleTime = new Date(sample.eta);
          return Math.abs(weatherTime.getTime() - sampleTime.getTime()) < 60 * 60 * 1000; // Within 1 hour
        });

        if (match) {
          return {
            ...sample,
            has_weather_data: true,
            weather_freshness: match.freshness,
          };
        }

        return {
          ...sample,
          has_weather_data: false,
        };
      });
    } catch {
      // Return samples without weather enrichment
      return samples.map(sample => ({
        ...sample,
        has_weather_data: false,
      }));
    }
  }

  /**
   * Calculate ETA at a given distance
   */
  calculateEta(departureTime: Date, distanceMeters: number, avgSpeedMs: number): Date {
    const timeSeconds = distanceMeters / avgSpeedMs;
    return new Date(departureTime.getTime() + timeSeconds * 1000);
  }

  /**
   * Create a sample point
   */
  private createSamplePoint(
    coordinates: Coordinates,
    distanceFromStart: number,
    timeFromDeparture: number,
    departureTime: Date,
    isInterpolated: boolean
  ): SamplePoint {
    const eta = new Date(departureTime.getTime() + timeFromDeparture * 1000);

    return {
      coordinates,
      distance_from_start_meters: Math.round(distanceFromStart),
      time_from_departure_seconds: Math.round(timeFromDeparture),
      eta: eta.toISOString(),
      is_interpolated: isInterpolated,
      has_weather_data: false,
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(a: Coordinates, b: Coordinates): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;

    const x =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

    return R * c;
  }

  /**
   * Get time since last sample
   */
  private getTimeSinceLastSample(samples: SamplePoint[], currentTime: number): number {
    if (samples.length === 0) return 0;
    const lastSample = samples[samples.length - 1]!;
    return currentTime - lastSample.time_from_departure_seconds;
  }

  /**
   * Get distance since last sample
   */
  private getDistanceSinceLastSample(samples: SamplePoint[], currentDistance: number): number {
    if (samples.length === 0) return 0;
    const lastSample = samples[samples.length - 1]!;
    return currentDistance - lastSample.distance_from_start_meters;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRouteSampler(options: RouteSamplerOptions): RouteSampler {
  return new RouteSampler(options);
}
