import type { FastifyInstance, FastifyRequest } from "fastify";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import {
  isWeatherQueryRequest,
  parseWeatherQueryRequest,
  safeParseWeatherQueryRequest,
  type WeatherCapabilitiesResponse,
  type WeatherQueryRequest,
  type WeatherQueryResponse
} from "@vietnam-weather/contracts";

import { ApiError } from "../errors.js";
import type { WeatherService } from "../weather-service.js";
import type { WeatherCache } from "../weather-cache.js";
import { WeatherStore } from "../weather-store.js";
import {
  DEFAULT_FRESHNESS
} from "./constants.js";

export interface WeatherRoutesOptions {
  readonly service: WeatherService;
  readonly store: WeatherStore;
  readonly cache: WeatherCache | null;
  readonly defaultRateLimitMax: number;
  readonly rateLimitWindowMs: number;
  readonly weatherRateLimitMax: number;
}

function readWeatherQueryBody(value: unknown): WeatherQueryRequest {
  // Use the contracts validator first so unknown properties, missing
  // include arrays, and coordinate-out-of-range errors are caught at
  // the edge with a stable 400 + VALIDATION_FAILED code.
  const parsed = safeParseWeatherQueryRequest(value);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid weather query request");
  }
  return parseWeatherQueryRequest(value);
}

function readWeatherTarget(value: unknown): WeatherQueryRequest["target"] {
  if (typeof value !== "object" || value === null) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid weather target");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.locationId === "string") {
    if (!isUuid(record.locationId)) {
      throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid locationId");
    }
    return { locationId: record.locationId };
  }
  if (
    typeof record.latitude === "number" &&
    typeof record.longitude === "number" &&
    Number.isFinite(record.latitude) &&
    Number.isFinite(record.longitude) &&
    record.latitude >= -90 &&
    record.latitude <= 90 &&
    record.longitude >= -180 &&
    record.longitude <= 180
  ) {
    return {
      coordinates: {
        latitude: record.latitude,
        longitude: record.longitude
      }
    };
  }
  throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid weather target");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function correlationId(request: FastifyRequest): string {
  return request.id;
}

/**
 * Register the Phase 5 / Phase 9 weather HTTP routes. Routes are scoped
 * under `/api/v1/weather/*` to match ARCH-002 contract versioning.
 */
export function buildWeatherRoutes(
  app: FastifyInstance,
  options: WeatherRoutesOptions
): void {
  const { service, defaultRateLimitMax, rateLimitWindowMs, weatherRateLimitMax } = options;
  const capabilitiesWindow = { max: defaultRateLimitMax, timeWindow: rateLimitWindowMs };
  const queryWindow = { max: weatherRateLimitMax, timeWindow: rateLimitWindowMs };

  app.get("/api/v1/weather/capabilities", {
    config: { rateLimit: capabilitiesWindow }
  }, async (request, reply): Promise<{ data: WeatherCapabilitiesResponse }> => {
    const cid = correlationId(request);
    const response = await service.capabilities(cid);
    reply.header("cache-control", "public, max-age=30, stale-while-revalidate=120");
    return { data: response };
  });

  app.post("/api/v1/weather/query", {
    config: { rateLimit: queryWindow }
  }, async (request, reply): Promise<{ data: WeatherQueryResponse }> => {
    const cid = correlationId(request);
    const parsedRequest = readWeatherQueryBody(request.body);
    const response = await service.query(parsedRequest, cid);
    reply.header("cache-control", "public, max-age=20, stale-while-revalidate=60");
    return { data: response };
  });

  app.get("/api/v1/weather/observation", {
    config: { rateLimit: queryWindow }
  }, async (request, reply): Promise<{ data: WeatherQueryResponse }> => {
    const cid = correlationId(request);
    const query = isRecord(request.query) ? request.query : {};
    const target = readWeatherTarget({
      locationId: query.locationId,
      latitude: query.latitude !== undefined ? Number(query.latitude) : undefined,
      longitude: query.longitude !== undefined ? Number(query.longitude) : undefined
    });
    // Observation-only poll is the cheapest subscription the front-end
    // info panel needs: weather freshness + current reading, no hourly.
    const observationRequest: WeatherQueryRequest = {
      target,
      include: ["current"],
      freshness: "fresh"
    };
    if (!isWeatherQueryRequest(observationRequest)) {
      throw new ApiError(500, "VALIDATION_FAILED", false, "Weather request shape rejected");
    }
    const response = await service.query(observationRequest, cid);
    reply.header("cache-control", "public, max-age=15, stale-while-revalidate=30");
    return { data: response };
  });

  // Suppress unused-import lint when the file ships in environments
  // that exercise different code paths.
  void DEFAULT_FRESHNESS;
}
