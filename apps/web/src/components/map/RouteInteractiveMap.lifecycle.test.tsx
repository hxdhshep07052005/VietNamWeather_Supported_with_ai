import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteInteractiveMap } from "./RouteInteractiveMap";
import { getAllProvincesData } from "@/data/vietnamGeoJsonWGS84";
const state = vi.hoisted(() => ({ handlers: new Map<string, () => void>(), sources: new Map<string, { data: unknown; setData: (data: unknown) => void }>(), layers: new Map<string, { id: string; paint?: Record<string, unknown> }>(), order: [] as string[], synchronousStyle: false }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "en" } }) }));
vi.mock("maplibre-gl", () => ({ setWorkerUrl: vi.fn(), Map: class {
  on(event: string, callback: () => void) { state.handlers.set(event, callback); }
  once(event: string, callback: () => void) { state.handlers.set(event, callback); }
  getStyle() { return {}; }
  getContainer() { return document.body; }
  getSource(id: string) { return state.sources.get(id); }
  addSource(id: string, source: { data: unknown }) { const entry = { data: source.data, setData(data: unknown) { entry.data = data; } }; state.sources.set(id, entry); }
  getLayer(id: string) { return state.layers.has(id); }
  addLayer(layer: { id: string; paint?: Record<string, unknown> }, before?: string) {
    state.layers.set(layer.id, structuredClone(layer));
    const index = before ? state.order.indexOf(before) : -1;
    if (index < 0) state.order.push(layer.id); else state.order.splice(index, 0, layer.id);
  }
  setStyle() { state.sources.clear(); state.layers.clear(); state.order.length = 0; if (state.synchronousStyle) state.handlers.get("style.load")?.(); }
  moveLayer() {} removeLayer() {} removeSource() {} fitBounds() {} resize() {} remove() {} setLayoutProperty() {}
  setPaintProperty(id: string, property: string, value: unknown) { const layer = state.layers.get(id); if (layer?.paint) layer.paint[property] = value; }
  project() { return { x: 0, y: 0 }; }
}, Marker: class {
  readonly element: HTMLElement;
  constructor({ element }: { element: HTMLElement }) { this.element = element; }
  setLngLat() { return this; }
  addTo() { document.body.append(this.element); return this; }
  remove() { this.element.remove(); }
} }));
afterEach(() => { cleanup(); vi.useRealTimers(); state.handlers.clear(); state.sources.clear(); state.layers.clear(); state.order.length = 0; state.synchronousStyle = false; localStorage.clear(); });
describe("route map delayed load lifecycle", () => {
  it("preserves keyboard focus across controlled point selection and Escape dismissal", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const props = { originName: "A", destinationName: "B", onSelectCheckpoint: onSelect,
      coordinates: [[105, 21], [106, 21]] satisfies [number, number][],
      checkpoints: [0, 40, 80].map((distanceKm, index) => ({ name: `Point ${index}`, distanceKm, risk: "low" as const })),
    };
    const view = render(<RouteInteractiveMap {...props} selectedCheckpointIndex={null} />);
    act(() => { state.handlers.get("load")?.(); });
    screen.getByRole("button", { name: "Point 1" }).focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith(1);
    view.rerender(<RouteInteractiveMap {...props} selectedCheckpointIndex={1} />);
    expect(screen.getByRole("button", { name: "Point 1" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith(null);
    view.rerender(<RouteInteractiveMap {...props} selectedCheckpointIndex={null} />);
    expect(screen.getByRole("button", { name: "Point 1" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Point 1" })).toHaveAttribute("aria-pressed", "false");
  });
  it("shows a compact weather tooltip without the technical evidence paragraph", () => {
    const onSelect = vi.fn();
    const checkpoints = [0, 39.9371, 80].map((distanceKm, index) => ({
      name: index === 1 ? "Weather sample · km 39.9" : `Endpoint ${index}`,
      distanceKm, temp: 32, risk: "low" as const, provisional: true,
      eta: "12:16 30/09/2026 (UTC+7, +27m)", etaShort: "12:16 · 30/09",
      note: "Official alert source is not connected.; Incomplete evidence: provisional_weather_evidence",
    }));
    render(<RouteInteractiveMap originName="A" destinationName="B" coordinates={[[105, 21], [106, 21]]} checkpoints={checkpoints} onSelectCheckpoint={onSelect} />);
    act(() => { state.handlers.get("load")?.(); });
    const marker = screen.getByRole("button", { name: "Weather sample · km 39.9" });
    fireEvent.mouseEnter(marker);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("32°C");
    expect(tooltip).toHaveTextContent("12:16 · 30/09");
    expect(tooltip).toHaveTextContent("Low risk");
    expect(tooltip).toHaveTextContent("Provisional");
    expect(tooltip).not.toHaveTextContent(/Official alert|Incomplete evidence|provisional_weather_evidence|\+27m/);
    expect(marker).toHaveAccessibleDescription(/32°C.*12:16.*Low risk.*Provisional/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip).not.toBeVisible();
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
  it("retains a focused point outside the normal marker sample when deselecting it", () => {
    const props = { originName: "A", destinationName: "B",
      coordinates: [[105, 21], [106, 21]] satisfies [number, number][],
      checkpoints: Array.from({ length: 12 }, (_, index) => ({ name: `Point ${index}`, distanceKm: index * 5, risk: "low" as const })),
    };
    const view = render(<RouteInteractiveMap {...props} selectedCheckpointIndex={2} />);
    act(() => { state.handlers.get("load")?.(); });
    screen.getByRole("button", { name: "Point 2" }).focus();
    view.rerender(<RouteInteractiveMap {...props} selectedCheckpointIndex={null} />);
    expect(screen.getByRole("button", { name: "Point 2" })).toHaveFocus();
  });
  it("does not restore an old gray route after newer evidence arrives", () => {
    vi.useFakeTimers();
    const coordinates: [number, number][] = [[105, 21], [106, 21]];
    const initial = [{ distanceKm: 0, risk: "unknown" as const }, { distanceKm: 100, risk: "unknown" as const }];
    const current = [{ distanceKm: 0, risk: "low" as const, provisional: true }, { distanceKm: 100, risk: "low" as const, provisional: true }];
    const view = render(<RouteInteractiveMap originName="A" destinationName="B" coordinates={coordinates} checkpoints={initial} />);
    act(() => { state.handlers.get("load")?.(); });
    view.rerender(<RouteInteractiveMap originName="A" destinationName="B" coordinates={coordinates} checkpoints={current} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(state.sources.get("route-source")?.data).toMatchObject({ features: [{ properties: { riskColor: "#22C55E", provisional: true } }] });
  });

  it("uses current province risks for both border and fill, refreshing by ID without replacing road geometry", () => {
    const provinces = getAllProvincesData().map(province => ({ ...province, riskLevel: "low" as const, riskColor: "#22C55E" }));
    const view = render(<RouteInteractiveMap originName="A" destinationName="B" provinces={provinces} />);
    act(() => { state.handlers.get("load")?.(); });
    expect(state.sources.get("vietnam-provinces")?.data).toMatchObject({ features: provinces.map(province => ({ properties: { id: province.id, riskColor: "#22C55E" } })) });
    expect(state.layers.get("provinces-border")?.paint?.["line-color"]).toEqual(["get", "riskColor"]);
    expect(state.layers.get("provinces-fill")?.paint?.["fill-color"]).toEqual(["get", "riskColor"]);
    const routeBefore = state.sources.get("route-source")?.data;
    view.rerender(<RouteInteractiveMap originName="A" destinationName="B" provinces={provinces.map(province => ({ ...province, riskLevel: "high" as const, riskColor: "#EF4444" })).reverse()} />);
    expect(state.sources.get("vietnam-provinces")?.data).toMatchObject({ features: provinces.map(province => ({ properties: { id: province.id, riskColor: "#EF4444" } })) });
    expect(state.sources.get("route-source")?.data).toEqual(routeBefore);
  });

  it("keeps the latest border toggle and province data when a new basemap finishes loading", () => {
    const provinces = getAllProvincesData();
    const coordinates: [number, number][] = [[105, 21], [106, 21]];
    const view = render(<RouteInteractiveMap originName="A" destinationName="B" coordinates={coordinates} provinces={provinces} />);
    act(() => { state.handlers.get("load")?.(); });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Province Borders: ON" }));
    const refreshed = provinces.map(province => ({ ...province, riskLevel: "caution" as const, riskColor: "#F59E0B" }));
    view.rerender(<RouteInteractiveMap originName="A" destinationName="B" coordinates={coordinates} provinces={refreshed} />);
    act(() => { state.handlers.get("style.load")?.(); });
    expect(state.layers.get("provinces-border")?.paint?.["line-color"]).toBe("rgba(100, 116, 139, 0.28)");
    expect(state.layers.get("provinces-fill")?.paint?.["fill-opacity"]).toBe(0.001);
    expect(state.sources.get("vietnam-provinces")?.data).toMatchObject({ features: refreshed.map(province => ({ properties: { id: province.id, riskColor: "#F59E0B" } })) });
    fireEvent.click(screen.getByRole("button", { name: "Province Borders: OFF" }));
    expect(state.layers.get("provinces-border")?.paint?.["line-color"]).toEqual(["get", "riskColor"]);
    expect(state.order.indexOf("provinces-border")).toBeLessThan(state.order.indexOf("route-glow-layer"));
  });

  it("restores provinces and route when setStyle fires style.load synchronously", () => {
    state.synchronousStyle = true;
    render(<RouteInteractiveMap originName="A" destinationName="B" coordinates={[[105, 21], [106, 21]]} />);
    act(() => { state.handlers.get("load")?.(); });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(state.layers.has("provinces-border")).toBe(true);
    expect(state.layers.has("route-core-layer")).toBe(true);
    expect(state.order.indexOf("provinces-border")).toBeLessThan(state.order.indexOf("route-glow-layer"));
  });
});
