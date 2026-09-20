import { describe, it, expect } from "vitest";
import {
  getCorridorRoutesSync,
  buildRouteGeoDataFromCorridor,
  generateRouteGeoData,
  resolveLocationCoords,
} from "./routePathGenerator";

describe("Route Path Generator & Alternative Corridor Stability", () => {
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
});
