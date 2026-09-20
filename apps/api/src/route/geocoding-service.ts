/**
 * Phase 8 Geocoding Service
 * Converts text queries to coordinates using Geoapify
 *
 * Based on ARCH-012: MapLibre + Geoapify Free
 */

import { randomUUID } from "node:crypto";

import {
  type Coordinates,
  type LocationInput,
  type ResolvedLocation,
  type RouteErrorCode,
  VIETNAM_BOUNDS,
  VIETNAM_COUNTRY_CODE,
} from "@vietnam-weather/contracts";

import { requireEnvironmentValue } from "@vietnam-weather/config";

// =============================================================================
// Types
// =============================================================================

export interface GeocodingServiceOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

interface GeoapifyGeocodingResult {
  results?: Array<{
    lat: number;
    lon: number;
    formatted: string;
    datasource?: {
      sourcename?: string;
    };
  }>;
}

// =============================================================================
// Geocoding Error
// =============================================================================

export class GeocodingError extends Error {
  readonly code: RouteErrorCode;
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(
    code: RouteErrorCode,
    message: string,
    correlationId: string,
    retryable: boolean
  ) {
    super(message);
    this.name = "GeocodingError";
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }
}

// =============================================================================
// Geocoding Service
// =============================================================================

export class GeocodingService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: GeocodingServiceOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.geoapify.com/v1/geocode";
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  /**
   * Resolve a location input to coordinates
   */
  async resolveLocation(input: LocationInput): Promise<ResolvedLocation> {
    if (input.type === "coordinates") {
      this.validateCoordinates(input.value);
      return {
        original: input,
        coordinates: input.value,
      };
    }

    return this.geocodeText(input.value);
  }

  /**
   * Geocode text query to coordinates
   */
  private async geocodeText(query: string): Promise<ResolvedLocation> {
    const correlationId = randomUUID();

    try {
      const url = new URL(`${this.baseUrl}/search`);
      url.searchParams.set("text", query);
      url.searchParams.set("filter", `countrycode:${VIETNAM_COUNTRY_CODE}`); // Vietnam only
      url.searchParams.set("limit", "1");
      url.searchParams.set("format", "json");
      url.searchParams.set("apiKey", this.apiKey);

      const response = await this.fetchWithTimeout(url.toString(), correlationId);

      if (!response.results || response.results.length === 0) {
        throw new GeocodingError(
          "ROUTE_ORIGIN_NOT_FOUND",
          `Location not found: ${query}`,
          correlationId,
          false
        );
      }

      const result = response.results[0]!;

      return {
        original: { type: "text", value: query },
        coordinates: {
          latitude: result.lat,
          longitude: result.lon,
        },
        display_name: result.formatted,
      };
    } catch (error) {
      if (error instanceof GeocodingError) {
        throw error;
      }

      throw new GeocodingError(
        "ROUTE_PROVIDER_ERROR",
        `Geocoding failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        correlationId,
        true
      );
    }
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, correlationId: string): Promise<GeoapifyGeocodingResult> {
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
        throw new GeocodingError(
          "ROUTE_PROVIDER_ERROR",
          `Geocoding API error: ${response.status}`,
          correlationId,
          response.status >= 500
        );
      }

      return response.json() as Promise<GeoapifyGeocodingResult>;
    } catch (error) {
      if (error instanceof GeocodingError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new GeocodingError(
          "ROUTE_PROVIDER_ERROR",
          "Geocoding request timeout",
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
   * Validate coordinates are within Vietnam bounds
   */
  private validateCoordinates(coords: Coordinates): void {
    if (
      coords.latitude < VIETNAM_BOUNDS.MIN_LAT ||
      coords.latitude > VIETNAM_BOUNDS.MAX_LAT ||
      coords.longitude < VIETNAM_BOUNDS.MIN_LON ||
      coords.longitude > VIETNAM_BOUNDS.MAX_LON
    ) {
      throw new GeocodingError(
        "ROUTE_INVALID_ORIGIN",
        "Coordinates outside Vietnam bounds",
        randomUUID(),
        false
      );
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createGeocodingService(options?: Partial<GeocodingServiceOptions>): GeocodingService {
  const apiKey =
    options?.apiKey ||
    process.env.GEOAPIFY_GEOCODING_API_KEY?.trim() ||
    process.env.GEOAPIFY_SERVER_API_KEY?.trim() ||
    process.env.GEOAPIFY_API_KEY?.trim() ||
    "demo_geocoding_key";

  return new GeocodingService({
    apiKey,
    baseUrl: options?.baseUrl ?? "https://api.geoapify.com/v1/geocode",
    timeoutMs: options?.timeoutMs ?? 10_000,
  });
}
