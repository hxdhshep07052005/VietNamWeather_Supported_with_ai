import type { ReportAssessment, ReportSeverity, SamplePoint, RouteAlternative } from '@vietnam-weather/contracts';
import { REPORT_LEVELS } from '../risk/report-hazard.js';

const VERSION = 'route-weather-provisional-v1';
export function provisionalPointAssessment(assessment: ReportAssessment): ReportAssessment {
  const core = ['wind', 'temperature', 'visibility'];
  const usable = assessment.coverage === 'covered' && ['fresh', 'aging'].includes(assessment.freshness) &&
    core.every(d => assessment.evidence.some(e => e.dimension === d && e.severity > 0));
  const severity = (usable ? Math.max(...assessment.evidence.map(e => e.severity),
    assessment.evidence.some(e => e.dimension === 'storm' && e.value === 'unclassified') ? 2 : 0) : 0) as ReportSeverity;
  return { ...assessment, severity, level: REPORT_LEVELS[severity]!, score: severity ? severity / 3 : null,
    display_score: severity ? Math.round(severity / 3 * 100) : null, rule_set_version: VERSION,
    reasons: [...assessment.reasons, 'provisional_weather_evidence'] };
}

export function provisionalRouteScore(samples: readonly SamplePoint[]): RouteAlternative['route_risk']['provisional'] {
  let total = 0, covered = 0, weighted = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!, b = samples[i]!;
    const length = b.distance_from_start_meters - a.distance_from_start_meters;
    if (!Number.isFinite(length) || length <= 0) return undefined;
    total += length;
    const left = a.provisional_assessment?.score, right = b.provisional_assessment?.score;
    if (left != null && right != null) { covered += length; weighted += length * (left + right) / 2; }
  }
  if (covered === 0 || total === 0) return undefined;
  return {
    // Uncovered distance receives the maximum ranking penalty, never a safe observation.
    score: (weighted + total - covered) / total,
    observed_score: weighted / covered,
    coverage_percent: Math.round(covered / total * 100), rule_set_version: VERSION,
  };
}
