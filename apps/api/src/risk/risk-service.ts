/**
 * Phase 6 Risk Service
 * API layer for risk assessment
 */

import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import {
  RISK_LEVELS,
  RISK_DIMENSIONS,
  RISK_ERROR_CODES,
  RISK_DISCLAIMERS,
  type RiskLevel,
  type RiskAssessmentRequest,
  type RiskAssessmentResponse,
  type RiskCapabilitiesResponse,
  type RiskErrorResponse,
  type FreshnessState,
} from "@vietnam-weather/contracts";

import {
  evaluateRisk,
  type RiskRule,
  type RiskRuleSet,
} from "./risk-engine.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Risk service configuration
 */
export interface RiskServiceOptions {
  readonly dbPool: Pool;
  readonly cacheTtlSeconds?: number;
}

/**
 * Cached rule set
 */
interface CachedRuleSet {
  readonly ruleSet: RiskRuleSet;
  readonly rules: readonly RiskRule[];
  readonly cachedAt: number;
}

// =============================================================================
// Risk Service
// =============================================================================

export class RiskService {
  private readonly dbPool: Pool;
  private readonly cacheTtlSeconds: number;
  private cachedRuleSet: CachedRuleSet | null = null;

  constructor(options: RiskServiceOptions) {
    this.dbPool = options.dbPool;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 300; // 5 minutes default
  }

  // ===========================================================================
  // Public API Methods
  // ===========================================================================

  /**
   * Get risk capabilities
   */
  async getCapabilities(): Promise<RiskCapabilitiesResponse> {
    return {
      dimensions: [
        RISK_DIMENSIONS.PRECIPITATION,
        RISK_DIMENSIONS.WIND,
        RISK_DIMENSIONS.TEMPERATURE,
        RISK_DIMENSIONS.VISIBILITY,
        RISK_DIMENSIONS.STORM,
        RISK_DIMENSIONS.ALERT,
      ],
      levels: [
        RISK_LEVELS.LOW,
        RISK_LEVELS.CAUTION,
        RISK_LEVELS.HIGH,
        RISK_LEVELS.UNKNOWN,
      ],
      languages: ["vi", "en"],
      active_rule_set_version: await this.getActiveRuleSetVersion(),
      freshness_requirements: {
        current_max_age_minutes: 60,
        forecast_max_age_hours: 24,
      },
    };
  }

