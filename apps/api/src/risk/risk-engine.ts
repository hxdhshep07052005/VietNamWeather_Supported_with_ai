/**
 * Phase 6 Risk Engine Core
 * Config-Driven Weather Risk Evaluation
 *
 * Based on decisions RISK-001..007
 * - 4 levels: Low, Caution, High, Unknown
 * - 6 dimensions: precipitation, wind, temperature, visibility, storm, alert
 * - Max severity aggregation
 * - Stale data → Unknown
 */

import {
  RISK_LEVELS,
  RISK_SEVERITY_SCORES,
  RISK_COLORS,
  RISK_OPERATORS,
  RISK_DISCLAIMERS,
  type RiskLevel,
  type RiskDimension,
  type RiskOperator,
  type NormalizedWeatherInput,
  type FreshnessState,
  type TriggeredRule,
} from "@vietnam-weather/contracts";

// =============================================================================
// Types
// =============================================================================

/**
 * Rule definition from database
 */
export interface RiskRule {
  readonly id: string;
  readonly external_key: string;
  readonly dimension: RiskDimension;
  readonly field_path: string;
  readonly operator: RiskOperator;
  readonly threshold_value: number | null;
  readonly threshold_upper_value: number | null;
  readonly threshold_unit: string | null;
  readonly severity: RiskLevel;
  readonly sort: number;
}

/**
 * Rule set definition
 */
export interface RiskRuleSet {
  readonly id: string;
  readonly external_key: string;
  readonly version: number;
  readonly status: "draft" | "review" | "approved" | "published" | "retired";
  readonly effective_from: string | null;
  readonly effective_to: string | null;
}

/**
 * Evaluation result for a single rule
 */
export interface RuleEvaluationResult {
  readonly rule_id: string;
  readonly external_key: string;
  readonly dimension: RiskDimension;
  readonly severity: RiskLevel;
  readonly severity_score: number;
  readonly triggered: boolean;
  readonly actual_value: number | null;
  readonly threshold_value: number | null;
  readonly threshold_upper_value: number | null;
  readonly unit: string | null;
}

/**
 * Risk assessment result
 */
export interface RiskAssessmentResult {
  readonly level: RiskLevel;
  readonly color: string;
  readonly confidence_percent: number | null;
  readonly freshness_state: FreshnessState;
  readonly triggered_rules_count: number;
  readonly triggered_rules: TriggeredRule[];
  readonly rule_set_version: number;
  readonly assessment_id: string;
  readonly assessed_at: string;
}

/**
 * Risk engine options
 */
export interface RiskEngineOptions {
  readonly rule_set: RiskRuleSet;
  readonly rules: readonly RiskRule[];
}

// =============================================================================
// Severity Mapping
// =============================================================================

/**
 * Get numeric severity score for comparison
 */
function getSeverityScore(level: RiskLevel): number {
  return RISK_SEVERITY_SCORES[level] ?? 0;
}

// =============================================================================
// Field Extraction
// =============================================================================

/**
 * Extract field value from weather input using dot-notation path
 */
function extractFieldValue(
  weather: NormalizedWeatherInput,
  fieldPath: string
): number | null {
  const parts = fieldPath.split(".");
  let value: unknown = weather;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return null;
    }
    value = (value as Record<string, unknown>)[part];
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  return null;
}

// =============================================================================
// Operator Evaluation
// =============================================================================

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  operator: RiskOperator,
  actualValue: number | null,
  threshold: number | null,
  thresholdUpper: number | null
): boolean {
  // Handle missing field
  if (actualValue === null) {
    return operator === RISK_OPERATORS.MISSING;
  }

  // Handle missing threshold (invalid rule)
  if (threshold === null) {
    return false;
  }

  switch (operator) {
    case RISK_OPERATORS.GT:
      return actualValue > threshold;

    case RISK_OPERATORS.GTE:
      return actualValue >= threshold;

    case RISK_OPERATORS.LT:
      return actualValue < threshold;

    case RISK_OPERATORS.LTE:
      return actualValue <= threshold;

    case RISK_OPERATORS.EQ:
      return actualValue === threshold;

    case RISK_OPERATORS.BETWEEN:
      return (
        thresholdUpper !== null &&
        actualValue >= threshold &&
        actualValue <= thresholdUpper
      );

    case RISK_OPERATORS.IN: {
      // Parse comma-separated values
      const values = String(threshold)
        .split(",")
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !Number.isNaN(v));
      return values.includes(actualValue);
    }

    case RISK_OPERATORS.MISSING:
      return false; // Field is present, not missing

    default:
      return false;
  }
}

// =============================================================================
// Rule Evaluation
// =============================================================================

/**
 * Evaluate a single rule against weather data
 */
function evaluateRule(
  rule: RiskRule,
  weather: NormalizedWeatherInput
): RuleEvaluationResult {
  const actualValue = extractFieldValue(weather, rule.field_path);
  const triggered = evaluateCondition(
    rule.operator,
    actualValue,
    rule.threshold_value,
    rule.threshold_upper_value
  );

  return {
    rule_id: rule.id,
    external_key: rule.external_key,
    dimension: rule.dimension,
    severity: rule.severity,
    severity_score: getSeverityScore(rule.severity),
    triggered,
    actual_value: actualValue,
    threshold_value: rule.threshold_value,
    threshold_upper_value: rule.threshold_upper_value,
    unit: rule.threshold_unit,
  };
}

