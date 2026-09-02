/**
 * useProvinceWeather — TanStack Query hook for province weather observation.
 * Phase 9 — split-pane map layout.
 *
 * Accepts either a location UUID (locationId) or WGS-84 coordinates.
 * Coordinates are preferred — they don't require a pre-registered location
 * in the database and work immediately for any province centroid.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { CurrentWeatherSection } from "@vietnam-weather/contracts";

const WEATHER_STALE_TIME = 1000 * 60 * 2;   // 2 min
const WEATHER_GC_TIME    = 1000 * 60 * 15;  // 15 min

export interface WeatherResponse {
  data: {
    status: "success" | "degraded" | "pending" | "error" | "unavailable";
    data: {
      current: CurrentWeatherSection | null;
    };
    correlationId: string;
  };
}

export interface ProvinceWeatherTarget {
  locationId?: string;
  latitude?: number;
  longitude?: number;
}

async function fetchWeatherByCoords(lat: number, lng: number): Promise<WeatherResponse> {
  return apiClient.get<WeatherResponse>(
    `/weather/observation?latitude=${lat}&longitude=${lng}`
  );
}

async function fetchWeatherByLocationId(locationId: string): Promise<WeatherResponse> {
  return apiClient.get<WeatherResponse>(
    `/weather/observation?locationId=${encodeURIComponent(locationId)}`
  );
}

export function useProvinceWeather(target: ProvinceWeatherTarget) {
  const { locationId, latitude, longitude } = target;
  const hasCoords = latitude !== undefined && longitude !== undefined;

  return useQuery({
    queryKey: ["province-weather", locationId, latitude, longitude] as const,
    queryFn: () => {
      if (hasCoords) {
        return fetchWeatherByCoords(latitude!, longitude!);
      }
      if (locationId) {
        return fetchWeatherByLocationId(locationId);
      }
      throw new Error("Either coordinates or locationId is required");
    },
    enabled: hasCoords || Boolean(locationId),
    staleTime: WEATHER_STALE_TIME,
    gcTime: WEATHER_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
