import type { Pool } from "pg";
import type { SamplePoint, SegmentRisk, VehicleType, ReportAssessment, RouteAlternative } from "@vietnam-weather/contracts";
import { assessReportHazard, REPORT_LEVELS } from "../risk/report-hazard.js";
import { readWeatherEvidence } from "../risk/weather-evidence.js";
import { provisionalPointAssessment } from "./provisional-risk.js";
import { REPORT_RULES_V1 } from "../risk/report-rules-v1.js";

export interface RouteRiskEngineOptions { readonly dbPool: Pool }
export class RouteRiskEngine {
  constructor(private readonly options: RouteRiskEngineOptions) {}

  async calculatePointRisks(samples: SamplePoint[], vehicle: VehicleType): Promise<Map<number, ReportAssessment>> {
    const results = new Map<number, ReportAssessment>();
    const now = new Date();
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, samples.length) }, async () => {
      while (cursor < samples.length) {
        const index = cursor++;
        const sample = samples[index]!;
        const weather = await readWeatherEvidence(this.options.dbPool, sample.coordinates, new Date(sample.eta), now);
        const assessment = assessReportHazard(weather, vehicle);
        samples[index] = { ...sample, weather, assessment, provisional_assessment: provisionalPointAssessment(assessment), has_weather_data: weather.coverage === "covered",
          weather_freshness: weather.freshness };
        results.set(index, assessment);
      }
    }));
    return results;
  }

  calculateSegmentRisks(points: Map<number, ReportAssessment>, samples: SamplePoint[]): SegmentRisk[] {
    return samples.slice(1).map((end, index) => {
      const a = points.get(index), b = points.get(index + 1);
      const distance = end.distance_from_start_meters - samples[index]!.distance_from_start_meters;
      const eligible = !!a?.severity && !!b?.severity && Number.isFinite(distance) && distance > 0;
      const severity = eligible ? Math.max(a.severity, b.severity) : 0;
      return { segment_start: index, segment_end: index + 1, distance_meters: distance,
        severity, risk_level: REPORT_LEVELS[severity]!,
        risk_score: eligible ? (a.severity + b.severity) / 6 : null,
        factors: [...new Set([...(a?.reasons ?? []), ...(b?.reasons ?? [])])],
        conditions_summary: { vi: eligible ? "Đánh giá theo Bảng 3.1" : "Chưa đủ dữ liệu", en: eligible ? "Report Table 3.1 assessment" : "Insufficient data" } };
    });
  }

  calculateRouteRisk(segments: SegmentRisk[]): RouteAlternative["route_risk"] {
    const eligible = segments.length > 0 && segments.every(s => s.risk_score !== null && s.severity > 0 &&
      Number.isFinite(s.distance_meters) && s.distance_meters! > 0);
    const total = segments.reduce((sum, s) => sum + (s.distance_meters ?? 0), 0);
    const score = eligible && total > 0 ? segments.reduce((sum, s) => sum + s.risk_score! * s.distance_meters!, 0) / total : null;
    return { level: score === null ? "unknown" : REPORT_LEVELS[Math.max(...segments.map(s => s.severity))]!, 
      score, confidence: segments.length ? Math.round(100 * segments.filter(s => s.risk_score !== null).length / segments.length) : 0,
      rule_set_version: REPORT_RULES_V1.version };
  }
}
export function createRouteRiskEngine(options: RouteRiskEngineOptions): RouteRiskEngine { return new RouteRiskEngine(options); }
