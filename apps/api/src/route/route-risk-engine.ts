/**
 * Phase 8 Route Risk Engine
 * Integrates Phase 6 risk engine with route sampling
 *
 * Calculates risk along route segments and overall route risk
 */

import type { Pool } from "pg";

import {
  type SamplePoint,
  type SegmentRisk,
} from "@vietnam-weather/contracts";

// =============================================================================
// Types
// =============================================================================

export interface RouteRiskEngineOptions {
  readonly dbPool: Pool;
}

interface RiskResult {
  risk_level: "low" | "caution" | "high" | "unknown";
  risk_score: number;
  severity: number;
  factors: string[];
  conditions_summary: { vi: string; en: string };
}

interface WeatherAtPoint {
  temp_c: number | null;
  precip_mm: number | null;
  wind_speed: number | null;
  vis_km: number | null;
  condition_code: number | null;
  freshness: string;
}

// =============================================================================
// Risk Level Mapping
// =============================================================================

const RISK_LEVEL_MAP: Record<number, "low" | "caution" | "high" | "unknown"> = {
  1: "low",
  2: "caution",
  3: "high",
  4: "unknown",
};

// =============================================================================
// Route Risk Engine
// =============================================================================

export class RouteRiskEngine {
  private readonly dbPool: Pool;

  constructor(options: RouteRiskEngineOptions) {
    this.dbPool = options.dbPool;
  }

  /**
   * Calculate risk for each sample point along route
   */
  async calculatePointRisks(samples: SamplePoint[]): Promise<Map<number, RiskResult>> {
    const results = new Map<number, RiskResult>();

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!;
      
      if (!sample.has_weather_data) {
        results.set(i, {
          risk_level: "unknown",
          risk_score: 1.0,
          severity: 4,
          factors: ["No weather data available"],
          conditions_summary: {
            vi: "Không có dữ liệu thời tiết",
            en: "No weather data available",
          },
        });
        continue;
      }

      const weather = await this.getWeatherAtPoint(sample.coordinates, sample.eta);
      const risk = this.calculateRisk(weather, sample.weather_freshness);
      results.set(i, risk);
    }

