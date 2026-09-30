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
import type {
  CurrentWeatherSection,
  HourlyWeatherSection,
  DailyWeatherSection,
} from "@vietnam-weather/contracts";

const WEATHER_STALE_TIME = 1000 * 60 * 2;   // 2 min
const WEATHER_GC_TIME    = 1000 * 60 * 15;  // 15 min

export interface WeatherResponse {
  data: {
    status: "success" | "degraded" | "pending" | "error" | "unavailable";
    retryAfterSeconds?: number;
    data?: {
      current: CurrentWeatherSection | null;
      hourly?: HourlyWeatherSection | null;
      daily?: DailyWeatherSection | null;
    };
    issues?: readonly unknown[];
    error?: {
      code: string;
      message: string;
      correlationId: string;
      retryable: boolean;
    };
    correlationId: string;
  };
}

export interface ProvinceWeatherTarget {
  locationId?: string;
  latitude?: number;
  longitude?: number;
  includeForecast?: boolean;
  enabled?: boolean;
}

export type WeatherSectionState = "ready" | "loading" | "pending" | "unavailable" | "error";

export function weatherStateText(state: WeatherSectionState, isEn = false): string {
  const messages: Record<WeatherSectionState, [string, string]> = {
    ready: ["Dữ liệu thời tiết hiện có", "Weather data available"],
    loading: ["Đang tải dữ liệu thời tiết…", "Loading weather data…"],
    pending: ["Nguồn thời tiết đang xử lý yêu cầu. Sẽ tự động thử lại.", "Weather request pending. Retrying automatically."],
    unavailable: ["Chưa có dữ liệu thời tiết đủ điều kiện hiển thị cho mục này.", "No display-eligible weather data is available for this section."],
    error: ["Không tải được dữ liệu thời tiết. Vui lòng thử lại.", "Weather request failed. Please retry."],
  };
  return messages[state][isEn ? 1 : 0];
}

export function weatherPollingInterval(response?: WeatherResponse): number | false {
  if (response?.data.status !== "pending") return false;
  const seconds = response.data.retryAfterSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? Math.max(1000, seconds * 1000)
    : 5000;
}

/** Use actual valid intervals, rather than treating the first N points as N future hours. */
export function forecastHours(values: HourlyWeatherSection["values"], hours: number, now = Date.now()) {
  return values.filter(item => {
    const from = Date.parse(item.validInterval.from);
    const to = Date.parse(item.validInterval.to);
    return Number.isFinite(from) && Number.isFinite(to) && to > now && from < now + hours * 3600000;
  }).sort((a, b) => Date.parse(a.validInterval.from) - Date.parse(b.validInterval.from));
}

export function weatherSectionState(
  response: WeatherResponse | undefined,
  section: "current" | "hourly" | "daily",
  isLoading = false,
  isError = false,
): WeatherSectionState {
  if (isError || response?.data.status === "error") return "error";
  if (isLoading) return "loading";
  if (response?.data.status === "pending") return "pending";
  if (response?.data.status !== "success" && response?.data.status !== "degraded") return "unavailable";
  const data = response.data.data?.[section];
  if (!data?.freshness.displayEligible) return "unavailable";
  if ("values" in data && data.values.length === 0) return "unavailable";
  return "ready";
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

async function fetchWeatherForecast(target: ProvinceWeatherTarget): Promise<WeatherResponse> {
  const hasCoords = target.latitude !== undefined && target.longitude !== undefined;
  const payloadTarget = hasCoords
    ? { coordinates: { latitude: target.latitude!, longitude: target.longitude! } }
    : { locationId: target.locationId! };

  return apiClient.post<WeatherResponse>("/weather/query", {
    target: payloadTarget,
    include: ["current", "hourly", "daily"],
  });
}

export function useProvinceWeather(target: ProvinceWeatherTarget) {
  const { locationId, latitude, longitude, includeForecast, enabled = true } = target;
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  const query = useQuery({
    queryKey: ["province-weather", locationId, latitude, longitude, includeForecast] as const,
    queryFn: () => {
      if (includeForecast) {
        return fetchWeatherForecast(target);
      }
      if (hasCoords) {
        return fetchWeatherByCoords(latitude!, longitude!);
      }
      if (locationId) {
        return fetchWeatherByLocationId(locationId);
      }
      throw new Error("Either coordinates or locationId is required");
    },
    enabled: enabled && (hasCoords || Boolean(locationId)),
    staleTime: WEATHER_STALE_TIME,
    gcTime: WEATHER_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.error ? false : weatherPollingInterval(query.state.data),
  });

  const currentState = weatherSectionState(query.data, "current", query.isLoading, query.isError);
  const hourlyState = weatherSectionState(query.data, "hourly", query.isLoading, query.isError);
  const dailyState = weatherSectionState(query.data, "daily", query.isLoading, query.isError);
  return {
    ...query,
    currentState,
    hourlyState,
    dailyState,
    current: currentState === "ready" ? query.data?.data.data?.current?.value ?? null : null,
    hourly: hourlyState === "ready" ? query.data?.data.data?.hourly?.values ?? [] : [],
    daily: dailyState === "ready" ? query.data?.data.data?.daily?.values ?? [] : [],
  };
}