  /**
   * Assess risk for a location
   */
  async assessRisk(
    request: RiskAssessmentRequest
  ): Promise<RiskAssessmentResponse> {
    const includeTriggeredRules = request.include_triggered_rules ?? false;

    // Get weather data from Phase 5 weather service
    const weatherData = await this.getWeatherData(request.location_id);

    if (!weatherData) {
      throw new RiskServiceError(
        RISK_ERROR_CODES.NO_DATA,
        "No weather data available for this location",
        randomUUID(),
        false
      );
    }

    // Get active rule set and rules
    const { ruleSet, rules } = await this.getActiveRuleSet();

    // Evaluate risk
    const result = evaluateRisk(weatherData.data, weatherData.freshness, {
      rule_set: ruleSet,
      rules,
    });

    // Build response
    const response: RiskAssessmentResponse = {
      assessment_id: result.assessment_id,
      location_id: request.location_id,
      target_time: request.target_time ?? new Date().toISOString(),
      level: result.level,
      color: result.color,
      confidence_percent: result.confidence_percent,
      freshness_state: weatherData.freshness,
      triggered_rules_count: result.triggered_rules_count,
      triggered_rules: includeTriggeredRules ? result.triggered_rules : undefined,
      disclaimer: RISK_DISCLAIMERS,
      rule_set_version: result.rule_set_version,
      assessed_at: result.assessed_at,
      attribution: "Powered by WeatherAPI.com",
    };

    return response;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get weather data from Phase 5 weather store
   * This is a placeholder - actual implementation will integrate with weather-service.ts
   */
  private async getWeatherData(
    locationId: string
  ): Promise<{ data: Record<string, unknown>; freshness: FreshnessState } | null> {
    // locationId will be used when integrating with Phase 5 weather service
    void locationId;
    // TODO: Integrate with Phase 5 weather service
    // For now, return mock data for testing
    return {
      data: {
        temp_c: 35,
        wind_speed: 12,
        vis_km: 8,
        rain_mm: 0,
        thunderstorm: 0,
      },
      freshness: "fresh",
    };
  }

  /**
   * Get active rule set from database or cache
   */
  private async getActiveRuleSet(): Promise<{
    ruleSet: RiskRuleSet;
    rules: readonly RiskRule[];
  }> {
    // Check cache
    if (this.cachedRuleSet) {
      const cacheAge = Date.now() - this.cachedRuleSet.cachedAt;
      if (cacheAge < this.cacheTtlSeconds * 1000) {
        return {
          ruleSet: this.cachedRuleSet.ruleSet,
          rules: this.cachedRuleSet.rules,
        };
      }
    }

    // Query database
    const result = await this.dbPool.query<{
      id: string;
      external_key: string;
      version: number;
      status: string;
      effective_from: string | null;
      effective_to: string | null;
    }>(
      `SELECT id, external_key, version, status, effective_from, effective_to
         FROM risk_rule_sets
        WHERE status = 'published'
          AND (effective_from IS NULL OR effective_from <= NOW())
          AND (effective_to IS NULL OR effective_to >= NOW())
        ORDER BY version DESC
        LIMIT 1`
    );

    if (result.rows.length === 0) {
      throw new RiskServiceError(
        RISK_ERROR_CODES.RULE_SET_NOT_FOUND,
        "No active published rule set found",
        randomUUID(),
        false
      );
    }

    const ruleSet: RiskRuleSet = {
      id: result.rows[0]!.id,
      external_key: result.rows[0]!.external_key,
      version: result.rows[0]!.version,
      status: result.rows[0]!.status as RiskRuleSet["status"],
      effective_from: result.rows[0]!.effective_from,
      effective_to: result.rows[0]!.effective_to,
    };

    // Get rules for this rule set
    const rulesResult = await this.dbPool.query<{
      id: string;
      external_key: string;
      dimension: string;
      field_path: string;
      operator: string;
      threshold_value: string | null;
      threshold_upper_value: string | null;
      threshold_unit: string | null;
      severity: string;
      sort: number;
    }>(
      `SELECT id, external_key, dimension, field_path, operator,
              threshold_value, threshold_upper_value, threshold_unit,
              severity, sort
         FROM risk_rules
        WHERE rule_set_id = $1
        ORDER BY sort`,
      [ruleSet.id]
    );

    const rules: readonly RiskRule[] = rulesResult.rows.map((row) => ({
      id: row.id,
      external_key: row.external_key,
      dimension: row.dimension as RiskRule["dimension"],
      field_path: row.field_path,
      operator: row.operator as RiskRule["operator"],
      threshold_value: row.threshold_value ? parseFloat(row.threshold_value) : null,
      threshold_upper_value: row.threshold_upper_value
        ? parseFloat(row.threshold_upper_value)
        : null,
      threshold_unit: row.threshold_unit,
      severity: row.severity as RiskLevel,
      sort: row.sort,
    }));

    // Update cache
    this.cachedRuleSet = {
      ruleSet,
      rules,
      cachedAt: Date.now(),
    };

    return { ruleSet, rules };
  }

  /**
   * Get active rule set version (for capabilities endpoint)
   */
  private async getActiveRuleSetVersion(): Promise<number> {
    try {
      const result = await this.dbPool.query<{ version: number }>(
        `SELECT version
           FROM risk_rule_sets
          WHERE status = 'published'
            AND (effective_from IS NULL OR effective_from <= NOW())
            AND (effective_to IS NULL OR effective_to >= NOW())
          ORDER BY version DESC
          LIMIT 1`
      );

      return result.rows[0]?.version ?? 1;
    } catch {
      return 1; // Default version if query fails
    }
  }

  /**
   * Clear cache (for testing or manual invalidation)
   */
  clearCache(): void {
    this.cachedRuleSet = null;
  }
}

// =============================================================================
// Risk Service Error
// =============================================================================

export class RiskServiceError extends Error {
  readonly code: string;
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    correlationId: string,
    retryable: boolean
  ) {
    super(message);
    this.name = "RiskServiceError";
    this.code = code;
    this.correlationId = correlationId;
    this.retryable = retryable;
  }

  toResponse(): RiskErrorResponse {
    return {
      code: this.code,
      message: this.message,
      correlation_id: this.correlationId,
      retryable: this.retryable,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createRiskService(options: RiskServiceOptions): RiskService {
  return new RiskService(options);
}
