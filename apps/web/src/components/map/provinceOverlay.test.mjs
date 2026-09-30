import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { provinceFillPaint, provinceBorderPaint } from "./provinceOverlay";

const require = createRequire(import.meta.url);
const requireMapLibre = createRequire(require.resolve("maplibre-gl/package.json"));
const { createPropertyExpression, latest } = requireMapLibre("@maplibre/maplibre-gl-style-spec");

describe("shared MapLibre province overlay expressions", () => {
  it.each(["all", "low", "caution", "high"])("accepts enabled and disabled paint for %s filter", filter => {
    for (const enabled of [true, false]) {
      for (const [paint, spec] of [
        [provinceFillPaint(enabled, filter), latest.paint_fill],
        [provinceBorderPaint(enabled, filter), latest.paint_line],
      ]) {
        for (const [key, value] of Object.entries(paint)) {
          const parsed = createPropertyExpression(value, key, spec[key]);
          expect(parsed.result, `${key}: ${JSON.stringify(parsed.value)}`).toBe("success");
        }
      }
    }
  });

  it("fades the matching province fill while keeping other provinces faint", () => {
    const parsed = createPropertyExpression(provinceFillPaint(true, "low")["fill-opacity"], "fill-opacity", latest.paint_fill["fill-opacity"]);
    expect(parsed.result).toBe("success");
    const low = { type: 3, properties: { riskLevel: "low" } };
    const high = { type: 3, properties: { riskLevel: "high" } };
    expect(parsed.value.evaluate({ zoom: 5 }, low)).toBe(0.36);
    expect(parsed.value.evaluate({ zoom: 10 }, low)).toBe(0);
    expect(parsed.value.evaluate({ zoom: 5 }, high)).toBe(0.02);
    expect(parsed.value.evaluate({ zoom: 10 }, high)).toBe(0.02);
  });
});
