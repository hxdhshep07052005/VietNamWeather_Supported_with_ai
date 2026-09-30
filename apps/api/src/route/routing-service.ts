/**
 * Phase 8 Routing Service
 * Calculates routes using Geoapify Routing API
 *
 * Based on ROUTE-001: Vehicle types (car, motorcycle)
 * Based on ROUTE-003: Route alternatives (fastest, shortest)
 */

import { randomUUID } from "node:crypto";

import {
  type Coordinates,
  type VehicleType,
  type RouteGeometry,
  type RouteErrorCode,
  GEOAPIFY_TRANSPORT_MODES,
} from "@vietnam-weather/contracts";

// =============================================================================
// Types
// =============================================================================

export interface RoutingServiceOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

interface GeoapifyRouteResult {
  type?: string;
  features?: Array<{
    properties?: {
      distance?: number;
      time?: number;
    };
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
  routes?: Array<{
    geometry: string;
    distance: number;
    duration: number;
    legs?: Array<{
      distance: number;
      duration: number;
    }>;
  }>;
}

export interface RoutingError extends Error {
  code: RouteErrorCode;
  correlationId: string;
  retryable: boolean;
}

// =============================================================================
// Routing Service
// =============================================================================

export class RoutingService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: RoutingServiceOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.geoapify.com/v1/routing";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  /**
   * Get route between two points
   */
  async getRoute(
    origin: Coordinates,
    destination: Coordinates,
    vehicleType: VehicleType,
    preference: "short" | "balanced" = "balanced"
  ): Promise<RouteGeometry> {
    const correlationId = randomUUID();

    try {
      const url = new URL(
        this.baseUrl.endsWith("/routing") ? this.baseUrl : `${this.baseUrl}/routing`
      );
      url.searchParams.set(
        "waypoints",
        `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`
      );
      url.searchParams.set("mode", GEOAPIFY_TRANSPORT_MODES[vehicleType] || "drive");
      url.searchParams.set("type", preference);
      url.searchParams.set("apiKey", this.apiKey);

      const response = await this.fetchWithTimeout(url.toString(), correlationId);

      let distanceMeters = 0;
      let durationSeconds = 0;
      let coordinates: Coordinates[] = [];

      if (response.features && response.features.length > 0) {
        const feat = response.features[0]!;
        distanceMeters = feat.properties?.distance || 0;
        durationSeconds = Math.round(feat.properties?.time || 0);

        const rawCoords = feat.geometry?.coordinates as unknown;
        const flat: Array<[number, number]> = Array.isArray(rawCoords)
          ? Array.isArray(rawCoords[0]) && Array.isArray((rawCoords[0] as unknown[])[0])
            ? (rawCoords as Array<Array<[number, number]>>).flat()
            : (rawCoords as Array<[number, number]>)
          : [];

        coordinates = flat.map((pt) => ({
          longitude: pt[0],
          latitude: pt[1],
        }));
      } else if (response.routes && response.routes.length > 0) {
        const route = response.routes[0]!;
        distanceMeters = route.distance;
        durationSeconds = route.duration;
        coordinates = this.decodePolyline(route.geometry);
      } else {
        throw this.createError(
          "ROUTE_NO_ROUTE_FOUND",
          "No route found between points",
          correlationId,
          false
        );
      }

      return {
        coordinates,
        distance_meters: distanceMeters,
        duration_seconds: durationSeconds,
      };
    } catch (error) {
      if (this.isRoutingError(error)) {
        throw error;
      }

      throw this.createError(
        "ROUTE_PROVIDER_ERROR",
        `Routing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        correlationId,
        true
      );
    }
  }

  /**
   * Get multiple route alternatives
   */
  async getAlternatives(
    origin: Coordinates,
    destination: Coordinates,
    vehicleType: VehicleType
  ): Promise<RouteGeometry[]> {
    const correlationId = randomUUID();

    try {
      // Geoapify doesn't support multiple alternatives in single request
      // So we make multiple requests for different modes
      const [fastestRoute, shortestRoute] = await Promise.all([
        this.getRoute(origin, destination, vehicleType),
        this.getRoute(origin, destination, vehicleType, "short"),
      ]);

      // Return unique routes (may be same if no alternative exists)
      const routes = [fastestRoute];
      if (JSON.stringify(shortestRoute.coordinates) !== JSON.stringify(fastestRoute.coordinates)) {
        routes.push(shortestRoute);
      }

      return routes;
    } catch (error) {
      if (this.isRoutingError(error)) {
        throw error;
      }

      throw this.createError(
        "ROUTE_PROVIDER_ERROR",
        `Failed to get alternatives: ${error instanceof Error ? error.message : "Unknown error"}`,
        correlationId,
        true
      );
    }
  }

  /**
   * Decode Geoapify polyline to coordinates
   */
  private decodePolyline(encoded: string): Coordinates[] {
    const coordinates: Coordinates[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      coordinates.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return coordinates;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, correlationId: string): Promise<GeoapifyRouteResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw this.createError(
          "ROUTE_PROVIDER_ERROR",
          `Routing API error: ${response.status}`,
          correlationId,
          response.status >= 500
        );
      }

      return response.json() as Promise<GeoapifyRouteResult>;
    } catch (error) {
      if (this.isRoutingError(error)) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw this.createError(
          "ROUTE_PROVIDER_ERROR",
          "Routing request timeout",
          correlationId,
          true
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Create routing error
   */
  private createError(
    code: RouteErrorCode,
    message: string,
    correlationId: string,
    retryable: boolean
  ): RoutingError {
    const error = new Error(message) as RoutingError;
    error.name = "RoutingError";
    error.code = code;
    error.correlationId = correlationId;
    error.retryable = retryable;
    return error;
  }

  /**
   * Check if error is RoutingError
   */
  private isRoutingError(error: unknown): error is RoutingError {
    return error instanceof Error && "code" in error && "correlationId" in error;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRoutingService(options?: Partial<RoutingServiceOptions>): RoutingService {
  const apiKey =
    options?.apiKey ||
    process.env.GEOAPIFY_ROUTING_API_KEY?.trim() ||
    process.env.GEOAPIFY_SERVER_API_KEY?.trim() ||
    process.env.GEOAPIFY_API_KEY?.trim() ||
    "demo_routing_key";

  return new RoutingService({
    apiKey,
    baseUrl: options?.baseUrl ?? "https://api.geoapify.com/v1/routing",
    timeoutMs: options?.timeoutMs ?? 15_000,
  });
}
