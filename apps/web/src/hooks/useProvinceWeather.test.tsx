import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HourlyWeatherValue } from "@vietnam-weather/contracts";
import { apiClient } from "@/api/client";
import { forecastHours, useProvinceWeather, weatherPollingInterval, weatherSectionState, type WeatherResponse } from "./useProvinceWeather";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const terminal = (status: WeatherResponse["data"]["status"]): WeatherResponse => ({ data: { status, correlationId: "test" } });

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("province weather polling and section eligibility", () => {
  it("honors retryAfterSeconds only while the domain response is pending", () => {
    expect(weatherPollingInterval({ data: { status: "pending", correlationId: "test", retryAfterSeconds: 7 } })).toBe(7000);
    expect(weatherPollingInterval(terminal("pending"))).toBe(5000);
    expect(weatherPollingInterval({ data: { status: "pending", correlationId: "test", retryAfterSeconds: 0 } })).toBe(5000);
    for (const status of ["success", "degraded", "unavailable", "error"] as const) {
      expect(weatherPollingInterval(terminal(status))).toBe(false);
    }
  });

  it("polls a pending forecast at the server interval, then stops on unavailable", async () => {
    vi.useFakeTimers();
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { status: "pending", correlationId: "test", retryAfterSeconds: 3 } })
      .mockResolvedValueOnce(terminal("unavailable"));
    const { result } = renderHook(() => useProvinceWeather({ latitude: 21, longitude: 105, includeForecast: true }), { wrapper: wrapper() });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.hourlyState).toBe("pending");
    await act(async () => { await vi.advanceTimersByTimeAsync(2998); });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(result.current.hourlyState).toBe("unavailable");
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it("gates current, hourly and daily independently on displayEligible", async () => {
    const response = { data: { status: "degraded", correlationId: "test", data: {
      current: { freshness: { displayEligible: false }, value: { temperatureCelsius: 99 } },
      hourly: { freshness: { displayEligible: true }, values: [{ temperatureCelsius: 25 }] },
      daily: { freshness: { displayEligible: false }, values: [{ maximumTemperatureCelsius: 99 }] },
    } } } as unknown as WeatherResponse;
    vi.mocked(apiClient.post).mockResolvedValue(response);
    const { result } = renderHook(() => useProvinceWeather({ latitude: 21, longitude: 105, includeForecast: true }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.current).toBeNull();
    expect(result.current.hourly).toEqual([{ temperatureCelsius: 25 }]);
    expect(result.current.daily).toEqual([]);
    expect(result.current.currentState).toBe("unavailable");
    expect(result.current.hourlyState).toBe("ready");
    expect(weatherSectionState(terminal("error"), "hourly")).toBe("error");
    expect(weatherSectionState(terminal("unavailable"), "current")).toBe("unavailable");
  });

  it("does not reuse a previous location's weather while the next request is pending", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { status: "success", correlationId: "test", data: {
      current: { freshness: { displayEligible: true }, value: { temperatureCelsius: 25 } },
    } } }).mockResolvedValueOnce(terminal("pending"));
    const { result, rerender } = renderHook(({ latitude }) => useProvinceWeather({ latitude, longitude: 105 }), { initialProps: { latitude: 21 }, wrapper: wrapper() });
    await waitFor(() => expect(result.current.current?.temperatureCelsius).toBe(25));
    rerender({ latitude: 10 });
    expect(result.current.current).toBeNull();
    await waitFor(() => expect(result.current.currentState).toBe("pending"));
  });

  it("filters real forecast intervals without filling gaps or inventing time slots", () => {
    const now = Date.parse("2026-09-30T00:00:00Z");
    const point = (from: number, to: number) => ({ validInterval: { from: new Date(now + from * 3600000).toISOString(), to: new Date(now + to * 3600000).toISOString() } }) as HourlyWeatherValue;
    const values = [point(25, 26), point(3, 4), point(-2, -1), point(0, 1)];
    expect(forecastHours(values, 24, now)).toEqual([values[3], values[1]]);
  });
});
