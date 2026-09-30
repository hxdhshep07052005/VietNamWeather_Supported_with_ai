import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeApi } from "@/api/client";
import { RoutePlannerPage } from "./RoutePlannerPage";
import { useReportProvinceWeather } from "@/hooks/useReportProvinceWeather";
import { getAllProvincesData, type ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";

const mapState = vi.hoisted(() => ({ routeType: "", provinces: [] as readonly ProvinceGeoFeatureProperties[] }));
const auth = vi.hoisted(() => ({ user: { plan: "pro", dailyRouteCount: 0, savedRoutes: [] }, isAuthenticated: true, saveRoute: vi.fn(), incrementRouteCount: vi.fn(() => ({ allowed: true })) }));
vi.mock("@/api/client", () => ({ routeApi: { calculateRoutes: vi.fn() } }));
vi.mock("@/hooks/useAuthStore", () => ({ useAuthStore: () => auth }));
vi.mock("@/hooks/useRequireLoginModal", () => ({ useRequireLoginModal: () => ({ openModal: vi.fn() }) }));
vi.mock("@/hooks/useReportProvinceWeather", () => ({ useReportProvinceWeather: vi.fn(() => []) }));
vi.mock("@/components/map/RouteInteractiveMap", () => ({ RouteInteractiveMap: (props: { routeType?: string; provinces?: readonly ProvinceGeoFeatureProperties[] }) => { mapState.routeType = props.routeType ?? ""; mapState.provinces = props.provinces ?? []; return null; } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: () => "", i18n: { language: "en" } }) }));

beforeEach(() => {
  vi.mocked(useReportProvinceWeather).mockReturnValue([]);
  vi.mocked(routeApi.calculateRoutes).mockResolvedValue({ status: "success" });
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 16.07, longitude: 108.21, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, timestamp: Date.now(), toJSON: () => ({}) }) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function mountRoute() {
  render(<MemoryRouter><RoutePlannerPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("button", { name: "Find Safe Route" })).toBeEnabled());
}

