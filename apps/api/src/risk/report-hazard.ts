import type { ReportAssessment, ReportLevel, ReportSeverity, ReportWeatherEvidence, VehicleType } from "@vietnam-weather/contracts";
import { REPORT_RULES_V1 } from "./report-rules-v1.js";

export const REPORT_LEVELS: readonly ReportLevel[] = ["unknown", "low", "caution", "high"];
const finite = (n: number | null): n is number => n !== null && Number.isFinite(n);

export function assessReportHazard(
  weather: ReportWeatherEvidence,
  vehicle?: VehicleType,
  rules: typeof REPORT_RULES_V1 | null = REPORT_RULES_V1,
): ReportAssessment {
  const thresholds = rules && (vehicle ? rules.vehicles[vehicle] : rules.general);
  const increasing = (n: number | null, bounds: readonly [number, number]): ReportSeverity =>
    !finite(n) || n < 0 ? 0 : n >= bounds[1] ? 3 : n >= bounds[0] ? 2 : 1;
  const temp = weather.temperature_c;
  const vis = weather.visibility_m;
  const t = thresholds?.temperature;
  const storm = weather.storm;
  const alert = weather.official_alert_level;
  const evidence: ReportAssessment["evidence"] = [
    { dimension: "rain", value: weather.rain_mm_per_hour, severity: thresholds ? increasing(weather.rain_mm_per_hour, thresholds.rain) : 0,
      ...(weather.rain_source ? { source_kind: weather.rain_source.kind, valid_from: weather.rain_source.valid_from,
        valid_to: weather.rain_source.valid_to, source_time: weather.rain_source.source_time } : {}) },
    { dimension: "wind", value: weather.gust_kmh, severity: thresholds ? increasing(weather.gust_kmh, thresholds.gust) : 0 },
    { dimension: "temperature", value: temp, severity: !t || !finite(temp) ? 0 : temp < t[0] || temp > t[3] ? 3 : temp <= t[1] || temp >= t[2] ? 2 : 1 },
    { dimension: "visibility", value: vis, severity: !thresholds || !finite(vis) || vis < 0 ? 0 : vis < thresholds.visibility[1] ? 3 : vis < thresholds.visibility[0] ? 2 : 1 },
    { dimension: "storm", value: storm, severity: !vehicle && storm === "unclassified" ? 2 : rules && storm && storm !== "unclassified" ? rules.storm[storm] : 0 },
    { dimension: "alert", value: alert, severity: !rules || !finite(alert) || alert < 0 || !Number.isInteger(alert) ? 0 : alert >= rules.alert.high ? 3 : alert >= rules.alert.caution ? 2 : 1 },
  ];
  const reasons = [...weather.reasons];
  if (!rules || !thresholds) reasons.push("ruleset_unavailable");
  if (weather.coverage !== "covered") reasons.push("weather_not_covered");
  if (weather.freshness === "stale" || weather.freshness === "unavailable") reasons.push("weather_not_eligible");
  for (const item of evidence) if (item.severity === 0) reasons.push(`${item.dimension}_unavailable`);
  const eligible = !!thresholds && weather.coverage === "covered" &&
    (weather.freshness === "fresh" || weather.freshness === "aging");
  const knownEvidence = evidence.filter(e => e.severity > 0);
  const sufficient = vehicle ? evidence.every(e => e.severity > 0) :
    ["wind", "temperature", "visibility"].every(dimension => knownEvidence.some(e => e.dimension === dimension));
  if (!vehicle && evidence.some(e => e.severity === 0)) reasons.push("general_weather_partial_evidence");
  const severity = (eligible && sufficient ? Math.max(...knownEvidence.map(e => e.severity)) : 0) as ReportSeverity;
  return {
    level: REPORT_LEVELS[severity]!, severity, score: severity ? severity / 3 : null,
    display_score: severity ? Math.round(severity / 3 * 100) : null,
    vehicle: vehicle ?? null, rule_set_version: rules ? (vehicle ? rules.version : rules.generalVersion) : null,
    freshness: weather.freshness, coverage: weather.coverage, source: weather.source,
    source_time: weather.source_time, evidence, reasons: [...new Set(reasons)],
  };
}
