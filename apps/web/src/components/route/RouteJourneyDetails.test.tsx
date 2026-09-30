import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteResponse } from "@vietnam-weather/contracts";
import { RestStops } from "./RestStops";
import { RouteWeatherTimeline, type RouteCheckpoint } from "./RouteWeatherTimeline";

afterEach(cleanup);

const stops = {
  route_type: "fastest", status: "available", source: "OpenStreetMap",
  items: ["Hữu Lũng", "Bắc Giang", "Bắc Ninh", "Hà Nội"].map((name, index) => ({
    id: `node/${index}`, name, source_url: `https://www.openstreetmap.org/node/${index}`,
    distance_from_start_meters: 12560 + index * 20000, coordinates: { latitude: 21, longitude: 106 },
  })),
} satisfies NonNullable<RouteResponse["rest_stops"]>;

const point = {
  name: "Lạng Sơn (Departure)", distanceKm: 0, eta: "09:49 30/09/2026 (UTC+7, +0m)",
  etaShort: "09:49 · 30/09", temp: 0, condition: "Clear", rainProb: 0, windKmh: 0,
  risk: "low", riskScore: 33, provisional: true, coveragePercent: 100,
  note: "Official alert source is not connected.",
} satisfies RouteCheckpoint;

describe("compact route stop and weather sections", () => {
  it("shows real named stops and keeps additional stops in a native disclosure", async () => {
    const user = userEvent.setup();
    render(<RestStops stops={stops} isEn />);
    const section = within(screen.getByRole("region", { name: "Rest stops near the fastest route" }));
    expect(section.getByRole("link", { name: /Hữu Lũng/ })).toHaveAttribute("href", stops.items[0]?.source_url);
    expect(section.getByText("From departure: 12.6 km")).toBeVisible();
    expect(section.getByText("Hà Nội")).not.toBeVisible();
    const summary = screen.getByText("Show 1 more stop");
    summary.focus();
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(section.getByText("Hà Nội")).toBeVisible();
    expect(section.queryByText(/Weather details|33\/100/)).not.toBeInTheDocument();
  });

  it("distinguishes unavailable data from an empty successful search", () => {
    const view = render(<RestStops stops={undefined} isEn />);
    expect(screen.getByText("Rest-stop locations are unavailable right now.")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    view.rerender(<RestStops stops={{ ...stops, items: [] }} isEn />);
    expect(screen.getByText("No rest stops found near this route.")).toBeVisible();
    expect(screen.queryByText(/unavailable/)).not.toBeInTheDocument();
  });

  it("keeps risk limitations accessible without selecting a point when details open", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(<RouteWeatherTimeline checkpoints={[point]} selectedIndex={null} onSelect={select} isEn />);
    expect(screen.getByText("Low risk · provisional")).toBeVisible();
    expect(screen.getByText("0°C")).toBeVisible();
    expect(screen.getByText(point.note)).not.toBeVisible();
    expect(screen.getByText("33/100")).not.toBeVisible();
    await user.tab();
    expect(screen.getByRole("button", { name: /Show on map: Lạng Sơn/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledWith(0);
    select.mockClear();
    await user.tab();
    expect(screen.getByText("Weather details")).toHaveFocus();
    // user-event does not synthesize native summary activation from Enter.
    await user.click(screen.getByText("Weather details"));
    expect(screen.getByText(point.note)).toBeVisible();
    expect(screen.getByText("33/100")).toBeVisible();
    expect(screen.getByText(point.eta)).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible();
    expect(screen.getByText("0 km/h")).toBeVisible();
    expect(select).not.toHaveBeenCalled();
  });

  it("supports deselection without changing full ETA or score data", async () => {
    const select = vi.fn();
    render(<RouteWeatherTimeline checkpoints={[point]} selectedIndex={0} onSelect={select} isEn />);
    const button = screen.getByRole("button", { name: /Show on map: Lạng Sơn/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);
    expect(select).toHaveBeenCalledWith(null);
    expect(screen.getByText(point.eta)).toBeInTheDocument();
    expect(screen.getByText("33/100")).toBeInTheDocument();
  });

  it("preserves missing values and neutral risk in Vietnamese", () => {
    const unknown: RouteCheckpoint = { ...point, temp: null, risk: "unknown", provisional: false, riskScore: undefined, rainProb: null, windKmh: null };
    render(<RouteWeatherTimeline checkpoints={[unknown]} selectedIndex={null} onSelect={vi.fn()} isEn={false} />);
    expect(screen.getByText("Chưa đủ dữ liệu")).toBeVisible();
    expect(screen.getByText("Chi tiết thời tiết")).toBeVisible();
    expect(screen.queryByText(/An toàn|—°C|—%|— km\/h/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
