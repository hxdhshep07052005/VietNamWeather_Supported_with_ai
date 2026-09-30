import type { Pool } from "pg";
import { type Coordinates, type RouteGeometry, type SamplePoint, SAMPLE_INTERVAL_METERS, SAMPLE_INTERVAL_MINUTES } from "@vietnam-weather/contracts";
import { readWeatherEvidence } from "../risk/weather-evidence.js";

export interface RouteSamplerOptions {
  readonly dbPool: Pool;
  readonly sampleIntervalMinutes?: number;
  readonly sampleIntervalMeters?: number;
}
export class RouteSampler {
  constructor(private readonly options: RouteSamplerOptions) {}

  async sampleRoute(geometry: RouteGeometry, departureTime: Date): Promise<SamplePoint[]> {
    const { coordinates, distance_meters: distance, duration_seconds: duration } = geometry;
    if (coordinates.length < 2 || !Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(departureTime.getTime()) || coordinates.some(c => !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude))) return [];
    const cumulative = [0];
    for (let i = 1; i < coordinates.length; i++) cumulative.push(cumulative[i - 1]! + this.distance(coordinates[i - 1]!, coordinates[i]!));
    const geometricLength = cumulative[cumulative.length - 1]!;
    if (geometricLength <= 0) return [];
    const meters = Math.min(SAMPLE_INTERVAL_METERS, this.options.sampleIntervalMeters ?? SAMPLE_INTERVAL_METERS);
    const seconds = Math.min(SAMPLE_INTERVAL_MINUTES, this.options.sampleIntervalMinutes ?? SAMPLE_INTERVAL_MINUTES) * 60;
    if (meters <= 0 || seconds <= 0) return [];
    const intervals = Math.ceil(Math.max(distance / meters, geometricLength / meters, duration / seconds));
    const samples: SamplePoint[] = [];
    let segment = 1;
    for (let i = 0; i <= intervals; i++) {
      const fraction = i / intervals;
      const position = fraction * geometricLength;
      while (segment < cumulative.length - 1 && cumulative[segment]! < position) segment++;
      const a = coordinates[segment - 1]!, b = coordinates[segment]!;
      const length = cumulative[segment]! - cumulative[segment - 1]!;
      const t = length ? (position - cumulative[segment - 1]!) / length : 0;
      samples.push({ coordinates: i === 0 ? coordinates[0]! : i === intervals ? coordinates[coordinates.length - 1]! :
        { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t },
        distance_from_start_meters: fraction * distance, time_from_departure_seconds: fraction * duration,
        eta: new Date(departureTime.getTime() + fraction * duration * 1000).toISOString(),
        is_interpolated: i > 0 && i < intervals, has_weather_data: false });
    }
    return samples;
  }

  async enrichWithWeather(samples: SamplePoint[]): Promise<SamplePoint[]> {
    const now = new Date();
    return Promise.all(samples.map(async sample => {
      const weather = await readWeatherEvidence(this.options.dbPool, sample.coordinates, new Date(sample.eta), now);
      return { ...sample, weather, has_weather_data: weather.coverage === "covered", weather_freshness: weather.freshness };
    }));
  }
  calculateEta(departureTime: Date, distanceMeters: number, avgSpeedMs: number): Date {
    return new Date(departureTime.getTime() + distanceMeters / avgSpeedMs * 1000);
  }
  private distance(a: Coordinates, b: Coordinates): number {
    const rad = Math.PI / 180;
    const x = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
}
export function createRouteSampler(options: RouteSamplerOptions): RouteSampler { return new RouteSampler(options); }