    return results;
  }

  /**
   * Calculate segment risks
   */
  calculateSegmentRisks(
    pointRisks: Map<number, RiskResult>,
    segments: Array<{ start: number; end: number }>
  ): SegmentRisk[] {
    return segments.map(segment => {
      const segmentRisks = Array.from(pointRisks.entries())
        .filter(([i]) => i >= segment.start && i <= segment.end)
        .map(([, risk]) => risk);

      if (segmentRisks.length === 0) {
        return {
          segment_start: segment.start,
          segment_end: segment.end,
          risk_level: "unknown" as const,
          risk_score: 1.0,
          severity: 4,
          factors: [],
          conditions_summary: {
            vi: "Không có dữ liệu",
            en: "No data",
          },
        };
      }

      // Max severity aggregation (per RISK-005)
      const maxSeverity = Math.max(...segmentRisks.map(r => r.severity));
      const maxRisk = segmentRisks.find(r => r.severity === maxSeverity)!;
      const avgScore = segmentRisks.reduce((sum, r) => sum + r.risk_score, 0) / segmentRisks.length;

      // Combine factors
      const allFactors = segmentRisks
        .flatMap(r => r.factors)
        .filter((f, i, arr) => arr.indexOf(f) === i); // Unique

      return {
        segment_start: segment.start,
        segment_end: segment.end,
        risk_level: RISK_LEVEL_MAP[maxSeverity] ?? "unknown",
        risk_score: avgScore,
        severity: maxSeverity,
        factors: allFactors,
        conditions_summary: {
          vi: maxRisk.conditions_summary.vi,
          en: maxRisk.conditions_summary.en,
        },
      };
    });
  }

  /**
   * Calculate overall route risk
   */
  calculateRouteRisk(segmentRisks: SegmentRisk[]): {
    level: "low" | "caution" | "high" | "unknown";
    score: number;
    confidence: number;
  } {
    if (segmentRisks.length === 0) {
      return {
        level: "unknown",
        score: 1.0,
        confidence: 0,
      };
    }

    // Max severity aggregation
    const maxSeverity = Math.max(...segmentRisks.map(s => s.severity));

    // Weighted average score (by segment length)
    const totalScore = segmentRisks.reduce((sum, s) => sum + s.risk_score, 0);
    const avgScore = totalScore / segmentRisks.length;

    // Confidence based on data availability
    const unknownSegments = segmentRisks.filter(s => s.risk_level === "unknown").length;
    const confidence = Math.round(
      ((segmentRisks.length - unknownSegments) / segmentRisks.length) * 100
    );

    return {
      level: RISK_LEVEL_MAP[maxSeverity] ?? "unknown",
      score: avgScore,
      confidence,
    };
  }

  /**
   * Get weather at a specific point and time
   */
  private async getWeatherAtPoint(
    coordinates: { latitude: number; longitude: number },
    eta: string
  ): Promise<WeatherAtPoint> {
    try {
      const result = await this.dbPool.query<WeatherAtPoint>(
        `SELECT 
           temp_c,
           precip_mm,
           wind_speed,
           vis_km,
           condition_code,
           freshness
         FROM app_weather.weather_hourly_forecasts
         WHERE ST_DWithin(
           coordinates::geometry,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           5000  -- 5km tolerance
         )
         AND valid_at <= $3
         ORDER BY valid_at DESC
         LIMIT 1`,
        [coordinates.longitude, coordinates.latitude, eta]
      );

      if (result.rows.length === 0) {
        return {
          temp_c: null,
          precip_mm: null,
          wind_speed: null,
          vis_km: null,
          condition_code: null,
          freshness: "unavailable",
        };
      }

      return result.rows[0]!;
    } catch {
      return {
        temp_c: null,
        precip_mm: null,
        wind_speed: null,
        vis_km: null,
        condition_code: null,
        freshness: "unavailable",
      };
    }
  }

  /**
   * Calculate risk from weather data
   */
  private calculateRisk(
    weather: WeatherAtPoint,
    freshness?: string
  ): RiskResult {
    // Handle stale/unavailable data (per RISK-006)
    if (freshness === "stale" || freshness === "expired" || freshness === "unavailable") {
      return {
        risk_level: "unknown",
        risk_score: 1.0,
        severity: 4,
        factors: ["Data is stale or unavailable"],
        conditions_summary: {
          vi: "Dữ liệu không còn mới",
          en: "Data may be outdated",
        },
      };
    }

    const factors: string[] = [];
    let severity = 1; // Default to Low

    // Temperature check (>35°C caution, >38°C high)
    if (weather.temp_c !== null) {
      if (weather.temp_c > 38) {
        severity = Math.max(severity, 3);
        factors.push("Extreme heat");
      } else if (weather.temp_c > 35) {
        severity = Math.max(severity, 2);
        factors.push("High temperature");
      }
    }

    // Precipitation check (>25mm/h high, >10mm/h caution)
    if (weather.precip_mm !== null) {
      if (weather.precip_mm > 25) {
        severity = Math.max(severity, 3);
        factors.push("Heavy rain");
      } else if (weather.precip_mm > 10) {
        severity = Math.max(severity, 2);
        factors.push("Moderate rain");
      }
    }

    // Wind check (>15 m/s high, >10 m/s caution)
    if (weather.wind_speed !== null) {
      if (weather.wind_speed > 15) {
        severity = Math.max(severity, 3);
        factors.push("Strong wind");
      } else if (weather.wind_speed > 10) {
        severity = Math.max(severity, 2);
        factors.push("Moderate wind");
      }
    }

    // Visibility check (<1km high, <5km caution)
    if (weather.vis_km !== null) {
      if (weather.vis_km < 1) {
        severity = Math.max(severity, 3);
        factors.push("Very low visibility");
      } else if (weather.vis_km < 5) {
        severity = Math.max(severity, 2);
        factors.push("Reduced visibility");
      }
    }

    // Thunderstorm check (condition codes 1087, 1273, 1276, 1279, 1282)
    if (weather.condition_code !== null) {
      const thunderstormCodes = [1087, 1273, 1276, 1279, 1282];
      if (thunderstormCodes.includes(weather.condition_code)) {
        severity = 3;
        factors.push("Thunderstorm");
      }
    }

    const riskScore = severity / 3; // Normalize to 0-1
    const riskLevel = RISK_LEVEL_MAP[severity] ?? "unknown";

    return {
      risk_level: riskLevel,
      risk_score: riskScore,
      severity,
      factors,
      conditions_summary: {
        vi: factors.length > 0 ? factors.join(", ") : "Thời tiết thuận lợi",
        en: factors.length > 0 ? factors.join(", ") : "Favorable conditions",
      },
    };
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRouteRiskEngine(options: RouteRiskEngineOptions): RouteRiskEngine {
  return new RouteRiskEngine(options);
}
