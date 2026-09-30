import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { findVietnamProvinceByName, type ReportPointResponse } from "@vietnam-weather/contracts";
import { vietnamGeoJson } from "@xdev-asia/vietnam-map-34-provinces/core";
import { apiClient } from "@/api/client";
import { getAllProvincesData } from "@/data/vietnamGeoJsonWGS84";
import { LandingPage } from "./LandingPage";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn() } }));

const sourceTime = "2026-09-30T01:15:00Z";
function weatherOverview() {
  return { data: { target_time: "2026-09-30T01:40:00Z", provinces: getAllProvincesData().map((province, index) => {
    const record: ReportPointResponse = {
      weather: {
        temperature_c: index === 0 ? 0 : 20 + index / 10, rain_mm_per_hour: 0, gust_kmh: 4,
        visibility_m: 10000, storm: null, official_alert_level: null, freshness: "fresh",
        coverage: "covered", source: "provider", source_time: sourceTime,
        valid_from: sourceTime, valid_to: null, reasons: [],
      },
      assessment: {
        level: "low", severity: 1, score: 1 / 3, display_score: 33, vehicle: null,
        rule_set_version: "general-weather-v1", freshness: "fresh", coverage: "covered",
        source: "provider", source_time: sourceTime, reasons: [], evidence: [],
      },
    };
    return { id: findVietnamProvinceByName(province.name)?.id, name: province.name, ...record };
  }).reverse() } };
}

function provincePath(container: HTMLElement, id: string) {
  const index = vietnamGeoJson.features.findIndex(feature => feature.properties["hc-key"] === id);
  const path = container.querySelectorAll('g[filter="url(#mapGlowFilter)"] path')[index];
  if (!path) throw new Error(`Missing province path: ${id}`);
  return path;
}

const clients: QueryClient[] = [];
beforeEach(() => { vi.mocked(apiClient.get).mockResolvedValue(weatherOverview()); });
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.clearAllMocks();
});

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "landing.heroEyebrow": "Trợ lý Du lịch Thời tiết Thông minh Việt Nam",
        "landing.heroSubtitle": "Đưa ra quyết định du lịch tại Việt Nam dựa trên dữ liệu thời tiết có nguồn",
        "landing.getStarted": "Bắt đầu ngay",
        "auth.login": "Đăng nhập",
        "landing.exploreMap": "Khám phá bản đồ thời tiết",
        "landing.learnMore": "Tìm hiểu tính năng",
        "landing.viewModeRegions": "Theo vùng miền",
        "landing.viewModeRisk": "Mức độ rủi ro",
        "landing.featuresTitle": "Tính năng vượt trội",
        "landing.statsProvinces": "Tỉnh thành phủ sóng",
        "landing.pricingTitle": "Bảng giá dịch vụ",
        "landing.ctaReady": "Sẵn sàng cho chuyến đi an toàn?",
      };
      return translations[key] || key;
    },
    i18n: { language: "vi" },
  }),
}));

// Mock GSAP to avoid DOM animation issues in test environment
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    context: (cb: () => void) => {
      cb();
      return { revert: vi.fn() };
    },
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {},
}));

describe("LandingPage Component", () => {
  const renderWithRouter = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    clients.push(client);
    const rendered = render(
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
    return { ...rendered, client };
  };

  it("renders Hero headline and eyebrow badge", () => {
    renderWithRouter();
    expect(
      screen.getByText("Trợ lý Du lịch Thời tiết Thông minh Việt Nam")
    ).toBeInTheDocument();
    expect(screen.getByText("Dự báo Thời tiết")).toBeInTheDocument();
  });

  it("renders Get Started and Login CTA buttons linking to /register and /login", () => {
    renderWithRouter();
    const registerLinks = screen.getAllByRole("link", { name: /Bắt đầu ngay/i });
    expect(registerLinks[0]).toBeInTheDocument();
    expect(registerLinks[0]).toHaveAttribute("href", "/register");

    const loginLink = screen.getByRole("link", { name: /Đăng nhập/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("renders features, stats, and pricing sections", () => {
    renderWithRouter();
    expect(screen.getByText("Tính năng vượt trội")).toBeInTheDocument();
    expect(screen.getByText("Bảng giá dịch vụ")).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
  });

  it("shows each hovered province's current temperature from one bulk request, regardless of response order", async () => {
    const { container } = renderWithRouter();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(
      "/risk/report-provinces?offset_hours=0", { signal: expect.any(AbortSignal) }
    ));
    const records = weatherOverview().data.provinces;
    for (const province of getAllProvincesData()) {
      const record = records.find(point => point.name === province.name);
      fireEvent.mouseEnter(provincePath(container, province.id));
      await waitFor(() => expect(within(screen.getByRole("tooltip")).getByText(`${record?.weather.temperature_c}°C`)).toBeInTheDocument());
      expect(within(screen.getByRole("tooltip")).getByText(province.name)).toBeInTheDocument();
      expect(within(screen.getByRole("tooltip")).getByText("landing.weatherSafe")).toBeInTheDocument();
    }
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it("keeps Hà Giang selected after mouseleave instead of switching to Hậu Giang with the same short code", () => {
    const { container } = renderWithRouter();
    const path = provincePath(container, "vn-hg");
    fireEvent.mouseEnter(path);
    fireEvent.click(path);
    fireEvent.mouseLeave(path);
    expect(screen.getByText("Hà Giang")).toBeInTheDocument();
    expect(screen.queryByText("Hậu Giang")).not.toBeInTheDocument();
    expect(container.querySelectorAll('path[fill="#FFCD00"]')).toHaveLength(1);
  });

  it("updates a hovered province from the refreshed cache and shows its source time", async () => {
    const { container, client } = renderWithRouter();
    fireEvent.mouseEnter(provincePath(container, "vn-hg"));
    await waitFor(() => expect(screen.getByRole("tooltip").querySelector("time")).toHaveAttribute("dateTime", sourceTime));
    expect(screen.getByRole("tooltip")).toHaveTextContent("08:15");
    const refreshed = weatherOverview();
    const point = refreshed.data.provinces.find(province => province.id === "ha-giang");
    if (!point) throw new Error("Missing Hà Giang fixture");
    point.weather.temperature_c = 12.5;
    point.weather.source_time = "2026-09-30T02:15:00Z";
    point.assessment.source_time = point.weather.source_time;
    act(() => { client.setQueryData(["report-provinces", 0, ""], refreshed); });
    await waitFor(() => expect(within(screen.getByRole("tooltip")).getByText("12.5°C")).toBeInTheDocument());
    expect(screen.getByRole("tooltip")).toHaveTextContent("09:15");
  });
});
