/**
 * Phase 6 Risk Engine Tests
 * Tests for config-driven weather risk evaluation
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  evaluateRisk,
  verifyDeterminism,
} from "../dist/risk/risk-engine.js";

import {
  RISK_LEVELS,
  RISK_COLORS,
} from "@vietnam-weather/contracts";

// =============================================================================
// Test Fixtures
// =============================================================================

const mockRuleSet = {
  id: "00000000-0000-0000-0000-000000000001",
  external_key: "vietnam-weather-risk-v1",
  version: 1,
  status: "published",
  effective_from: null,
  effective_to: null,
};

const defaultRules = [
  {
    id: "rule-001",
    external_key: "wind-high",
    dimension: "wind",
    field_path: "wind_speed",
    operator: "gt",
    threshold_value: 15,
    threshold_upper_value: null,
    threshold_unit: "m/s",
    severity: RISK_LEVELS.HIGH,
    sort: 10,
  },
  {
    id: "rule-002",
    external_key: "wind-caution",
    dimension: "wind",
    field_path: "wind_speed",
    operator: "gt",
    threshold_value: 10,
    threshold_upper_value: null,
    threshold_unit: "m/s",
    severity: RISK_LEVELS.CAUTION,
    sort: 11,
  },
  {
    id: "rule-003",
    external_key: "temp-extreme-heat",
    dimension: "temperature",
    field_path: "temp_c",
    operator: "gt",
    threshold_value: 38,
    threshold_upper_value: null,
    threshold_unit: "°C",
    severity: RISK_LEVELS.HIGH,
    sort: 20,
  },
  {
    id: "rule-004",
    external_key: "temp-hot-caution",
    dimension: "temperature",
    field_path: "temp_c",
    operator: "gt",
    threshold_value: 35,
    threshold_upper_value: null,
    threshold_unit: "°C",
    severity: RISK_LEVELS.CAUTION,
    sort: 21,
  },
  {
    id: "rule-005",
    external_key: "vis-low",
    dimension: "visibility",
    field_path: "vis_km",
    operator: "lt",
    threshold_value: 1,
    threshold_upper_value: null,
    threshold_unit: "km",
    severity: RISK_LEVELS.HIGH,
    sort: 30,
  },
  {
    id: "rule-006",
    external_key: "thunderstorm",
    dimension: "storm",
    field_path: "thunderstorm",
    operator: "eq",
    threshold_value: 1,
    threshold_upper_value: null,
    threshold_unit: null,
    severity: RISK_LEVELS.HIGH,
    sort: 40,
  },
  {
    id: "rule-007",
    external_key: "rain-heavy",
    dimension: "precipitation",
    field_path: "rain_mm",
    operator: "gt",
    threshold_value: 25,
    threshold_upper_value: null,
    threshold_unit: "mm/h",
    severity: RISK_LEVELS.HIGH,
    sort: 50,
  },
];

const defaultOptions = {
  rule_set: mockRuleSet,
  rules: defaultRules,
  language: "vi",
};

// =============================================================================
// Test Cases
// =============================================================================

describe("Risk Engine", () => {
  // ===========================================================================
  // Normal Conditions - Low Risk
  // ===========================================================================

  describe("Normal conditions return Low risk", () => {
    it("returns LOW when all values are within safe ranges", () => {
      const weather = {
        temp_c: 25,
        wind_speed: 5,
        vis_km: 10,
        rain_mm: 0,
        thunderstorm: 0,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.LOW);
      assert.strictEqual(result.color, RISK_COLORS[RISK_LEVELS.LOW]);
      assert.strictEqual(result.triggered_rules_count, 0);
      assert.strictEqual(result.freshness_state, "fresh");
    });

    it("returns LOW when wind speed is exactly at caution threshold (not above)", () => {
      const weather = {
        wind_speed: 10,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.LOW);
    });

    it("returns LOW when temperature is exactly at caution threshold", () => {
      const weather = {
        temp_c: 35,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.LOW);
    });
  });

  // ===========================================================================
  // Caution Level
  // ===========================================================================

  describe("Caution level", () => {
    it("returns CAUTION when wind speed > 10 m/s", () => {
      const weather = {
        wind_speed: 12,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.CAUTION);
      assert.strictEqual(result.triggered_rules_count, 1);
      assert.ok(result.triggered_rules);
      assert.strictEqual(result.triggered_rules[0]?.external_key, "wind-caution");
    });

    it("returns CAUTION when temperature > 35°C", () => {
      const weather = {
        temp_c: 37,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.CAUTION);
      assert.strictEqual(result.triggered_rules_count, 1);
    });
  });

  // ===========================================================================
  // High Risk Level
  // ===========================================================================

  describe("High risk level", () => {
    it("returns HIGH when wind speed > 15 m/s", () => {
      const weather = {
        wind_speed: 18,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
      assert.strictEqual(result.triggered_rules_count, 1);
      assert.strictEqual(result.triggered_rules[0]?.external_key, "wind-high");
    });

    it("returns HIGH when temperature > 38°C", () => {
      const weather = {
        temp_c: 40,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
    });

    it("returns HIGH when visibility < 1 km", () => {
      const weather = {
        vis_km: 0.5,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
    });

    it("returns HIGH when thunderstorm is present", () => {
      const weather = {
        thunderstorm: 1,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
      assert.strictEqual(result.triggered_rules[0]?.external_key, "thunderstorm");
    });

    it("returns HIGH when rain > 25 mm/h", () => {
      const weather = {
        rain_mm: 30,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
    });
  });

  // ===========================================================================
  // Max Severity Aggregation (RISK-005)
  // ===========================================================================

  describe("Max severity aggregation (RISK-005)", () => {
    it("returns HIGH when both caution and high rules trigger", () => {
      const weather = {
        wind_speed: 18, // Triggers wind-high (HIGH)
        temp_c: 36, // Triggers temp-hot-caution (CAUTION)
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
      // Should only report HIGH severity rules
      assert.ok(result.triggered_rules.every(r => r.severity === RISK_LEVELS.HIGH));
    });

    it("returns HIGH when multiple high rules trigger", () => {
      const weather = {
        wind_speed: 18, // HIGH
        thunderstorm: 1, // HIGH
        rain_mm: 30, // HIGH
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
      assert.ok(result.triggered_rules.length >= 1);
    });

    it("returns CAUTION when only caution rules trigger", () => {
      const weather = {
        wind_speed: 12, // CAUTION
        temp_c: 36, // CAUTION
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.CAUTION);
    });
  });

  // ===========================================================================
  // Unknown Level for Stale Data (RISK-006)
  // ===========================================================================

  describe("Unknown level for stale data (RISK-006)", () => {
    it("returns UNKNOWN when freshness is 'stale'", () => {
      const weather = {
        wind_speed: 18,
      };

      const result = evaluateRisk(weather, "stale", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.UNKNOWN);
      assert.strictEqual(result.triggered_rules_count, 0);
    });

    it("returns UNKNOWN when freshness is 'expired'", () => {
      const weather = {
        wind_speed: 18,
      };

      const result = evaluateRisk(weather, "expired", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.UNKNOWN);
    });

    it("returns UNKNOWN when freshness is 'unavailable'", () => {
      const weather = {};

      const result = evaluateRisk(weather, "unavailable", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.UNKNOWN);
    });
  });

  // ===========================================================================
  // Missing Data Handling
  // ===========================================================================

  describe("Missing data handling", () => {
    it("returns LOW when no critical fields are present", () => {
      const weather = {};

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.LOW);
      assert.ok(result.confidence_percent !== null);
    });

    it("still evaluates available fields when some are missing", () => {
      const weather = {
        wind_speed: 18, // Should trigger HIGH
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
    });
  });

  // ===========================================================================
  // Confidence Calculation
  // ===========================================================================

  describe("Confidence calculation", () => {
    it("calculates 100% confidence when all fields present", () => {
      const weather = {
        temp_c: 25,
        wind_speed: 5,
        vis_km: 10,
        rain_mm: 0,
        thunderstorm: 0,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.confidence_percent, 100);
    });

    it("calculates reduced confidence when some fields missing", () => {
      const weather = {
        temp_c: 25,
        // Missing other fields - vis_km is missing
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      // With temp_c but missing vis_km, confidence should be less than when all fields present
      // When all 5 critical fields present, confidence is 100%
      // With only some fields present, confidence is proportionally lower
      assert.ok(result.confidence_percent !== null, "confidence should not be null");
      assert.ok(result.confidence_percent < 100, `Expected < 100, got ${result.confidence_percent}`);
    });
  });

  // ===========================================================================
  // Determinism
  // ===========================================================================

  describe("Determinism", () => {
    it("produces identical results for same input", () => {
      const weather = {
        temp_c: 40,
        wind_speed: 5,
      };

      const result1 = evaluateRisk(weather, "fresh", defaultOptions);
      const result2 = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result1.level, result2.level);
      assert.strictEqual(result1.color, result2.color);
      assert.strictEqual(result1.triggered_rules_count, result2.triggered_rules_count);
    });

    it("verifyDeterminism returns true for consistent inputs", () => {
      const weather = {
        temp_c: 40,
      };

      const isDeterministic = verifyDeterminism(weather, "fresh", defaultOptions, 10);

      assert.strictEqual(isDeterministic, true);
    });
  });

  // ===========================================================================
  // Response Format
  // ===========================================================================

  describe("Response format", () => {
    it("includes all required fields", () => {
      const weather = {
        temp_c: 25,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.ok(result.assessment_id);
      assert.ok(result.assessed_at);
      assert.strictEqual(typeof result.assessment_id, "string");
      assert.strictEqual(typeof result.assessed_at, "string");
      assert.ok(result.assessed_at.includes("T")); // ISO format
    });

    it("returns correct color codes", () => {
      const lowWeather = { temp_c: 25 };
      const highWeather = { wind_speed: 18 };

      const lowResult = evaluateRisk(lowWeather, "fresh", defaultOptions);
      const highResult = evaluateRisk(highWeather, "fresh", defaultOptions);

      assert.strictEqual(lowResult.color, RISK_COLORS[RISK_LEVELS.LOW]);
      assert.strictEqual(highResult.color, RISK_COLORS[RISK_LEVELS.HIGH]);
    });
  });
});

// =============================================================================
// Scenario Tests
// =============================================================================

describe("Risk Scenarios", () => {
  describe("Normal travel day", () => {
    it("assesses low risk for pleasant weather", () => {
      const weather = {
        temp_c: 28,
        wind_speed: 3,
        vis_km: 15,
        rain_mm: 0,
        thunderstorm: 0,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.LOW);
    });
  });

  describe("Storm warning", () => {
    it("assesses high risk when thunderstorm present", () => {
      const weather = {
        temp_c: 30,
        wind_speed: 8,
        vis_km: 8,
        rain_mm: 5,
        thunderstorm: 1,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
      assert.ok(
        result.triggered_rules.some((r) => r.external_key === "thunderstorm")
      );
    });
  });

  describe("Tropical storm conditions", () => {
    it("assesses high risk for severe tropical weather", () => {
      const weather = {
        temp_c: 26,
        wind_speed: 22,
        vis_km: 0.5,
        rain_mm: 45,
        thunderstorm: 1,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
      // Multiple rules should trigger but we only report the highest severity
      assert.ok(result.triggered_rules.length >= 1);
      assert.ok(
        result.triggered_rules.every((r) => r.severity === RISK_LEVELS.HIGH)
      );
    });
  });

  describe("Heat wave", () => {
    it("assesses high risk for extreme heat", () => {
      const weather = {
        temp_c: 42,
        wind_speed: 2,
        vis_km: 20,
        rain_mm: 0,
        thunderstorm: 0,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
    });
  });

  describe("Foggy morning", () => {
    it("assesses high risk for very low visibility", () => {
      const weather = {
        temp_c: 18,
        wind_speed: 1,
        vis_km: 0.3,
        rain_mm: 0,
        thunderstorm: 0,
      };

      const result = evaluateRisk(weather, "fresh", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.HIGH);
    });
  });

  describe("Stale data scenario", () => {
    it("returns unknown instead of risk level when data is stale", () => {
      const weather = {
        temp_c: 40,
        wind_speed: 18,
        thunderstorm: 1,
      };

      const result = evaluateRisk(weather, "stale", defaultOptions);

      assert.strictEqual(result.level, RISK_LEVELS.UNKNOWN);
      assert.strictEqual(result.triggered_rules_count, 0);
    });
  });
});
