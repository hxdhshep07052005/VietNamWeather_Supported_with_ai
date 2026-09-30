import { describe, it, expect } from "vitest";
import {
  getCorridorRoutesSync,
  buildRouteGeoDataFromCorridor,
  generateRouteGeoData,
  resolveLocationCoords,
} from "./routePathGenerator";

describe("Route Path Generator & Alternative Corridor Stability", () => {
  it("preserves unavailable weather and colors backend segments independently of route labels", async () => {
    const { buildRouteGeoDataFromCoordinates } = await import("./routePathGenerator");
    const coordinates: [number, number][] = [[105, 21], [105.1, 21], [105.2, 21]];
    const checkpoints = [
      { name: "A", distanceKm: 0, temp: null, rainProb: 0, windKmh: 0, risk: "high" as const, eta: "+0m" },
      { name: "B", distanceKm: 20, temp: null, rainProb: null, windKmh: null, risk: "low" as const, eta: "+55m" },
    ];
    const segments = [{ segment_start: 0, segment_end: 1, risk_level: "high" as const, severity: 3, risk_score: 2 / 3, factors: [], conditions_summary: { vi: "", en: "" } }];
    const result = buildRouteGeoDataFromCoordinates(coordinates, checkpoints, "fastest", "A", "B", segments);
    expect(result.segmentsFeatureCollection.features[0]?.properties?.riskColor).toBe("#EF4444");
    expect(result.checkpointsWithCoords.map(point => point.temp)).toEqual([null, null]);
    expect(result.checkpointsWithCoords[0]?.rainProb).toBe(0);
    expect(result.checkpointsWithCoords[1]?.eta).toBe("+55m");
    const unknown = buildRouteGeoDataFromCoordinates(coordinates, [], "weather_safer", "A", "B");
    expect(unknown.segmentsFeatureCollection.features[0]?.properties?.riskColor).toBe("#64748B");
    expect(unknown.checkpointsWithCoords).toEqual([]);
  });
  it("keeps every sampled segment on sparse geometry with risk colors independent of route type", async () => {
    const { buildRouteGeoDataFromCoordinates } = await import("./routePathGenerator");
    const coordinates: [number, number][] = [[105, 21], [106, 21]];
    const checkpoints = [0, 25, 50, 75, 100].map(distanceKm => ({ distanceKm, temp: null }));
    const levels = ["low", "caution", "high", "unknown"] as const;
    const segments = levels.map((risk_level, index) => ({ segment_start: index, segment_end: index + 1, risk_level }));
    for (const type of ["fastest", "shortest", "weather_safer"] as const) {
      const result = buildRouteGeoDataFromCoordinates(coordinates, checkpoints, type, "A", "B", segments);
      expect(result.segmentsFeatureCollection.features.map(feature => feature.properties?.riskColor)).toEqual(["#22C55E", "#F59E0B", "#EF4444", "#64748B"]);
      expect(result.segmentsFeatureCollection.features.every(feature => feature.geometry.coordinates.length >= 2)).toBe(true);
      expect(result.fullPathCoordinates).toEqual(coordinates);
      expect(result.segmentsFeatureCollection.features[0]?.geometry.coordinates[0]).toEqual(coordinates[0]);
      expect(result.segmentsFeatureCollection.features[3]?.geometry.coordinates.at(-1)).toEqual(coordinates[1]);
    }
  });
  it("uses provisional endpoint colors only when both endpoints have evidence", async () => {
    const { buildRouteGeoDataFromCoordinates } = await import("./routePathGenerator");
    const levels = ["low", "caution", "high", "unknown", "low"] as const;
    const checkpoints = levels.map((risk, index) => ({ risk, provisional: true, distanceKm: index * 25 }));
    const segments = levels.slice(1).map((_, index) => ({ segment_start: index, segment_end: index + 1, risk_level: "unknown" as const }));
    const result = buildRouteGeoDataFromCoordinates([[105, 21], [106, 21]], checkpoints, "weather_safer", "A", "B", segments);
    expect(result.segmentsFeatureCollection.features.map(feature => feature.properties?.riskColor)).toEqual(["#F59E0B", "#EF4444", "#64748B", "#64748B"]);
    expect(result.segmentsFeatureCollection.features.map(feature => feature.properties?.provisional)).toEqual([true, true, false, false]);
    expect(segments.every(segment => segment.risk_level === "unknown")).toBe(true);
    const strict = buildRouteGeoDataFromCoordinates([[105, 21], [106, 21]], checkpoints, "fastest", "A", "B", [{ segment_start: 0, segment_end: 1, risk_level: "low" }]);
    expect(strict.segmentsFeatureCollection.features[0]?.properties?.riskColor).toBe("#22C55E");
    expect(strict.segmentsFeatureCollection.features[0]?.properties?.provisional).toBe(false);
  });
  const corridors = [
    { origin: "Hà Nội", dest: "Lào Cai" },
    { origin: "Đà Nẵng", dest: "Huế" },
    { origin: "Hồ Chí Minh", dest: "Lâm Đồng" },
    { origin: "Hồ Chí Minh", dest: "Bà Rịa - Vũng Tàu" },
    { origin: "Hà Nội", dest: "Hải Phòng" },
  ];

  it("resolves coordinates accurately for key cities and provinces", () => {
    const hn = resolveLocationCoords("Hà Nội");
    expect(hn[0]).toBeCloseTo(105.85, 1);
    expect(hn[1]).toBeCloseTo(21.02, 1);

    const dn = resolveLocationCoords("Đà Nẵng");
    expect(dn[0]).toBeCloseTo(108.20, 1);
    expect(dn[1]).toBeCloseTo(16.05, 1);
  });

  it("retrieves precalculated corridors synchronously with 3 distinct routes", () => {
    for (const c of corridors) {
      const corridor = getCorridorRoutesSync(c.origin, c.dest);
      expect(corridor).not.toBeNull();
      expect(corridor!.routes.weather_safer).toBeDefined();
      expect(corridor!.routes.fastest).toBeDefined();
      expect(corridor!.routes.shortest).toBeDefined();

      // Ensure that fastest and weather_safer are NOT identical!
      expect(corridor!.routes.fastest.coordinates.length).toBeGreaterThan(30);
      expect(corridor!.routes.weather_safer.coordinates.length).toBeGreaterThan(30);
      expect(corridor!.routes.shortest.coordinates.length).toBeGreaterThan(30);

      // Verify that coordinates of fastest and weather_safer differ
      const fastCoords = corridor!.routes.fastest.coordinates;
      const safeCoords = corridor!.routes.weather_safer.coordinates;
      const isIdentical = fastCoords.length === safeCoords.length &&
        fastCoords.every((pt, idx) => pt[0] === safeCoords[idx]![0] && pt[1] === safeCoords[idx]![1]);
      expect(isIdentical).toBe(false);
    }
  });

  it("switches flawlessly between all 3 alternative route types with distinct real road geometries", () => {
    const hnlc = getCorridorRoutesSync("Hà Nội", "Lào Cai")!;
    const types = ["weather_safer", "fastest", "shortest"] as const;

    const mockCheckpoints = [
      { name: "Hà Nội", distanceKm: 0, eta: "08:00", temp: 28, condition: "Nắng", rainProb: 10, windKmh: 12, risk: "low" as const },
      { name: "Vĩnh Phúc", distanceKm: 70, eta: "09:00", temp: 27, condition: "Nắng", rainProb: 15, windKmh: 14, risk: "low" as const },
      { name: "Phú Thọ", distanceKm: 140, eta: "10:00", temp: 26, condition: "Mưa nhẹ", rainProb: 30, windKmh: 15, risk: "caution" as const },
      { name: "Yên Bái", distanceKm: 215, eta: "11:15", temp: 25, condition: "Râm", rainProb: 20, windKmh: 16, risk: "low" as const },
      { name: "Lào Cai", distanceKm: 287, eta: "12:30", temp: 22, condition: "Mát", rainProb: 15, windKmh: 10, risk: "low" as const },
    ];

    const results = types.map((t) =>
      buildRouteGeoDataFromCorridor(hnlc, mockCheckpoints, t, "Hà Nội", "Lào Cai")
    );

    // Verify all 3 are real roads
    results.forEach((res) => {
      expect(res.isRealRoad).toBe(true);
      expect(res.fullPathCoordinates.length).toBeGreaterThan(100);
      expect(res.checkpointsWithCoords.length).toBe(mockCheckpoints.length);
      expect(res.segmentsFeatureCollection.features.length).toBe(mockCheckpoints.length - 1);
    });

    // Verify weather_safer and fastest produce distinct path geometries!
    const [safeRes, fastRes, shortRes] = results;
    expect(safeRes!.distanceKm).not.toBe(fastRes!.distanceKm);
    expect(safeRes!.fullPathCoordinates.length).not.toBe(fastRes!.fullPathCoordinates.length);
    expect(shortRes!.distanceKm).not.toBe(fastRes!.distanceKm);
  });

  it("returns real road data immediately from generateRouteGeoData when corridor is known", () => {
    const geo = generateRouteGeoData("Đà Nẵng", "Huế", [
      { name: "Đà Nẵng", distanceKm: 0 },
      { name: "Đèo Hải Vân", distanceKm: 25 },
      { name: "Lăng Cô", distanceKm: 50 },
      { name: "Huế", distanceKm: 95 },
    ]);

    expect(geo.isRealRoad).toBe(true);
    expect(geo.fullPathCoordinates.length).toBeGreaterThan(100);
    expect(geo.segmentsFeatureCollection.features.length).toBe(3);
  });

  it("builds valid GeoJSON line features with hex riskColors from raw coordinates", async () => {
    const { buildRouteGeoDataFromCoordinates } = await import("./routePathGenerator");
    const rawCoords: [number, number][] = [
      [105.8544, 21.0289],
      [105.7891, 21.1123],
      [105.4321, 21.3456],
      [104.8912, 21.7890],
      [103.9786, 22.4875],
    ];

    const checkpoints = [
      { name: "Hà Nội", distanceKm: 0, risk: "low" as const },
      { name: "Phú Thọ", distanceKm: 120, risk: "caution" as const },
      { name: "Lào Cai", distanceKm: 290, risk: "high" as const },
    ];

    const geoData = buildRouteGeoDataFromCoordinates(rawCoords, checkpoints, "weather_safer", "Hà Nội", "Lào Cai");

    expect(geoData.isRealRoad).toBe(true);
    expect(geoData.bounds).toBeDefined();
    expect(geoData.segmentsFeatureCollection.features.length).toBeGreaterThan(0);

    for (const f of geoData.segmentsFeatureCollection.features) {
      expect(f.geometry.type).toBe("LineString");
      expect(f.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(f.properties?.riskColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
