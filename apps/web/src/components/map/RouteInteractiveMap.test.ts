import { describe, expect, it, vi } from "vitest";
vi.mock("maplibre-gl", () => ({ setWorkerUrl: vi.fn() }));
import { selectVisibleCheckpoints } from "./RouteInteractiveMap";

describe("visible route checkpoints", () => {
  it("bounds checkpoint markers while retaining hazard and selected samples", () => {
    const samples = Array.from({ length: 101 }, (_, index) => ({ risk: index === 14 ? "high" as const : "low" as const }));
    const visible = selectVisibleCheckpoints(samples, 97);
    expect(visible.length).toBeLessThanOrEqual(6);
    expect(visible).toContain(14);
    expect(visible).toContain(97);
    expect(visible).not.toContain(0);
    expect(visible).not.toContain(100);
    expect(samples).toHaveLength(101);
  });
  it("does not duplicate endpoints or markers on short routes", () => {
    expect(selectVisibleCheckpoints([{ risk: "low" }, { risk: "low" }], null)).toEqual([]);
    expect(selectVisibleCheckpoints([{ risk: "low" }, { risk: "high" }, { risk: "low" }], 1)).toEqual([1]);
  });
});