describe("route request inputs", () => {
  it("uses the same current general-weather province overlay as Map", async () => {
    const provinces = getAllProvincesData().map(province => ({ ...province, dataState: "ready" as const }));
    vi.mocked(useReportProvinceWeather).mockReturnValue(provinces);
    await mountRoute();
    expect(useReportProvinceWeather).toHaveBeenCalledWith(0);
    expect(mapState.provinces).toEqual(provinces);
  });
  it("retries pending weather without extra quota and stops after inputs change", async () => {
    vi.useFakeTimers();
    const response = { status: "success" as const, weather_refresh: { status: "pending", requested_points: 3, retry_after_seconds: 5 }, alternatives: [{ alternative_type: "fastest", geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] }, route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 1 }, summary: { vi: "", en: "Partial" }, segment_risks: [], sample_points: [] }] };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await act(async () => { render(<MemoryRouter><RoutePlannerPage /></MemoryRouter>); });
    expect(screen.getByText(/Refreshing weather along the route/)).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(2);
    expect(auth.incrementRouteCount).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("Enter origin (e.g., Hanoi)..."), { target: { value: "Huế" } });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(2);
  });
  it("stops pending refresh after unmount", async () => {
    vi.useFakeTimers();
    const response = { status: "success" as const, weather_refresh: { status: "pending", requested_points: 3, retry_after_seconds: 5 }, alternatives: [{ alternative_type: "fastest", geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] }, route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 1 }, summary: { vi: "", en: "Partial" }, segment_risks: [], sample_points: [] }] };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await act(async () => { render(<MemoryRouter><RoutePlannerPage /></MemoryRouter>); });
    expect(screen.getByText(/Refreshing weather along the route/)).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(2);
    expect(auth.incrementRouteCount).not.toHaveBeenCalled();
    cleanup();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(2);
  });
  it("keeps interim result when refreshing fails", async () => {
    vi.useFakeTimers();
    const response = { status: "success" as const, weather_refresh: { status: "pending", requested_points: 3, retry_after_seconds: 5 }, alternatives: [{ alternative_type: "fastest", geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] }, route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 1 }, summary: { vi: "", en: "Partial" }, segment_risks: [], sample_points: [] }] };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValueOnce(response).mockRejectedValueOnce(new Error("Temporary outage"));
    await act(async () => { render(<MemoryRouter><RoutePlannerPage /></MemoryRouter>); });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Weather refresh is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find Safe Route" })).toBeEnabled();
    expect(screen.getByText("1 alternative")).toBeInTheDocument();
  });
  it("bounds pending refresh to six retries", async () => {
    vi.useFakeTimers();
    const response = { status: "success" as const, weather_refresh: { status: "pending", requested_points: 3, retry_after_seconds: 5 }, alternatives: [{ alternative_type: "fastest", geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] }, route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 1 }, summary: { vi: "", en: "Partial" }, segment_risks: [], sample_points: [] }] };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await act(async () => { render(<MemoryRouter><RoutePlannerPage /></MemoryRouter>); });
    for (let retry = 0; retry < 7; retry++) await act(async () => { vi.advanceTimersByTime(5000); });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(7);
    expect(screen.getByText(/Weather refresh is still processing/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find Safe Route" })).toBeEnabled();
  });
  it("shows provisional scores and coverage while strict risk stays unknown", async () => {
    const response = { status: "success" as const, recommended_alternative: "weather_safer", alternatives: ["fastest", "weather_safer"].map(alternative_type => ({
      alternative_type, balanced_score: 0.71, geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] },
      route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 1, provisional: { score: 0.42, observed_score: 0.33, coverage_percent: 85, rule_set_version: "provisional-v1" } }, summary: { vi: "", en: "Partial evidence" }, segment_risks: [],
      sample_points: [{ distance_from_start_meters: 15000, time_from_departure_seconds: 900, eta: "2026-09-30T02:15:00Z", coordinates: { latitude: 21, longitude: 105 }, assessment: { level: "unknown", severity: 0, reasons: ["forecast_visibility_unavailable"], evidence: [] }, provisional_assessment: { level: "low", display_score: 33, severity: 1, reasons: ["general_weather_partial_evidence"], evidence: [] } }],
    })) };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await mountRoute();
    expect(mapState.routeType).toBe("weather_safer");
    const alternatives = within(screen.getByRole("region", { name: "Travel Alternatives" }));
    const scores = alternatives.getAllByRole("group", { name: "ETA score" });
    expect(scores).toHaveLength(2);
    for (const score of scores) {
      expect(score).toHaveTextContent("71/100");
      expect(score).toHaveAttribute("data-risk-level", "low");
      expect(score).toHaveTextContent("Provisional");
      expect(score).toHaveTextContent("Weather coverage: 85%");
      expect(score).toHaveTextContent("risk from available weather");
      expect(score.parentElement).toHaveTextContent(/Distance.*Duration.*ETA score/);
      expect(score).toHaveTextContent("Missing spatial segments are conservatively penalized");
    }
    expect(alternatives.queryByText("ETA Risk")).not.toBeInTheDocument();
    expect(alternatives.getByText("Combined score: lower is better. Color shows weather risk.")).toBeInTheDocument();
    expect(alternatives.queryByText(/42\/100/)).not.toBeInTheDocument();
    expect(screen.getByText("Low risk · provisional")).toBeInTheDocument();
    expect(screen.queryByText("Risk at ETA: Safe")).not.toBeInTheDocument();
    const fastest = alternatives.getByRole("button", { name: "Select Fastest route" });
    expect(fastest).toHaveAttribute("aria-pressed", "false");
    expect(fastest).toHaveAccessibleDescription(/Distance.*30 km.*ETA score.*71\/100.*Weather coverage: 85%/);
    fireEvent.click(fastest);
    expect(fastest).toHaveAttribute("aria-pressed", "true");
    expect(mapState.routeType).toBe("fastest");
  });

  it.each([
    { level: "low", balanced: 0.92, label: "Low" },
    { level: "caution", balanced: 0.1, label: "Caution" },
    { level: "high", balanced: 0.34, label: "Dangerous" },
  ])("colors the route score by $level risk instead of balanced score bands", async ({ level, balanced, label }) => {
    const response = { status: "success" as const, alternatives: [{
      alternative_type: "fastest", balanced_score: balanced,
      geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] },
      route_risk: { level, score: 0.5 }, summary: { vi: "", en: "Weather assessment" }, segment_risks: [], sample_points: [],
    }] };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await mountRoute();
    const score = within(screen.getByRole("region", { name: "Travel Alternatives" })).getByRole("group", { name: "ETA score" });
    expect(score).toHaveAttribute("data-risk-level", level);
    expect(score).toHaveTextContent(label);
    expect(score).toHaveTextContent(`${Math.round(balanced * 100)}/100`);
    expect(score).toHaveTextContent("Lower score is better");
  });


  it("shows checkpoint risk, readable evidence gaps and exact Vietnam ETA", async () => {
    const response = { status: "success" as const, rest_stops: { status: "available", route_type: "fastest", source: "OpenStreetMap", items: [{ id: "node/123", name: "Example Rest Area", coordinates: { latitude: 21, longitude: 105 }, distance_from_start_meters: 15000, source_url: "https://www.openstreetmap.org/node/123" }] }, alternatives: [{
      alternative_type: "fastest", geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] },
      route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 1 }, summary: { vi: "", en: "Insufficient data" }, segment_risks: [],
      sample_points: [{ distance_from_start_meters: 24960.6896551724, time_from_departure_seconds: 900, eta: "2026-09-30T02:15:00Z", coordinates: { latitude: 21, longitude: 105 }, assessment: { level: "unknown", severity: 0, reasons: ["forecast_visibility_unavailable"], evidence: [] } }],
    }] };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await mountRoute();
    const weather = within(screen.getByRole("region", { name: "Weather checkpoints" }));
    expect(weather.getByText("Insufficient data")).toBeVisible();
    expect(weather.getByText("25 km")).toBeInTheDocument();
    expect(screen.queryByText(/24\.960689/)).not.toBeInTheDocument();
    expect(weather.getByText("09:15 · 30/09")).toBeVisible();
    const evidence = weather.getByText("Forecast visibility is unavailable.");
    expect(evidence).not.toBeVisible();
    fireEvent.click(weather.getByText("Weather details"));
    expect(evidence).toBeVisible();
    expect(weather.getByText(/09:15.*30\/09\/2026/)).toBeVisible();
    const stops = within(screen.getByRole("region", { name: "Rest stops near the fastest route" }));
    expect(stops.getByRole("link", { name: /Example Rest Area/ })).toHaveAttribute("href", "https://www.openstreetmap.org/node/123");
    expect(stops.getByText(/Check the entrance before stopping/)).toBeInTheDocument();
    expect(stops.queryByText("Weather details")).not.toBeInTheDocument();
  });

  it("shows the returned alternative count and explains unavailable weather ranking", async () => {
    const response = { status: "success" as const, alternatives: ["fastest", "shortest"].map(alternative_type => ({
      alternative_type, geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] },
      route_risk: { level: "unknown", score: null, unknown_checkpoint_count: 3 },
      summary: { vi: "", en: "Insufficient data" }, segment_risks: [],
      sample_points: [0, 15000, 30000].map(distance_from_start_meters => ({ distance_from_start_meters, time_from_departure_seconds: distance_from_start_meters / 20, coordinates: { latitude: 21, longitude: 105 } })),
    })) };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await mountRoute();
    expect(screen.getByText("2 alternatives")).toBeInTheDocument();
    expect(screen.getByText("Rest-stop locations are unavailable right now.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("weather coverage is incomplete");
    expect(screen.getByText("Weather sample · km 15")).toBeInTheDocument();
    expect(screen.queryByText(/Trạm dừng nghỉ/)).not.toBeInTheDocument();
  });

  it("selects the backend recommended alternative", async () => {
    const response = { status: "success" as const, recommended_alternative: "weather_safer", alternatives: ["fastest", "weather_safer"].map(alternative_type => ({
      alternative_type, geometry: { distance_meters: 30000, duration_seconds: 1800, coordinates: [{ latitude: 21, longitude: 105 }, { latitude: 21.2, longitude: 105.2 }] },
      route_risk: { level: "low", score: 1 / 3, unknown_checkpoint_count: 0 }, summary: { vi: "", en: "Low weather risk" }, segment_risks: [], sample_points: [],
    })) };
    vi.mocked(routeApi.calculateRoutes).mockResolvedValue(response);
    await mountRoute();
    expect(mapState.routeType).toBe("weather_safer");
    expect(screen.getByText(/Uses the same road as another option/)).toBeInTheDocument();
  });

  it("uses a linked destination for the initial request", async () => {
    render(<MemoryRouter initialEntries={["/route?to=%C4%90%C3%A0%20N%E1%BA%B5ng"]}><RoutePlannerPage /></MemoryRouter>);
    await waitFor(() => expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(1));
    expect(routeApi.calculateRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ destination: { query: "Đà Nẵng" } }));
  });

  it("ignores an earlier request failure after the input changes", async () => {
    let rejectRequest: (error: Error) => void = () => {};
    vi.mocked(routeApi.calculateRoutes).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    render(<MemoryRouter><RoutePlannerPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("Enter origin (e.g., Hanoi)..."), { target: { value: "Huế" } });
    rejectRequest(new Error("Old request failed"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Find Safe Route" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(1);
  });

  it("does not submit edits before an explicit plan action", async () => {
    await mountRoute();
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByPlaceholderText("Enter origin (e.g., Hanoi)..."), { target: { value: "Đà Nẵng" } });
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Find Safe Route" }));
    await waitFor(() => expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(2));
    expect(routeApi.calculateRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { query: "Đà Nẵng" } }));
  });

  it("uses GPS coordinates and preserves them when swapped to destination", async () => {
    await mountRoute();
    fireEvent.click(screen.getByRole("button", { name: "Origin Location" }));
    expect(routeApi.calculateRoutes).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Find Safe Route" }));
    await waitFor(() => expect(routeApi.calculateRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { coordinates: { latitude: 16.07, longitude: 108.21 } } })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Find Safe Route" })).toBeEnabled());
    fireEvent.click(screen.getByTitle("Swap origin and destination"));
    fireEvent.click(screen.getByRole("button", { name: "Find Safe Route" }));
    await waitFor(() => expect(routeApi.calculateRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { query: "Lào Cai" }, destination: { coordinates: { latitude: 16.07, longitude: 108.21 } } })));
  });

  it("clears stale GPS coordinates when the origin text changes", async () => {
    await mountRoute();
    fireEvent.click(screen.getByRole("button", { name: "Origin Location" }));
    fireEvent.change(screen.getByPlaceholderText("Enter origin (e.g., Hanoi)..."), { target: { value: "Huế" } });
    fireEvent.click(screen.getByRole("button", { name: "Find Safe Route" }));
    await waitFor(() => expect(routeApi.calculateRoutes).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { query: "Huế" } })));
  });
});
