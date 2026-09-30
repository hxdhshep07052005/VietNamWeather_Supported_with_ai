import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeoCheckpoint } from "@/utils/routePathGenerator";
import { createCheckpointMarker } from "./checkpointMarker";

const point: GeoCheckpoint = {
  id: "cp-8", name: "Weather sample · km 39.9", distanceKm: 39.9371,
  eta: "12:16 30/09/2026 (UTC+7, +27m)", etaShort: "12:16 · 30/09",
  temp: 32, condition: "Clear", rainProb: 0, windKmh: 8,
  risk: "low", provisional: true, coordinates: [106.3, 21.4],
  note: "Official alert source is not connected.; Incomplete evidence: provisional_weather_evidence",
};

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("compact route checkpoint tooltip", () => {
  it.each([
    { x: 0, y: 60, expectedLeft: 8, expectedTop: 94 },
    { x: 356, y: 60, expectedLeft: 152, expectedTop: 94 },
    { x: 150, y: 370, expectedLeft: 52, expectedTop: 260 },
  ])("keeps the popup inside the map at marker position $x,$y", ({ x, y, expectedLeft, expectedTop }) => {
    const boundary = document.createElement("div");
    document.body.append(boundary);
    vi.spyOn(boundary, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 60, 400, 400));
    const marker = createCheckpointMarker(point, { boundary, tooltipId: "point-tooltip", selected: true, isEn: true, onSelect: vi.fn() });
    boundary.append(marker.element);
    const tooltip = screen.getByRole("tooltip");
    vi.spyOn(marker.element, "getBoundingClientRect").mockReturnValue(new DOMRect(x, y, 44, 44));
    vi.spyOn(tooltip, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 240, 120));
    marker.reposition();
    expect(x + parseFloat(tooltip.style.insetInlineStart)).toBe(expectedLeft);
    expect(y + parseFloat(tooltip.style.insetBlockStart)).toBe(expectedTop);
    expect(tooltip.style.maxInlineSize).toBe("384px");
    expect(tooltip.style.maxBlockSize).toBe("384px");
  });

  it("shows only the point, temperature, arrival and truthful risk status", () => {
    const { element: marker } = createCheckpointMarker(point, { boundary: document.body, tooltipId: "point-tooltip", selected: false, isEn: true, onSelect: vi.fn() });
    document.body.append(marker);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(marker);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Weather sample · km 39.9");
    expect(tooltip).toHaveTextContent("32°C");
    expect(tooltip).toHaveTextContent("12:16 · 30/09");
    expect(tooltip).toHaveTextContent("Low risk");
    expect(tooltip).toHaveTextContent("Provisional");
    expect(tooltip).not.toHaveTextContent(/Official alert|provisional_weather_evidence|\+27m|100%/);
    expect(marker).toHaveAttribute("aria-describedby", tooltip.id);
    expect(marker).not.toHaveAttribute("title");
    fireEvent.mouseLeave(marker);
    expect(tooltip).not.toBeVisible();
  });

  it("keeps a focused tooltip visible on mouse leave and dismisses it with Escape", async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    const { element: marker } = createCheckpointMarker(point, { boundary: document.body, tooltipId: "point-tooltip", selected: false, isEn: true, onSelect: select });
    document.body.append(marker);
    await user.tab();
    expect(marker).toHaveFocus();
    const tooltip = screen.getByRole("tooltip");
    fireEvent.mouseEnter(marker);
    fireEvent.mouseLeave(marker);
    expect(tooltip).toBeVisible();
    await user.keyboard("{Escape}");
    expect(tooltip).not.toBeVisible();
    expect(select).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledOnce();
  });

  it("keeps the selected point open and allows dismissal without deselecting it", () => {
    const select = vi.fn();
    const { element: marker } = createCheckpointMarker(point, { boundary: document.body, tooltipId: "point-tooltip", selected: true, isEn: true, onSelect: select });
    document.body.append(marker);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.mouseLeave(marker);
    fireEvent.blur(marker);
    expect(tooltip).toBeVisible();
    expect(marker).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(marker, { key: "Escape" });
    expect(tooltip).not.toBeVisible();
    expect(marker).toHaveAttribute("aria-pressed", "true");
    expect(select).not.toHaveBeenCalled();
  });

  it("preserves zero and missing temperatures and localizes caution, danger and unknown", () => {
    for (const [risk, label] of [["caution", "Cẩn trọng"], ["high", "Nguy hiểm"], ["unknown", "Chưa đủ dữ liệu"]] as const) {
      const { element: marker } = createCheckpointMarker({ ...point, risk, temp: risk === "unknown" ? null : 0, provisional: false }, { boundary: document.body, tooltipId: `tooltip-${risk}`, selected: true, isEn: false, onSelect: vi.fn() });
      document.body.replaceChildren(marker);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent(label);
      expect(tooltip).toHaveTextContent(risk === "unknown" ? "—" : "0°C");
      expect(tooltip).not.toHaveTextContent(/An toàn|Tạm tính|—°C/);
      expect(marker).toHaveAttribute("data-risk", risk);
    }
  });

  it("treats names as text and preserves the full ETA when no compact time is supplied", () => {
    const { element: marker } = createCheckpointMarker({ ...point, name: "<img src=x onerror=alert(1)>", etaShort: undefined }, { boundary: document.body, tooltipId: "point-tooltip", selected: true, isEn: true, onSelect: vi.fn() });
    document.body.append(marker);
    expect(marker.querySelector("img")).toBeNull();
    expect(screen.getByRole("tooltip")).toHaveTextContent(point.eta);
    expect(screen.getByRole("tooltip")).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});
