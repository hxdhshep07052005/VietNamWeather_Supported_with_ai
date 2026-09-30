import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportAssessment } from "@vietnam-weather/contracts";
import { getProvincePropertiesByCode, type ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { apiClient } from "@/api/client";
import { WeatherPage } from "./WeatherPage";
import { LocationPage } from "./LocationPage";
import { ProvinceStatusDetail } from "@/components/province/ProvinceStatusDetail";

const state = vi.hoisted(() => ({ provinces: [] as ProvinceGeoFeatureProperties[] }));
vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/hooks/useReportProvinceWeather", () => ({ useReportProvinceWeather: () => state.provinces }));
vi.mock("@/hooks/useAuthStore", () => ({ useAuthStore: () => ({ isAuthenticated: true, user: { savedLocations: [] }, saveLocation: vi.fn(), removeSavedLocation: vi.fn() }) }));
vi.mock("@/hooks/useRequireLoginModal", () => ({ useRequireLoginModal: () => ({ openModal: vi.fn() }) }));
vi.mock("@/components/common/ForecastTimelineSlider", () => ({ ForecastTimelineSlider: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: () => "", i18n: { language: "en" } }) }));

const assessment: ReportAssessment = {
  level: "unknown", severity: 0, score: null, display_score: null, vehicle: "car",
  rule_set_version: "report-v1", freshness: "fresh", coverage: "covered", source: "test",
  source_time: "2026-09-30T00:00:00Z", reasons: ["official_alert_source_not_integrated"],
  evidence: [{ dimension: "rain", severity: 3, value: 35 }, { dimension: "alert", severity: 0, value: null }],
};

function forecastResponse(eligible = true) {
  return { data: { status: "degraded", correlationId: "test", data: {
    current: { freshness: { displayEligible: false }, value: { temperatureCelsius: 99, uvIndex: 99 } },
    hourly: { freshness: { displayEligible: eligible }, values: [{
      validInterval: { from: new Date(Date.now() + 3600000).toISOString(), to: new Date(Date.now() + 7200000).toISOString() },
      temperatureCelsius: 17, precipitationProbabilityPercent: 82, conditionCode: "rain",
    }] }, daily: null,
  } } };
}

function wrapper(path = "/weather") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>;
}

