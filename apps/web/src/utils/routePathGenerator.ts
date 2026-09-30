/**
 * Route Path Generator Utility
 * Resolves geographic coordinates for Origin, Destination, and Checkpoints,
 * and generates smooth, realistic multi-segment polyline GeoJSON paths with risk ratings.
 * 
 * Features:
 * - Precalculated high-precision real road data for all popular Vietnam corridors (0ms latency, offline capable)
 * - Corridor-level caching so switching alternatives never re-fetches from network
 * - Strictly monotonic, distance-proportional checkpoint snapping along real highway geometry
 * - Smooth Catmull-Rom spline fallback when offline / unrouted
 */

import { getAllProvincesData } from "@/data/vietnamGeoJsonWGS84";
import { getPrecalculatedCorridor } from "@/data/precalculatedRoutes";

export interface GeoCheckpoint {
  id: string;
  name: string;
  distanceKm: number;
  eta: string;
  etaShort?: string;
  temp: number | null;
  condition: string;
  rainProb: number | null;
  windKmh: number | null;
  risk: "low" | "caution" | "high" | "unknown";
  note?: string;
  provisional?: boolean;
  coveragePercent?: number;
  coordinates: [number, number]; // [lng, lat]
}

export interface RouteGeoData {
  originCoords: [number, number];
  destinationCoords: [number, number];
  checkpointsWithCoords: GeoCheckpoint[];
  // Full real road polyline coordinates
  fullPathCoordinates: [number, number][];
  // Multi-segment GeoJSON FeatureCollection for risk-colored lines along the real road
  segmentsFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  // Bounding box [minLng, minLat, maxLng, maxLat]
  bounds: [number, number, number, number];
  isRealRoad: boolean;
  distanceKm?: number;
  durationMinutes?: number;
}

export interface CorridorRoute {
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][];
}

export interface CorridorRoutesData {
  originCoords: [number, number];
  destinationCoords: [number, number];
  routes: {
    weather_safer: CorridorRoute;
    fastest: CorridorRoute;
    shortest: CorridorRoute;
  };
}

// Corridor Cache: caches all alternative routes for an (origin, destination) pair
const corridorCache = new Map<string, CorridorRoutesData>();
// GeoData Cache: caches the final multi-segment feature collection for (origin, dest, routeType, cpCount)
const routeDataCache = new Map<string, RouteGeoData>();

// Popular coordinate map for common cities / transport hubs
const POPULAR_LOCATIONS: Record<string, [number, number]> = {
  "hanoi": [105.8544, 21.0285],
  "ha noi": [105.8544, 21.0285],
  "hà nội": [105.8544, 21.0285],
  "sa pa": [103.8438, 22.3364],
  "sapa": [103.8438, 22.3364],
  "lao cai": [103.9754, 22.4856],
  "lào cai": [103.9754, 22.4856],
  "da nang": [108.2022, 16.0544],
  "đà nẵng": [108.2022, 16.0544],
  "hue": [107.5905, 16.4637],
  "thừa thiên huế": [107.5905, 16.4637],
  "huế": [107.5905, 16.4637],
  "ho chi minh": [106.6297, 10.8231],
  "tp. hồ chí minh": [106.6297, 10.8231],
  "hồ chí minh": [106.6297, 10.8231],
  "tp. hcm": [106.6297, 10.8231],
  "da lat": [108.4583, 11.9404],
  "đà lạt": [108.4583, 11.9404],
  "lam dong": [108.4583, 11.9404],
  "lâm đồng": [108.4583, 11.9404],
  "hai phong": [106.6881, 20.8449],
  "hải phòng": [106.6881, 20.8449],
  "quang ninh": [107.1812, 21.2234],
  "quảng ninh": [107.1812, 21.2234],
  "nha trang": [109.1967, 12.2388],
  "khanh hoa": [109.1967, 12.2388],
  "khánh hòa": [109.1967, 12.2388],
  "can tho": [105.7469, 10.0452],
  "cần thơ": [105.7469, 10.0452],
  "vung tau": [107.0843, 10.3460],
  "bà rịa - vũng tàu": [107.0843, 10.3460],
  "vinh phuc": [105.6049, 21.3090],
  "vĩnh phúc": [105.6049, 21.3090],
  "phu tho": [105.2158, 21.3990],
  "phú thọ": [105.2158, 21.3990],
  "yen bai": [104.8726, 21.7229],
  "yên bái": [104.8726, 21.7229],
  "lang co": [108.0100, 16.2300],
  "lăng cô": [108.0100, 16.2300],
  "hai van": [108.1308, 16.1983],
  "hải vân": [108.1308, 16.1983],
  "phu loc": [107.9000, 16.2800],
  "phú lộc": [107.9000, 16.2800],
  "dau giay": [107.1500, 10.9200],
  "dầu giây": [107.1500, 10.9200],
  "dinh quan": [107.3500, 11.2000],
  "định quán": [107.3500, 11.2000],
  "bao loc": [107.8000, 11.5500],
  "bảo lộc": [107.8000, 11.5500],
  "duc trong": [108.3600, 11.7500],
  "đức trọng": [108.3600, 11.7500],
  "long thanh": [106.9500, 10.7800],
  "long thành": [106.9500, 10.7800],
  "phu my": [107.0500, 10.5800],
  "phú mỹ": [107.0500, 10.5800],
  "ba ria": [107.1700, 10.5000],
  "bà rịa": [107.1700, 10.5000],
};

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function getCorridorKey(from: string, to: string): string {
  return `${normalizeStr(from).replace(/\s+/g, "")}_${normalizeStr(to).replace(/\s+/g, "")}`;
}

