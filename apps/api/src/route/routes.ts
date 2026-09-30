/**
 * Phase 8 Route Routes
 * API endpoints for weather-aware route planning
 *
 * Decisions: ROUTE-001..008, ARCH-001..003
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { RouteRequest, RouteResponse } from "@vietnam-weather/contracts";

import { ApiError, type ApiErrorCode } from "../errors.js";
import type { RouteService } from "./route-service.js";
import { RouteServiceError } from "./route-service.js";

export interface RouteRoutesOptions {
  readonly routeService: RouteService;
  readonly defaultRateLimitMax?: number;
  readonly rateLimitWindowMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRouteRequest(body: unknown): RouteRequest {
  if (!isRecord(body)) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Request body is required");
  }

  if (!body.origin || !isRecord(body.origin)) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Origin is required");
  }

  if (!body.destination || !isRecord(body.destination)) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Destination is required");
  }

  const origin = body.origin as Record<string, unknown>;
  const destination = body.destination as Record<string, unknown>;

  const hasOriginCoords = isRecord(origin.coordinates) &&
    typeof origin.coordinates.latitude === "number" &&
    typeof origin.coordinates.longitude === "number";
  const hasOriginQuery = typeof origin.query === "string" && origin.query.trim().length > 0;
  const hasOriginPlace = typeof origin.place_id === "string";

  if (!hasOriginCoords && !hasOriginQuery && !hasOriginPlace) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Origin must have coordinates, query, or place_id");
  }

  const hasDestCoords = isRecord(destination.coordinates) &&
    typeof destination.coordinates.latitude === "number" &&
    typeof destination.coordinates.longitude === "number";
  const hasDestQuery = typeof destination.query === "string" && destination.query.trim().length > 0;
  const hasDestPlace = typeof destination.place_id === "string";

  if (!hasDestCoords && !hasDestQuery && !hasDestPlace) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Destination must have coordinates, query, or place_id");
  }

  if (body.vehicle_type !== "car" && body.vehicle_type !== "motorcycle") {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Select car or motorcycle");
  }
  if (body.departure_time !== undefined && (typeof body.departure_time !== "string" || !Number.isFinite(Date.parse(body.departure_time)))) {
    throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid departure time");
  }
  const location = (value: Record<string, unknown>): RouteRequest["origin"] => {
    if (isRecord(value.coordinates)) {
      const { latitude, longitude } = value.coordinates;
      if (typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw new ApiError(400, "VALIDATION_FAILED", false, "Invalid coordinates");
      }
      return { type: "coordinates", value: { latitude, longitude } };
    }
    if (typeof value.query !== "string" || !value.query.trim()) throw new ApiError(400, "VALIDATION_FAILED", false, "Location query required");
    return { type: "text", value: value.query.trim() };
  };
  return { origin: location(origin), destination: location(destination), vehicle_type: body.vehicle_type,
    departure_time: body.departure_time as string | undefined };
}

export function buildRouteRoutes(app: FastifyInstance, options: RouteRoutesOptions): void {
  const { routeService, defaultRateLimitMax = 60, rateLimitWindowMs = 60_000 } = options;

  /**
   * POST /api/v1/route/calculate
   * Weather-aware multi-alternative route calculation
   */
  app.post(
    "/api/v1/route/calculate",
    {
      config: {
        rateLimit: {
          max: defaultRateLimitMax,
          timeWindow: rateLimitWindowMs,
        },
      },
    },
    async (request: FastifyRequest): Promise<{ data: RouteResponse }> => {
      const validatedBody = validateRouteRequest(request.body);

      try {
        const response = await routeService.calculateRoutes(validatedBody);
        return { data: response };
      } catch (error) {
        request.log.error({ err: error }, "Failed to calculate routes");
        if (error instanceof RouteServiceError) {
          let errorCode: ApiErrorCode = "ROUTE_PROVIDER_ERROR";
          let statusCode = 502;

          if (error.code === "ROUTE_TOO_LONG") {
            errorCode = "ROUTE_TOO_LONG";
            statusCode = 400;
          } else if (error.code === "INVALID_REQUEST") {
            errorCode = "VALIDATION_FAILED";
            statusCode = 400;
          } else if (error.code === "GEOCODING_FAILED" || error.code === "ROUTE_INVALID_ORIGIN" || error.code === "ROUTE_INVALID_DESTINATION") {
            errorCode =
              error.code === "ROUTE_INVALID_ORIGIN"
                ? "ROUTE_INVALID_ORIGIN"
                : error.code === "ROUTE_INVALID_DESTINATION"
                ? "ROUTE_INVALID_DESTINATION"
                : "ROUTE_GEOCODING_FAILED";
            statusCode = 404;
          } else if (error.code === "ROUTING_FAILED") {
            errorCode = "ROUTE_ROUTING_FAILED";
            statusCode = 502;
          }

          throw new ApiError(statusCode, errorCode, error.retryable, error.message);
        }
        throw error;
      }
    }
  );
}
