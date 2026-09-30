import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VietnamMap } from "./VietnamMap";
import { getAllProvincesData } from "../../data/vietnamGeoJsonWGS84";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "vi" },
  }),
}));

describe("VietnamMap Component", () => {
  it("renders correctly with SVG canvas", () => {
    const { container } = render(<VietnamMap />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders province paths with valid paths", () => {
    const { container } = render(<VietnamMap />);
    const paths = container.querySelectorAll("path");
    // Vietnam has 63 provinces
    expect(paths.length).toBeGreaterThanOrEqual(60);
  });

  it("handles province click and emits accurate WGS84 coordinates", () => {
    const onProvinceClick = vi.fn();
    const { container } = render(
      <VietnamMap interactive={true} onProvinceClick={onProvinceClick} />
    );

    const firstProvince = container.querySelector("path");
    expect(firstProvince).toBeInTheDocument();

    if (firstProvince) {
      fireEvent.click(firstProvince);
      expect(onProvinceClick).toHaveBeenCalledTimes(1);
      const firstCall = onProvinceClick.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall) {
        const [name, code, lat, lng] = firstCall;
        expect(typeof name).toBe("string");
        expect(typeof code).toBe("string");
        expect(typeof lat).toBe("number");
        expect(typeof lng).toBe("number");

        // Verify coordinate is within Vietnam's real geographical bounding box
        expect(lat).toBeGreaterThan(8.0);
        expect(lat).toBeLessThan(24.0);
        expect(lng).toBeGreaterThan(102.0);
        expect(lng).toBeLessThan(110.5);
      }
    }
  });

  it("renders clean vector map without floating dots or circles", () => {
    const { container } = render(
      <VietnamMap showcaseMode={true} />
    );
    // Ensure no circle or floating pulse dots are rendered on the map canvas
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(0);
  });

  it("displays on-demand info card when hovering over a province", () => {
    const { container } = render(<VietnamMap showcaseMode={true} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    const firstProvince = container.querySelector("path");
    if (firstProvince) {
      fireEvent.mouseEnter(firstProvince);
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
      expect(screen.getByText("Chưa có dữ liệu thời tiết")).toBeInTheDocument();
      expect(screen.queryByText(/common\.updatedAt/)).not.toBeInTheDocument();
    }
  });

  it("clears the previous temperature for a missing province and distinguishes loading and error states", () => {
    const provinces = getAllProvincesData().map(province => ({ ...province, temp: 24.2, dataState: "ready" as const }));
    const { rerender } = render(<VietnamMap provinceWeather={provinces} selectedProvinceId="vn-hg" />);
    expect(screen.getByText("24.2°C")).toBeInTheDocument();
    for (const dataState of ["loading", "ready", "error"] as const) {
      const next = provinces.map(province => province.id === "vn-337" ? { ...province, temp: NaN, dataState } : province);
      rerender(<VietnamMap provinceWeather={next} selectedProvinceId="vn-337" />);
      expect(screen.getByText("Hậu Giang")).toBeInTheDocument();
      expect(screen.queryByText("24.2°C")).not.toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
      const status = { loading: "common.loading", ready: "Chưa có dữ liệu thời tiết", error: "Không tải được thời tiết" }[dataState];
      expect(screen.getByText(status)).toBeInTheDocument();
      expect(screen.queryByText(/common\.updatedAt/)).not.toBeInTheDocument();
    }
  });

  it("marks older temperatures and uses measured low, caution, high and unknown colors in risk mode", () => {
    const provinces = getAllProvincesData().map((province, index) => ({
      ...province, temp: 0, dataState: "ready" as const, freshnessState: "stale" as const,
      riskLevel: (["low", "caution", "high", "unknown"] as const)[index % 4] ?? "unknown",
    }));
    const { container } = render(<VietnamMap provinceWeather={provinces} selectedProvinceId="vn-hg" viewMode="risk" />);
    expect(screen.getByText("0°C")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu cũ")).toBeInTheDocument();
    expect(screen.getByText("Chưa có thời điểm cập nhật")).toBeInTheDocument();
    for (const color of ["#10B981", "#F59E0B", "#EF4444", "#64748B"]) {
      expect(container.querySelector(`path[fill="${color}"]`)).toBeInTheDocument();
    }
  });
});