export function resolveLocationCoords(
  name: string,
  fallback: [number, number] = [105.8544, 21.0285]
): [number, number] {
  if (!name || !name.trim()) return fallback;

  const clean = normalizeStr(name);

  // Check direct popular map
  for (const [key, coords] of Object.entries(POPULAR_LOCATIONS)) {
    if (clean === normalizeStr(key) || clean.includes(normalizeStr(key))) {
      return coords;
    }
  }

  // Check all 63 provinces from official dataset
  const provinces = getAllProvincesData();
  for (const p of provinces) {
    const normPName = normalizeStr(p.name);
    if (clean.includes(normPName) || normPName.includes(clean)) {
      return [p.longitude, p.latitude];
    }
  }

  return fallback;
}

function distSq(c1: [number, number], c2: [number, number]): number {
  const dx = c1[0] - c2[0];
  const dy = c1[1] - c2[1];
  return dx * dx + dy * dy;
}

function haversineKm(c1: [number, number], c2: [number, number]): number {
  const R = 6371;
  const dLat = ((c2[1] - c1[1]) * Math.PI) / 180;
  const dLon = ((c2[0] - c1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1[1] * Math.PI) / 180) * Math.cos((c2[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeBounds(coords: [number, number][]): [number, number, number, number] {
  let minLng = 180,
    maxLng = -180,
    minLat = 90,
    maxLat = -90;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const padLng = Math.max(0.12, (maxLng - minLng) * 0.15);
  const padLat = Math.max(0.12, (maxLat - minLat) * 0.15);
  return [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat];
}

/**
 * Catmull-Rom spline interpolation between 4 control points
 */
function catmullRom(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

/**
 * Automatically prunes dead-end spurs, U-turn loops, and backtracking artifacts from route polylines.
 * A spur occurs when routing navigates into a side road or dead end and returns
 * along the same segment to rejoin the main highway.
 */
export function pruneRouteSpurs(points: [number, number][]): [number, number][] {
  if (points.length < 5) return points;

  const result = [...points];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 8) {
    changed = false;
    iterations++;

    for (let i = 0; i < result.length - 3; i++) {
      const p1 = result[i]!;
      const maxLookAhead = Math.min(result.length, i + 80);

      for (let j = i + 3; j < maxLookAhead; j++) {
        const p2 = result[j]!;
        const dx = (p1[0] - p2[0]) * 102000;
        const dy = (p1[1] - p2[1]) * 111000;
        const distSq = dx * dx + dy * dy;

        // If returned to within 45 meters of a previous node
        if (distSq < 2025) {
          let pathLen = 0;
          for (let k = i; k < j; k++) {
            const pk1 = result[k]!;
            const pk2 = result[k + 1]!;
            const dkx = (pk1[0] - pk2[0]) * 102000;
            const dky = (pk1[1] - pk2[1]) * 111000;
            pathLen += Math.sqrt(dkx * dkx + dky * dky);
          }

          const straightDist = Math.sqrt(distSq);
          // If the path length is more than 80 meters and at least 3x the straight distance,
          // this is a dead-end spur/loop that visits a side road and doubles back!
          if (pathLen > 80 && pathLen > straightDist * 3) {
            result.splice(i + 1, j - i);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }
  }

  return result;
}

/**
 * Retrieve corridor routes synchronously if already in memory or precalculated dataset.
 * Returns null if this is a custom route that hasn't been fetched yet.
 */
export function getCorridorRoutesSync(
  originName: string,
  destinationName: string
): CorridorRoutesData | null {
  const key = getCorridorKey(originName, destinationName);
  if (corridorCache.has(key)) {
    return corridorCache.get(key)!;
  }

  // Check precalculated high-precision routes dataset
  const precalc = getPrecalculatedCorridor(originName, destinationName);
  if (precalc) {
    const originCoords = precalc.fastest.coordinates[0]!;
    const destinationCoords = precalc.fastest.coordinates[precalc.fastest.coordinates.length - 1]!;
    const corridorData: CorridorRoutesData = {
      originCoords,
      destinationCoords,
      routes: precalc,
    };
    corridorCache.set(key, corridorData);
    return corridorData;
  }

  return null;
}

/**
 * Build RouteGeoData from a known CorridorRoutesData with strict, monotonic checkpoint snapping.
 * Instant execution (0ms), completely eliminates race conditions and erratic lines!
 */
export function buildRouteGeoDataFromCorridor(
  corridor: CorridorRoutesData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawCheckpoints: any[] = [],
  routeType: "fastest" | "weather_safer" | "shortest" = "weather_safer",
  originName = "",
  destinationName = ""
): RouteGeoData {
  const cacheKey = `corridor_${originName}_${destinationName}_${routeType}_${rawCheckpoints.length}`;
  if (routeDataCache.has(cacheKey)) {
    return routeDataCache.get(cacheKey)!;
  }

  // Pick the distinct route geometry matching routeType
  const chosenRoute =
    corridor.routes[routeType] ||
    corridor.routes.weather_safer ||
    corridor.routes.fastest;
  const roadCoords = pruneRouteSpurs(chosenRoute.coordinates);
  const numCoords = roadCoords.length;

  // Compute cumulative distance along the chosen real road polyline
  const cumDist: number[] = [0];
  for (let i = 1; i < numCoords; i++) {
    cumDist.push(cumDist[i - 1]! + haversineKm(roadCoords[i - 1]!, roadCoords[i]!));
  }
  const totalRoadKm = cumDist[numCoords - 1] || chosenRoute.distanceKm;

  // Resolve initial checkpoints
  const initialCheckpoints: GeoCheckpoint[] = rawCheckpoints.map((cp, idx) => {
    let coords: [number, number];
    if (idx === 0) {
      coords = roadCoords[0]!;
    } else if (idx === rawCheckpoints.length - 1) {
      coords = roadCoords[numCoords - 1]!;
    } else {
      const resolved = resolveLocationCoords(cp.name, [0, 0]);
      coords = resolved[0] !== 0 ? resolved : [0, 0];
    }
    return {
      id: `cp-${idx}`,
      name: cp.name,
      distanceKm: cp.distanceKm || 0,
      eta: cp.eta || "--:--",
      temp: cp.temp ?? 26,
      condition: cp.condition || "Thời tiết bình thường",
      rainProb: cp.rainProb || 0,
      windKmh: cp.windKmh || 10,
      risk: cp.risk || "low",
      note: cp.note,
      coordinates: coords,
    };
  });

  const numCps = initialCheckpoints.length;
  const snapIndices: number[] = [0];
  const checkpointsWithCoords: GeoCheckpoint[] = [];

  if (numCps >= 2) {
    // Origin checkpoint
    checkpointsWithCoords.push({
      ...initialCheckpoints[0]!,
      coordinates: roadCoords[0]!,
    });

    const destDistSpec = initialCheckpoints[numCps - 1]!.distanceKm || totalRoadKm;

    // Intermediate checkpoints: strictly monotonic search along cumulative road distance
    for (let c = 1; c < numCps - 1; c++) {
      const cp = initialCheckpoints[c]!;
      const prevIdx = snapIndices[c - 1]!;
      const minIdx = prevIdx + 1;
      const maxIdx = numCoords - (numCps - c);

      const targetKm =
        cp.distanceKm > 0 && destDistSpec > 0
          ? (cp.distanceKm / destDistSpec) * totalRoadKm
          : (c / (numCps - 1)) * totalRoadKm;

      let bestIdx = minIdx;
      let bestScore = Infinity;

      for (let j = minIdx; j <= maxIdx; j++) {
        // Distance difference penalty
        const distDiffRatio = (cumDist[j]! - targetKm) / totalRoadKm;
        let score = distDiffRatio * distDiffRatio * 15;

        // If checkpoint has a known geographical coordinate, factor in proximity
        if (cp.coordinates[0] !== 0) {
          const gDist = distSq(roadCoords[j]!, cp.coordinates);
          score += gDist;
        }

        if (score < bestScore) {
          bestScore = score;
          bestIdx = j;
        }
      }

      snapIndices.push(bestIdx);
      checkpointsWithCoords.push({
        ...cp,
        coordinates: roadCoords[bestIdx]!,
      });
    }

    // Destination checkpoint
    snapIndices.push(numCoords - 1);
    checkpointsWithCoords.push({
      ...initialCheckpoints[numCps - 1]!,
      coordinates: roadCoords[numCoords - 1]!,
    });
  } else {
    snapIndices.push(numCoords - 1);
    checkpointsWithCoords.push(
      { ...initialCheckpoints[0]!, coordinates: roadCoords[0]! },
      {
        id: "cp-dest",
        name: destinationName || "Điểm đến",
        distanceKm: chosenRoute.distanceKm,
        eta: "--:--",
        temp: 26,
        condition: "Bình thường",
        rainProb: 15,
        windKmh: 12,
        risk: "low",
        coordinates: roadCoords[numCoords - 1]!,
      }
    );
  }

  // Build GeoJSON LineString segments along the real road
  const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  for (let s = 0; s < snapIndices.length - 1; s++) {
    const fromIdx = snapIndices[s]!;
    const toIdx = snapIndices[s + 1]!;
    const segCoords = roadCoords.slice(fromIdx, toIdx + 1);

    const targetCp = checkpointsWithCoords[s + 1] || checkpointsWithCoords[s];
    const segmentRisk = targetCp?.risk || "low";
    const riskColor =
      segmentRisk === "high"
        ? "#EF4444"
        : segmentRisk === "caution"
        ? "#F59E0B"
        : routeType === "weather_safer"
        ? "#10B981"
        : "#0EA5E9";

    lineFeatures.push({
      type: "Feature",
      properties: {
        segmentIndex: s,
        risk: segmentRisk,
        riskColor,
        fromName: checkpointsWithCoords[s]?.name || originName,
        toName: targetCp?.name || destinationName,
      },
      geometry: {
        type: "LineString",
        coordinates: segCoords,
      },
    });
  }

  const bounds = computeBounds(roadCoords);

  const result: RouteGeoData = {
    originCoords: roadCoords[0]!,
    destinationCoords: roadCoords[numCoords - 1]!,
    checkpointsWithCoords,
    fullPathCoordinates: roadCoords,
    segmentsFeatureCollection: {
      type: "FeatureCollection",
      features: lineFeatures,
    },
    bounds,
    isRealRoad: true,
    distanceKm: chosenRoute.distanceKm,
    durationMinutes: chosenRoute.durationMinutes,
  };

  routeDataCache.set(cacheKey, result);
  return result;
}

/**
 * Synchronous local path generator (Instant initial render & offline fallback)
 * Uses precalculated routes if available, or generates smooth Catmull-Rom spline curves.
 */
export function generateRouteGeoData(
  originName: string,
  destinationName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawCheckpoints: any[] = [],
  routeType: "fastest" | "weather_safer" | "shortest" = "weather_safer"
): RouteGeoData {
  // First check if corridor is available synchronously (e.g. precalculated preset)
  const syncCorridor = getCorridorRoutesSync(originName, destinationName);
  if (syncCorridor) {
    return buildRouteGeoDataFromCorridor(syncCorridor, rawCheckpoints, routeType, originName, destinationName);
  }

  const cacheKey = `local_${originName}_${destinationName}_${routeType}_${rawCheckpoints.length}`;
  if (routeDataCache.has(cacheKey)) {
    return routeDataCache.get(cacheKey)!;
  }

  const originCoords = resolveLocationCoords(originName, [105.8544, 21.0285]);
  const destinationCoords = resolveLocationCoords(destinationName, [103.9754, 22.4856]);

  const numCheckpoints = rawCheckpoints.length;

  const checkpointsWithCoords: GeoCheckpoint[] = rawCheckpoints.map((cp, idx) => {
    let coords: [number, number];
    if (idx === 0) {
      coords = originCoords;
    } else if (idx === numCheckpoints - 1) {
      coords = destinationCoords;
    } else {
      const resolved = resolveLocationCoords(cp.name, [0, 0]);
      if (resolved[0] !== 0) {
        coords = resolved;
      } else {
        const t = idx / (numCheckpoints - 1);
        const lng = originCoords[0] + (destinationCoords[0] - originCoords[0]) * t;
        const lat = originCoords[1] + (destinationCoords[1] - originCoords[1]) * t;
        coords = [Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000];
      }
    }
    return {
      id: `cp-${idx}`,
      name: cp.name,
      distanceKm: cp.distanceKm || 0,
      eta: cp.eta || "--:--",
      temp: cp.temp ?? 26,
      condition: cp.condition || "Thời tiết bình thường",
      rainProb: cp.rainProb || 0,
      windKmh: cp.windKmh || 10,
      risk: cp.risk || "low",
      note: cp.note,
      coordinates: coords,
    };
  });

  // Generate smooth Catmull-Rom spline path through checkpoints to avoid crude straight lines
  const keyWaypoints = checkpointsWithCoords.map((cp) => cp.coordinates);
  if (keyWaypoints.length < 2) {
    keyWaypoints.push(destinationCoords);
  }

  const fullPathCoordinates: [number, number][] = [];
  const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  for (let i = 0; i < keyWaypoints.length - 1; i++) {
    const p0 = i === 0 ? keyWaypoints[0]! : keyWaypoints[i - 1]!;
    const p1 = keyWaypoints[i]!;
    const p2 = keyWaypoints[i + 1]!;
    const p3 = i + 2 < keyWaypoints.length ? keyWaypoints[i + 2]! : p2;

    const segmentPoints: [number, number][] = [];
    const steps = 15;
    for (let s = 0; s <= steps; s++) {
      segmentPoints.push(catmullRom(p0, p1, p2, p3, s / steps));
    }

    if (i === 0) {
      fullPathCoordinates.push(...segmentPoints);
    } else {
      fullPathCoordinates.push(...segmentPoints.slice(1));
    }

    const targetCp = checkpointsWithCoords[i + 1] || checkpointsWithCoords[i];
    const segmentRisk = targetCp?.risk || "low";
    const riskColor =
      segmentRisk === "high" ? "#EF4444" : segmentRisk === "caution" ? "#F59E0B" : "#0EA5E9";

    lineFeatures.push({
      type: "Feature",
      properties: {
        segmentIndex: i,
        risk: segmentRisk,
        riskColor,
        fromName: checkpointsWithCoords[i]?.name || originName,
        toName: targetCp?.name || destinationName,
      },
      geometry: {
        type: "LineString",
        coordinates: segmentPoints,
      },
    });
  }

  const bounds = computeBounds(fullPathCoordinates);

  const result: RouteGeoData = {
    originCoords,
    destinationCoords,
    checkpointsWithCoords,
    fullPathCoordinates,
    segmentsFeatureCollection: {
      type: "FeatureCollection",
      features: lineFeatures,
    },
    bounds,
    isRealRoad: false,
  };

  routeDataCache.set(cacheKey, result);
  return result;
}

/**
 * Fetch REAL road geometry from OpenStreetMap OSRM driving API
 * Caches the entire corridor in memory so subsequent alternative clicks return in 0ms!
 */
export function buildRouteGeoDataFromCoordinates(
  coordinates: [number, number][],
  rawCheckpoints: ReadonlyArray<Partial<GeoCheckpoint>> = [],
  _routeType: "fastest" | "weather_safer" | "shortest" = "weather_safer",
  originName = "Origin",
  destinationName = "Destination",
  segmentRisks: ReadonlyArray<{ readonly segment_start: number; readonly segment_end: number; readonly risk_level: GeoCheckpoint["risk"] }> = [],
): RouteGeoData {
  const originCoords = coordinates[0] ?? [106.5, 16.2];
  const destinationCoords = coordinates.at(-1) ?? originCoords;
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const previous = coordinates[i - 1];
    const current = coordinates[i];
    if (previous && current) cumulative.push((cumulative[i - 1] ?? 0) + haversineKm(previous, current));
  }
  const totalDistance = cumulative.at(-1) ?? 0;
  const reportedDistance = rawCheckpoints.at(-1)?.distanceKm ?? totalDistance;
  const pointAt = (distance: number): { coordinates: [number, number]; distance: number } => {
    const target = Math.max(0, Math.min(totalDistance, reportedDistance > 0 ? distance / reportedDistance * totalDistance : 0));
    const index = cumulative.findIndex(value => value >= target);
    const after = coordinates[index];
    const before = coordinates[Math.max(0, index - 1)];
    if (!after || !before) return { coordinates: destinationCoords, distance: target };
    const start = cumulative[Math.max(0, index - 1)] ?? 0;
    const length = (cumulative[index] ?? 0) - start;
    const fraction = length > 0 ? (target - start) / length : 0;
    return { coordinates: [before[0] + (after[0] - before[0]) * fraction, before[1] + (after[1] - before[1]) * fraction], distance: target };
  };
  const checkpointsWithCoords: GeoCheckpoint[] = rawCheckpoints.map((point, index) => ({
    id: point.id ?? String(index), name: point.name ?? "", distanceKm: point.distanceKm ?? 0,
    eta: point.eta ?? "", etaShort: point.etaShort, temp: point.temp ?? null, condition: point.condition ?? "",
    rainProb: point.rainProb ?? null, windKmh: point.windKmh ?? null, risk: point.risk ?? "unknown", note: point.note, provisional: point.provisional, coveragePercent: point.coveragePercent,
    coordinates: point.coordinates ?? pointAt(point.distanceKm ?? 0).coordinates,
  }));
  const colors = { low: "#22C55E", caution: "#F59E0B", high: "#EF4444", unknown: "#64748B" };
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (let index = 0; index < checkpointsWithCoords.length - 1; index++) {
    const start = checkpointsWithCoords[index];
    const end = checkpointsWithCoords[index + 1];
    if (!start || !end) continue;
    const from = pointAt(start.distanceKm), to = pointAt(end.distanceKm);
    const strictRisk = segmentRisks.find(segment => segment.segment_start === index && segment.segment_end === index + 1)?.risk_level ?? "unknown";
    const provisionalLevels = [start.risk, end.risk];
    const provisionalRisk = strictRisk === "unknown" && start.provisional && end.provisional && !provisionalLevels.includes("unknown")
      ? (["high", "caution", "low"] as const).find(level => provisionalLevels.includes(level)) ?? "unknown"
      : "unknown";
    const isProvisional = strictRisk === "unknown" && provisionalRisk !== "unknown";
    const risk = isProvisional ? provisionalRisk : strictRisk;
    features.push({ type: "Feature", properties: { segmentIndex: index, risk, riskColor: colors[risk], provisional: isProvisional, fromName: start.name, toName: end.name },
      geometry: { type: "LineString", coordinates: [from.coordinates, ...coordinates.filter((_, i) => (cumulative[i] ?? 0) > from.distance && (cumulative[i] ?? 0) < to.distance), to.coordinates] } });
  }
  if (features.length === 0 && coordinates.length >= 2) {
    features.push({ type: "Feature", properties: { segmentIndex: 0, risk: "unknown", riskColor: colors.unknown, fromName: originName, toName: destinationName }, geometry: { type: "LineString", coordinates } });
  }
  return { originCoords, destinationCoords, checkpointsWithCoords, fullPathCoordinates: coordinates,
    segmentsFeatureCollection: { type: "FeatureCollection", features }, bounds: coordinates.length ? computeBounds(coordinates) : [102, 8, 110, 24],
    isRealRoad: coordinates.length >= 2, distanceKm: Math.round(totalDistance) };
}

export async function fetchRealRouteGeoData(
  originName: string,
  destinationName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawCheckpoints: any[] = [],
  routeType: "fastest" | "weather_safer" | "shortest" = "weather_safer"
): Promise<RouteGeoData> {
  // Check if corridor is already in memory or precalculated dataset
  const syncCorridor = getCorridorRoutesSync(originName, destinationName);
  if (syncCorridor) {
    return buildRouteGeoDataFromCorridor(syncCorridor, rawCheckpoints, routeType, originName, destinationName);
  }

  const corridorKey = getCorridorKey(originName, destinationName);
  if (corridorCache.has(corridorKey)) {
    return buildRouteGeoDataFromCorridor(
      corridorCache.get(corridorKey)!,
      rawCheckpoints,
      routeType,
      originName,
      destinationName
    );
  }

  // Pure client-side spline generation (ARCH-003: no third-party OSRM calls from browser)
  return generateRouteGeoData(originName, destinationName, rawCheckpoints, routeType);
}
