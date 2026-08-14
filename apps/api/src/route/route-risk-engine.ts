/**
 * Phase 8 Route Risk Engine
 * Integrates Phase 6 risk engine with route sampling
 *
 * Calculates risk along route segments and overall route risk
 * Uses Phase 6 evaluateRisk() for individual point risk evaluation
 * (config-driven thresholds, no hardcoded values)
 */

import type { Pool } from "pg";

import {
  type SamplePoint,
  type SegmentRisk,
  type NormalizedWeatherInput,
  type FreshnessState,
  RISK_SEVERITY_SCORES,
} from "@vietnam-weather/contracts";

import {
  evaluateRisk,
  type RiskRule,
  type RiskRuleSet,
  type RiskAssessmentResult,
} from "../risk/risk-engine.js";

// =============================================================================
// Types
// =============================================================================

export interface RouteRiskEngineOptions {
  readonly dbPool: Pool;
  readonly ruleSet: RiskRuleSet;
  readonly rules: readonly RiskRule[];
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
  freshness: FreshnessState;
}

// =============================================================================
// Risk Level Mapping (per RISK-005: Max severity aggregation)
// Uses Phase 6 risk severity scores: LOW=1, CAUTION=2, HIGH=3, UNKNOWN=0
// =============================================================================

const RISK_LEVEL_MAP: Record<number, "low" | "caution" | "high" | "unknown"> = {
  0: "unknown",
  1: "low",
  2: "caution",
  3: "high",
};

// =============================================================================
// Route Risk Engine
// =============================================================================

export class RouteRiskEngine {
  private readonly dbPool: Pool;
  private readonly ruleSet: RiskRuleSet;
  private readonly rules: readonly RiskRule[];

  constructor(options: RouteRiskEngineOptions) {
    this.dbPool = options.dbPool;
    this.ruleSet = options.ruleSet;
    this.rules = options.rules;
  }

  /**
   * Calculate risk for each sample point along route
   * Uses Phase 6 evaluateRisk() with config-driven rules
   */
  async calculatePointRisks(samples: SamplePoint[]): Promise<Map<number, RiskResult>> {
    const results = new Map<number, RiskResult>();

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!;

      if (!sample.has_weather_data) {
        results.set(i, {
          risk_level: "unknown",
          risk_score: 1.0,
          severity: 0, // RISK-005: UNKNOWN = 0
          factors: ["No weather data available"],
          conditions_summary: {
            vi: "Không có dữ liệu thời tiết",
            en: "No weather data available",
          },
        });
        continue;
      }

      const weather = await this.getWeatherAtPoint(sample.coordinates, sample.eta);
      const risk = this.evaluateWithPhase6Engine(weather);
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
          severity: 0, // RISK-005: UNKNOWN = 0
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
   * Evaluate risk using Phase 6 config-driven risk engine
   * No hardcoded thresholds - all rules come from Phase 6 risk rule set
   */
  private evaluateWithPhase6Engine(weather: WeatherAtPoint): RiskResult {
    // Handle stale/unavailable data (per RISK-006)
    if (!weather.freshness || weather.freshness !== "fresh") {
      return {
        risk_level: "unknown",
        risk_score: 1.0,
        severity: 0, // RISK-005: UNKNOWN = 0
        factors: ["Data is stale or unavailable"],
        conditions_summary: {
          vi: "Dữ liệu không còn mới",
          en: "Data may be outdated",
        },
      };
    }

    // Convert to Phase 6 NormalizedWeatherInput format
    const normalizedWeather: NormalizedWeatherInput = {
      temp_c: weather.temp_c ?? undefined,
      wind_speed: weather.wind_speed ?? undefined,
      vis_km: weather.vis_km ?? undefined,
      rain_mm: weather.precip_mm ?? undefined,
      thunderstorm: this.isThunderstormCode(weather.condition_code) ? 1 : 0,
      condition_code: weather.condition_code ?? undefined,
    };

    // Delegate to Phase 6 evaluateRisk (uses config-driven rules)
    const assessment: RiskAssessmentResult = evaluateRisk(
      normalizedWeather,
      weather.freshness,
      { rule_set: this.ruleSet, rules: this.rules }
    );

    const severity = RISK_SEVERITY_SCORES[assessment.level];
    const riskScore = severity / 3;

    return {
      risk_level: assessment.level,
      risk_score: riskScore,
      severity,
      factors: assessment.triggered_rules.map(r => r.external_key),
      conditions_summary: {
        vi: this.generateConditionsSummary(assessment, "vi"),
        en: this.generateConditionsSummary(assessment, "en"),
      },
    };
  }

  /**
   * Check if weather condition code indicates thunderstorm
   */
  private isThunderstormCode(conditionCode: number | null): boolean {
    if (conditionCode === null) return false;
    return [1087, 1273, 1276, 1279, 1282].includes(conditionCode);
  }

  /**
   * Generate conditions summary from Phase 6 risk assessment
   */
  private generateConditionsSummary(
    assessment: RiskAssessmentResult,
    language: "vi" | "en"
  ): string {
    if (assessment.triggered_rules.length === 0) {
      return language === "vi" ? "Thời tiết thuận lợi" : "Favorable conditions";
    }
    return assessment.triggered_rules
      .map(r => r.dimension)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(", ");
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createRouteRiskEngine(options: RouteRiskEngineOptions): RouteRiskEngine {
  return new RouteRiskEngine(options);
}