beforeEach(() => {
  state.provinces = [{ ...getProvincePropertiesByCode("HN")!, temp: 23, feelsLike: 24, rainProbabilityPercent: 41, dataState: "ready", assessment }];
  vi.mocked(apiClient.post).mockResolvedValue(forecastResponse());
  vi.mocked(apiClient.get).mockResolvedValue({ data: { assessment } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("weather display regressions", () => {
  it("keeps an open modal on the latest province and displays real hourly data", async () => {
    const { rerender } = render(<WeatherPage />, { wrapper: wrapper() });
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Details & 24h" }));
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText("23°C")).toBeInTheDocument();
    expect(within(modal).getByText("41%")).toBeInTheDocument();
    await waitFor(() => expect(within(modal).getByText("17°C")).toBeInTheDocument());
    expect(within(modal).getByText("82%")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/weather/query", expect.objectContaining({ target: { coordinates: { latitude: state.provinces[0]!.latitude, longitude: state.provinces[0]!.longitude } } }));
    state.provinces = [{ ...state.provinces[0]!, temp: 31, rainProbabilityPercent: 66 }];
    rerender(<WeatherPage />);
    expect(within(modal).queryByText("23°C")).not.toBeInTheDocument();
    expect(within(modal).getByText("31°C")).toBeInTheDocument();
    expect(within(modal).getByText("66%")).toBeInTheDocument();
    expect(within(modal).getByRole("list", { name: "Weather warnings" })).toHaveTextContent(/Rain\s*35\s*mm\/h\s*High risk/);
  });

  it("does not display ineligible modal forecasts or require a vehicle selection", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(forecastResponse(false));
    render(<WeatherPage />, { wrapper: wrapper() });
    expect(screen.queryByLabelText("Risk assessment vehicle:")).not.toBeInTheDocument();
    expect(screen.getByText("Unknown — insufficient evidence")).toBeInTheDocument();
    expect(screen.queryByText("Vehicle not selected")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details & 24h" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText(/No display-eligible weather/)).toBeInTheDocument());
    expect(screen.queryByText("17°C")).not.toBeInTheDocument();
    expect(screen.queryByText("82%")).not.toBeInTheDocument();
  });

  it("keeps selected forecast metrics consistent and never replaces them with current telemetry", async () => {
    render(<ProvinceStatusDetail province={state.provinces[0]!} onBack={vi.fn()} onToggleSave={vi.fn()} />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getByText("23°C")).toBeInTheDocument());
    expect(screen.queryByText("99°C")).not.toBeInTheDocument();
    expect(screen.getByText("TIER: UNKNOWN")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Weather warnings" })).toHaveTextContent(/Rain\s*35\s*mm\/h\s*High risk/);
    expect(screen.queryByText(/14-Day/)).not.toBeInTheDocument();
  });

  it("rounds real risk evidence and explains absent sources per dimension", async () => {
    const province = { ...state.provinces[0]!, assessment: { ...assessment, rule_set_version: "general-weather-v1", vehicle: null,
      reasons: ["official_alert_source_not_integrated", "observation_precipitation_interval_unspecified"],
      evidence: [
        { dimension: "wind" as const, severity: 1 as const, value: 17.7012 },
        { dimension: "rain" as const, severity: 0 as const, value: null },
        { dimension: "storm" as const, severity: 0 as const, value: null },
        { dimension: "alert" as const, severity: 0 as const, value: null },
      ],
    } };
    render(<ProvinceStatusDetail province={province} onBack={vi.fn()} onToggleSave={vi.fn()} />, { wrapper: wrapper() });
    expect(screen.getByText("17.7")).toBeInTheDocument();
    expect(screen.queryByText("17.7012")).not.toBeInTheDocument();
    expect(screen.getByText("General weather assessment")).toBeInTheDocument();
    expect(screen.queryByText("Report Table 3.1")).not.toBeInTheDocument();
    expect(screen.getAllByText("Official alert source is not connected.").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rain accumulation interval is unspecified/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Insufficient storm classification evidence/)).toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it("identifies hourly forecast rain and retains weather condition without claiming storm safety", async () => {
    const province: ProvinceGeoFeatureProperties = { ...state.provinces[0]!, conditionCode: "thunderstorm", assessment: {
      ...assessment, vehicle: null, evidence: [
        { dimension: "rain", severity: 3, value: 35.126, source_kind: "hourly_forecast" },
        { dimension: "storm", severity: 0, value: "unclassified" },
        { dimension: "alert", severity: 0, value: null },
      ],
    } };
    render(<ProvinceStatusDetail province={province} onBack={vi.fn()} onToggleSave={vi.fn()} />, { wrapper: wrapper() });
    expect(screen.getByText("Rain forecast (mm/h)")).toBeInTheDocument();
    const rainDimension = screen.getByText("Rain forecast (mm/h)").parentElement!.parentElement!;
    expect(within(rainDimension).getByText("35.13")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Weather warnings" })).toHaveTextContent(/Rain forecast\s*35\.13\s*mm\/h\s*High risk/);
    expect(screen.getByText("Thunderstorm")).toBeInTheDocument();
    expect(screen.getByText(/Storm type not available/)).toBeInTheDocument();
    expect(screen.queryByText("No storm")).not.toBeInTheDocument();
    expect(screen.getAllByText("Official alert source is not connected.").length).toBeGreaterThan(0);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it("keeps fog in the weather banner instead of presenting it as storm evidence", async () => {
    const province: ProvinceGeoFeatureProperties = { ...state.provinces[0]!, conditionCode: "fog", assessment: {
      ...assessment, evidence: [{ dimension: "storm", severity: 0, value: null }],
    } };
    render(<ProvinceStatusDetail province={province} onBack={vi.fn()} onToggleSave={vi.fn()} />, { wrapper: wrapper() });
    const stormCard = screen.getByText("Storm").parentElement!.parentElement!;
    expect(within(stormCard).queryByText("Fog")).not.toBeInTheDocument();
    expect(within(stormCard).getByText("—")).toBeInTheDocument();
    expect(within(stormCard).getByText("Not assessed")).toBeInTheDocument();
    expect(screen.getByText(/Fog/)).toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it.each([73, 0, null])("renders hourly rain chance %s without a unit on missing data", async probability => {
    state.provinces = [{ ...state.provinces[0]!, rainProbabilityPercent: probability ?? NaN }];
    render(<WeatherPage />, { wrapper: wrapper() });
    const expected = probability === null ? "—" : probability + "%";
    const cardMetric = screen.getByText("Rain chance (1h)").parentElement!;
    expect(within(cardMetric).getByText(expected)).toBeInTheDocument();
    expect(within(cardMetric).queryByText("—%")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details & 24h" }));
    const modal = screen.getByRole("dialog");
    const modalMetric = within(modal).getByText("Rain chance (1h)").parentElement!;
    expect(within(modalMetric).getByText(expected)).toBeInTheDocument();
    expect(within(modalMetric).queryByText("—%")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.click(screen.getByTitle("Table data view"));
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Rain chance (1h)" })).toBeInTheDocument();
    const row = within(table).getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("cell")[6]?.textContent).toBe(expected);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it("sorts known rain probabilities before missing values", () => {
    const base = state.provinces[0]!;
    state.provinces = [
      { ...base, id: "missing", code: "missing", name: "Missing", rainProbabilityPercent: NaN },
      { ...base, id: "zero", code: "zero", name: "Zero", rainProbabilityPercent: 0 },
      { ...base, id: "rainy", code: "rainy", name: "Rainy", rainProbabilityPercent: 73 },
    ];
    render(<WeatherPage />, { wrapper: wrapper() });
    fireEvent.change(screen.getByRole("option", { name: "Highest rain probability" }).parentElement!, { target: { value: "rain_desc" } });
    fireEvent.click(screen.getByTitle("Table data view"));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map(row => within(row).getAllByRole("cell")[0]?.textContent)).toEqual(["Rainy", "Zero", "Missing"]);
  });

  it("shows haze in weather cards and modal without relabeling it fog or unavailable", async () => {
    state.provinces = [{ ...state.provinces[0]!, conditionCode: "haze", conditionText: "Mù khô" }];
    render(<WeatherPage />, { wrapper: wrapper() });
    expect(screen.getByText("Haze")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details & 24h" }));
    expect(within(screen.getByRole("dialog")).getByText("Haze")).toBeInTheDocument();
    expect(screen.queryByText("Fog")).not.toBeInTheDocument();
    expect(screen.queryByText("Condition unavailable")).not.toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it("anchors modal hourly values to the selected forecast time", async () => {
    const selected = Date.now() + 24 * 3600000;
    state.provinces = [{ ...state.provinces[0]!, weatherTargetTime: new Date(selected).toISOString() }];
    const response = forecastResponse();
    response.data.data.hourly.values.push({
      validInterval: { from: new Date(selected).toISOString(), to: new Date(selected + 3600000).toISOString() },
      temperatureCelsius: 32, precipitationProbabilityPercent: 12, conditionCode: "hail",
    });
    vi.mocked(apiClient.post).mockResolvedValue(response);
    render(<WeatherPage />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole("button", { name: "Details & 24h" }));
    const modal = screen.getByRole("dialog");
    await waitFor(() => expect(within(modal).getByText("32°C")).toBeInTheDocument());
    expect(within(modal).queryByText("17°C")).not.toBeInTheDocument();
    expect(within(modal).getByText(/General weather risk/)).toBeInTheDocument();
  });

  it("uses the report endpoint only after an explicit location vehicle choice", async () => {
    render(<Routes><Route path="/location/:id" element={<LocationPage />} /></Routes>, { wrapper: wrapper("/location/HN") });
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByText("26°C")).not.toBeInTheDocument();
    expect(screen.queryByText("0 mm")).not.toBeInTheDocument();
    expect(screen.queryByText("7 - 14 ngày")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Phương tiện đánh giá rủi ro:"), { target: { value: "car" } });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(expect.stringMatching(/\/risk\/report-point\?.*vehicle=car/)));
    await waitFor(() => expect(screen.getByRole("list", { name: "Cảnh báo thời tiết" })).toHaveTextContent(/Mưa\s*35\s*mm\/h\s*Nguy cơ cao/));
    expect(screen.getByText("Chỉ số rủi ro: Chưa đủ dữ liệu")).toBeInTheDocument();
    expect(screen.queryByText("99°C")).not.toBeInTheDocument();
  });

  it("does not request arbitrary fallback coordinates for an unknown location", () => {
    render(<Routes><Route path="/location/:id" element={<LocationPage />} /></Routes>, { wrapper: wrapper("/location/not-a-province") });
    expect(screen.getByText(/Không tìm thấy tỉnh thành/)).toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
