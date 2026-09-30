import { createHash } from "node:crypto";
import type { Coordinates, SamplePoint } from "@vietnam-weather/contracts";
import type { WeatherEnqueueResult, WeatherStore } from "../weather-store.js";

export interface RouteWeatherRefreshResult {
  readonly requested: number;
  readonly inserted: number;
  readonly deferred: number;
  readonly runs: readonly WeatherEnqueueResult[];
}

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const radians = Math.PI / 180;
  const haversine = Math.sin((b.latitude - a.latitude) * radians / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) *
    Math.sin((b.longitude - a.longitude) * radians / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function needsRefresh(sample: SamplePoint): boolean {
  const weather = sample.weather;
  return weather === undefined || weather.coverage !== "covered" ||
    (weather.freshness !== "fresh" && weather.freshness !== "aging") ||
    [weather.gust_kmh, weather.temperature_c, weather.visibility_m]
      .some(value => value === null || !Number.isFinite(value));
}

export class RouteWeatherRefresh {
  constructor(
    private readonly store: Pick<WeatherStore, "enqueue">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refresh(samples: readonly SamplePoint[]): Promise<RouteWeatherRefreshResult> {
    const anchors: Coordinates[] = [];
    let deferred = 0;
    for (const sample of samples) {
      if (!needsRefresh(sample) || anchors.some(anchor => distanceMeters(anchor, sample.coordinates) <= 10000)) continue;
      if (anchors.length >= 100) { deferred++; continue; }
      anchors.push({
        latitude: Math.round(sample.coordinates.latitude * 1000) / 1000,
        longitude: Math.round(sample.coordinates.longitude * 1000) / 1000,
      });
    }
    const fetchedAt = this.now();
    const bucket = Math.floor(fetchedAt.getTime() / 600000);
    const runs: WeatherEnqueueResult[] = [];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, anchors.length) }, async () => {
      while (cursor < anchors.length) {
        const anchor = anchors[cursor++];
        if (anchor === undefined) break;
        const hash = createHash("sha256").update(JSON.stringify({ coordinates: anchor, bucket })).digest("hex");
        const run = await this.store.enqueue({ coordinates: anchor }, "bundle", `route-weather:${hash}`, fetchedAt);
        runs.push(run);
      }
    }));
    return { requested: anchors.length, inserted: runs.filter(run => run.inserted).length, deferred, runs };
  }
}