// =============================================================================
// Core Evaluation Function
// =============================================================================

/**
 * Evaluate all rules and return results
 *
 * Per RISK-005: Uses max severity aggregation
 * Per RISK-006: Stale/expired data always returns 'unknown'
 */
export function evaluateRisk(
  weather: NormalizedWeatherInput,
  freshnessState: FreshnessState,
  options: RiskEngineOptions
): RiskAssessmentResult {
  const { rule_set, rules } = options;

  // Per RISK-006: Stale or expired data always returns 'unknown'
  if (freshnessState !== "fresh") {
    return createUnknownResult(rule_set.version);
  }

  // Evaluate all rules
  const evaluations = rules.map((rule) => evaluateRule(rule, weather));

  // Filter triggered rules
  const triggered = evaluations.filter((e) => e.triggered);

  if (triggered.length === 0) {
    // No rules triggered → Low risk
    return createLowResult(rule_set.version, weather);
  }

  // Per RISK-005: Max severity aggregation - highest severity wins
  // Sort by severity descending
  triggered.sort((a, b) => b.severity_score - a.severity_score);

  // Get the highest severity
  const highestSeverity = triggered[0]!.severity;
  const highestSeverityScore = triggered[0]!.severity_score;

  // Get all rules with the same highest severity
  const maxSeverityRules = triggered.filter(
    (e) => e.severity_score === highestSeverityScore
  );

  // Convert to TriggeredRule format
  const triggeredRules: TriggeredRule[] = maxSeverityRules.map((e) => ({
    rule_id: e.rule_id,
    external_key: e.external_key,
    dimension: e.dimension,
    severity: e.severity,
    actual_value: e.actual_value!,
    threshold_value: e.threshold_value!,
    threshold_upper_value: e.threshold_upper_value ?? undefined,
    unit: e.unit ?? undefined,
  }));

  return {
    level: highestSeverity,
    color: RISK_COLORS[highestSeverity],
    confidence_percent: calculateConfidence(weather),
    freshness_state: freshnessState,
    triggered_rules_count: triggeredRules.length,
    triggered_rules: triggeredRules,
    rule_set_version: rule_set.version,
    assessment_id: generateAssessmentId(),
    assessed_at: new Date().toISOString(),
  };
}

// =============================================================================
// Result Factories
// =============================================================================

function createUnknownResult(
  ruleSetVersion: number
): RiskAssessmentResult {
  return {
    level: RISK_LEVELS.UNKNOWN,
    color: RISK_COLORS[RISK_LEVELS.UNKNOWN],
    confidence_percent: null,
    freshness_state: "unavailable",
    triggered_rules_count: 0,
    triggered_rules: [],
    rule_set_version: ruleSetVersion,
    assessment_id: generateAssessmentId(),
    assessed_at: new Date().toISOString(),
  };
}

function createLowResult(
  ruleSetVersion: number,
  weather: NormalizedWeatherInput
): RiskAssessmentResult {
  return {
    level: RISK_LEVELS.LOW,
    color: RISK_COLORS[RISK_LEVELS.LOW],
    confidence_percent: calculateConfidence(weather),
    freshness_state: "fresh",
    triggered_rules_count: 0,
    triggered_rules: [],
    rule_set_version: ruleSetVersion,
    assessment_id: generateAssessmentId(),
    assessed_at: new Date().toISOString(),
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate confidence percentage based on available data
 * More fields present = higher confidence
 */
function calculateConfidence(
  weather: NormalizedWeatherInput
): number {
  const criticalFields = [
    "temp_c",
    "wind_speed",
    "vis_km",
    "rain_mm",
    "thunderstorm",
  ];

  const presentFields = criticalFields.filter(
    (field) => extractFieldValue(weather, field) !== null
  );

  const fieldCount = presentFields.length;
  const totalFields = criticalFields.length;

  // Base confidence from field coverage
  const baseConfidence = Math.round((fieldCount / totalFields) * 80);

  // Add 20% if all fields present, scale proportionally
  const additionalConfidence = Math.round((fieldCount / totalFields) * 20);

  return Math.min(baseConfidence + additionalConfidence, 100);
}

/**
 * Generate unique assessment ID
 */
function generateAssessmentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `assess_${timestamp}_${random}`;
}

// =============================================================================
// Determinism Verification
// =============================================================================

/**
 * Verify that the engine produces deterministic output
 * Same input + same rules = same output
 */
export function verifyDeterminism(
  weather: NormalizedWeatherInput,
  freshnessState: FreshnessState,
  options: RiskEngineOptions,
  iterations: number = 10
): boolean {
  const results: RiskAssessmentResult[] = [];

  for (let i = 0; i < iterations; i++) {
    results.push(evaluateRisk(weather, freshnessState, options));
  }

  // All results should be identical
  const first = results[0];
  if (!first) return true;

  return results.every(
    (r) =>
      r.level === first.level &&
      r.color === first.color &&
      r.triggered_rules_count === first.triggered_rules_count
  );
}

// =============================================================================
// Disclaimer
// =============================================================================

/**
 * Get disclaimer text
 */
export function getDisclaimer(): { vi: string; en: string } {
  return RISK_DISCLAIMERS;
}
