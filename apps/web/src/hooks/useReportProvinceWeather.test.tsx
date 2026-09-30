import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findVietnamProvinceByName, type ReportPointResponse, type ReportLevel } from "@vietnam-weather/contracts";
import { getAllProvincesData } from "@/data/vietnamGeoJsonWGS84";
import { apiClient } from "@/api/client";
import { useReportProvinceWeather } from "./useReportProvinceWeather";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn() } }));
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const targetTime = "2026-09-30T12:00:00Z";
function response() {
  const levels: ReportLevel[] = ["low", "caution", "high", "unknown"];
  return { data: { target_time: targetTime, provinces: getAllProvincesData().slice(0, 4).map((province, index) => {
    const severity = ([1, 2, 3, 0] as const)[index]!;
    const point: ReportPointResponse = {
      weather: {
        temperature_c: 26, rain_mm_per_hour: null, gust_kmh: 0, visibility_m: 10000,
        humidity_percent: 75, condition_code: "rain", storm: null, official_alert_level: null,
        freshness: "fresh", coverage: "covered", source: "provider", source_time: targetTime,
        valid_from: targetTime, valid_to: "2026-09-30T13:00:00Z", reasons: [],
      },
      assessment: {
        level: levels[index]!, severity, score: severity ? severity / 3 : null,
        display_score: severity ? Math.round(severity / 3 * 100) : null, vehicle: null,
        rule_set_version: "general-weather-v1", freshness: "fresh", coverage: "covered",
        source: "provider", source_time: targetTime, reasons: [],
        evidence: [{ dimension: "temperature", severity, value: 26 }],
      },
    };
    return { id: findVietnamProvinceByName(province.name)!.id, name: province.name, ...point };
  }) } };
}
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.clearAllMocks(); });

describe("bulk province report data", () => {
  it("uses one general weather request and preserves levels, colors, measurements and target time", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(response());
    const { result } = renderHook(() => useReportProvinceWeather(0), { wrapper: wrapper() });
    await waitFor(() => expect(result.current[0]?.dataState).toBe("ready"));
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith("/risk/report-provinces?offset_hours=0", { signal: expect.any(AbortSignal) });
    expect(result.current.slice(0, 4).map(p => [p.riskLevel, p.riskColor, p.riskText])).toEqual([
      ["low", "#22C55E", "Rủi ro thấp"], ["caution", "#F59E0B", "Cần chú ý"],
      ["high", "#EF4444", "Nguy cơ cao"], ["unknown", "#64748B", "Chưa đủ dữ liệu"],
    ]);
    for (const province of result.current.slice(0, 4)) {
      expect(province).toMatchObject({ weatherTargetTime: targetTime, temp: 26, windGustKmh: 0, humidity: 75 });
    }
    expect(result.current[3]?.riskScore).toBeNull();
  });

  it("requests the selected offset and clears previous values during timeline debounce", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(response());
    const { result, rerender } = renderHook(({ offset }) => useReportProvinceWeather(offset), {
      initialProps: { offset: 1 }, wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current[0]?.dataState).toBe("ready"));
    expect(apiClient.get).toHaveBeenLastCalledWith("/risk/report-provinces?offset_hours=1", expect.any(Object));
    rerender({ offset: 24 });
    expect(result.current[0]?.dataState).toBe("loading");
    expect(result.current[0]?.temp).toBeNaN();
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith("/risk/report-provinces?offset_hours=24", expect.any(Object)));
    await waitFor(() => expect(result.current[0]?.dataState).toBe("ready"));
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(result.current[0]?.weatherTargetTime).toBe(targetTime);
  });

  it("clears cached temperature and risk when a background refresh fails", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(response());
    const { result } = renderHook(() => useReportProvinceWeather(0), { wrapper: wrapper() });
    await waitFor(() => expect(result.current[0]?.dataState).toBe("ready"));
    expect(result.current[0]?.temp).toBe(26);
    vi.mocked(apiClient.get).mockRejectedValue(new Error("Weather service unavailable"));
    const client = clients.at(-1);
    if (!client) throw new Error("Missing query client");
    await act(async () => { await client.invalidateQueries({ queryKey: ["report-provinces"] }); });
    await waitFor(() => expect(result.current[0]?.dataState).toBe("error"));
    expect(result.current[0]?.temp).toBeNaN();
    expect(result.current[0]?.riskLevel).toBe("unknown");
    expect(result.current[0]?.weatherTargetTime).toBeUndefined();
  });
});
