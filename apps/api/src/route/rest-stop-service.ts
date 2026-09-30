import type { Coordinates, RouteGeometry, RouteResponse } from "@vietnam-weather/contracts";

type RestStops = NonNullable<RouteResponse["rest_stops"]>;
type Stop = RestStops["items"][number];
type ProviderStop = Omit<Stop, "distance_from_start_meters">;
const unavailable: RestStops = { status: "unavailable", source: "OpenStreetMap", route_type: "fastest", items: [] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStops(value: unknown): ProviderStop[] | null {
  if (!record(value) || !Array.isArray(value.elements) || typeof value.remark === "string") return null;
  return value.elements.flatMap((element: unknown): ProviderStop[] => {
    if (!record(element) || !record(element.tags) || !["rest_area", "services"].includes(String(element.tags.highway)) ||
        !["node", "way", "relation"].includes(String(element.type)) || typeof element.id !== "number") return [];
    const name = [element.tags["name:vi"], element.tags.name, element.tags["name:en"]]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (!name) return [];
    const location = record(element.center) ? element.center : element;
    if (typeof location.lat !== "number" || typeof location.lon !== "number" ||
        !Number.isFinite(location.lat) || !Number.isFinite(location.lon) || Math.abs(location.lat) > 90 || Math.abs(location.lon) > 180) return [];
    return [{ id: `${element.type}/${element.id}`, name: name.trim(),
      coordinates: { latitude: location.lat, longitude: location.lon },
      source_url: `https://www.openstreetmap.org/${element.type}/${element.id}` }];
  });
}

function routePosition(point: Coordinates, coordinates: readonly Coordinates[]) {
  let along = 0, bestDistance = Infinity, bestAlong = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    if (!a || !b) continue;
    const xScale = 111_195 * Math.cos(point.latitude * Math.PI / 180);
    const ax = (a.longitude - point.longitude) * xScale, ay = (a.latitude - point.latitude) * 111_195;
    const dx = (b.longitude - a.longitude) * xScale, dy = (b.latitude - a.latitude) * 111_195;
    const length = Math.hypot(dx, dy);
    const fraction = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length ** 2)) : 0;
    const distance = Math.hypot(ax + fraction * dx, ay + fraction * dy);
    if (distance < bestDistance) { bestDistance = distance; bestAlong = along + fraction * length; }
    along += length;
  }
  return { distance: bestDistance, along: bestAlong, length: along };
}

export class RestStopService {
  private readonly cache = new Map<string, { readonly expires: number; readonly result: Promise<readonly ProviderStop[] | null> }>();
  constructor(private readonly options: {
    readonly fetch?: typeof fetch;
    readonly endpoint?: string;
    readonly now?: () => number;
    readonly timeoutMs?: number;
  } = {}) {}

  async findForRoute(geometry: RouteGeometry): Promise<RestStops> {
    if (geometry.coordinates.length < 2) return unavailable;
    const latitudes = geometry.coordinates.map(point => point.latitude);
    const longitudes = geometry.coordinates.map(point => point.longitude);
    if (![...latitudes, ...longitudes].every(Number.isFinite)) return unavailable;
    // Cache provider results by a padded bbox, then filter each caller's exact geometry.
    const bounds = [Math.floor((Math.min(...latitudes) - 0.02) * 100) / 100,
      Math.floor((Math.min(...longitudes) - 0.02) * 100) / 100,
      Math.ceil((Math.max(...latitudes) + 0.02) * 100) / 100,
      Math.ceil((Math.max(...longitudes) + 0.02) * 100) / 100].join(",");
    const now = (this.options.now ?? Date.now)();
    let entry = this.cache.get(bounds);
    if (!entry || entry.expires <= now) {
      if (this.cache.size >= 64) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      const result = this.fetchStops(bounds);
      entry = { expires: now + 30 * 60_000, result };
      this.cache.set(bounds, entry);
      void result.then(stops => {
        if (stops === null && this.cache.get(bounds)?.result === result) {
          this.cache.set(bounds, { expires: (this.options.now ?? Date.now)() + 60_000, result });
        }
      });
    }
    const stops = await entry.result;
    if (stops === null) return unavailable;
    const items = stops.flatMap(stop => {
      const position = routePosition(stop.coordinates, geometry.coordinates);
      return position.distance <= 1000 ? [{ ...stop,
        distance_from_start_meters: Math.round(position.length ? position.along / position.length * geometry.distance_meters : 0) }] : [];
    }).sort((a, b) => a.distance_from_start_meters - b.distance_from_start_meters).slice(0, 10);
    return { status: "available", source: "OpenStreetMap", route_type: "fastest", items };
  }

  private async fetchStops(bounds: string): Promise<readonly ProviderStop[] | null> {
    try {
      const endpoint = this.options.endpoint ?? "https://overpass-api.de/api/interpreter";
      const query = `[out:json][timeout:2];nwr["highway"~"^(rest_area|services)$"][~"^name(:vi|:en)?$"~"."](${bounds});out center;`;
      const url = `${endpoint}?${new URLSearchParams({ data: query }).toString()}`;
      const response = await (this.options.fetch ?? fetch)(url, {
        method: "GET", headers: { Accept: "application/json", "User-Agent": "VietnamWeather/1.0 (route rest stop lookup)" },
        signal: AbortSignal.timeout(Math.min(this.options.timeoutMs ?? 3000, 3000)),
      });
      if (!response.ok) return null;
      return parseStops(await response.json());
    } catch (error) {
      if (error instanceof Error) return null;
      throw error;
    }
  }
}
