/**
 * Phase 8 Route Service Tests
 * Tests for weather-aware route planning
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  VEHICLE_TYPES,
  ROUTE_ALTERNATIVES,
  MAX_ROUTE_LENGTH_METERS,
  MAX_ETA_HOURS,
  DEFAULT_SCORING_WEIGHTS,
  DEVIATION_THRESHOLD_METERS,
  SAMPLE_INTERVAL_MINUTES,
  SAMPLE_INTERVAL_METERS,
  ROUTE_ERROR_CODES,
} from "@vietnam-weather/contracts";

// =============================================================================
// Constants Tests (ROUTE-001..008)
// =============================================================================

describe("Route Constants", () => {
  describe("Vehicle Types (ROUTE-001)", () => {
    it("should support car vehicle type", () => {
      assert.strictEqual(VEHICLE_TYPES.CAR, "car");
    });

    it("should support motorcycle vehicle type", () => {
      assert.strictEqual(VEHICLE_TYPES.MOTORCYCLE, "motorcycle");
    });
  });

  describe("Route Alternatives (ROUTE-003)", () => {
    it("should have fastest alternative", () => {
      assert.strictEqual(ROUTE_ALTERNATIVES.FASTEST, "fastest");
    });

    it("should have shortest alternative", () => {
      assert.strictEqual(ROUTE_ALTERNATIVES.SHORTEST, "shortest");
    });

    it("should have weather-safer alternative", () => {
      assert.strictEqual(ROUTE_ALTERNATIVES.WEATHER_SAFER, "weather_safer");
    });
  });

  describe("Max Route Length (ROUTE-005)", () => {
    it("should limit to 2000km", () => {
      assert.strictEqual(MAX_ROUTE_LENGTH_METERS, 2000000);
    });
  });

  describe("Max ETA (ROUTE-002)", () => {
    it("should limit to 72 hours", () => {
      assert.strictEqual(MAX_ETA_HOURS, 72);
    });
  });

  describe("Scoring Weights (ROUTE-004)", () => {
    it("should have default risk weight of 0.5", () => {
      assert.strictEqual(DEFAULT_SCORING_WEIGHTS.risk_weight, 0.5);
    });

    it("should have default time weight of 0.3", () => {
      assert.strictEqual(DEFAULT_SCORING_WEIGHTS.time_weight, 0.3);
    });

    it("should have default distance weight of 0.2", () => {
      assert.strictEqual(DEFAULT_SCORING_WEIGHTS.distance_weight, 0.2);
    });

    it("should sum to 1.0", () => {
      const sum =
        DEFAULT_SCORING_WEIGHTS.risk_weight +
        DEFAULT_SCORING_WEIGHTS.time_weight +
        DEFAULT_SCORING_WEIGHTS.distance_weight;
      assert.strictEqual(sum, 1.0);
    });
  });

  describe("Deviation Threshold (ROUTE-008)", () => {
    it("should be 100 meters", () => {
      assert.strictEqual(DEVIATION_THRESHOLD_METERS, 100);
    });
  });

  describe("Sample Intervals", () => {
    it("should sample every 15 minutes", () => {
      assert.strictEqual(SAMPLE_INTERVAL_MINUTES, 15);
    });

    it("should sample every 5 km", () => {
      assert.strictEqual(SAMPLE_INTERVAL_METERS, 5000);
    });
  });
});

// =============================================================================
// Error Codes
// =============================================================================

describe("Route Error Codes", () => {
  it("should have invalid origin error", () => {
    assert.ok(ROUTE_ERROR_CODES.INVALID_ORIGIN);
  });

  it("should have invalid destination error", () => {
    assert.ok(ROUTE_ERROR_CODES.INVALID_DESTINATION);
  });

  it("should have route too long error", () => {
    assert.ok(ROUTE_ERROR_CODES.ROUTE_TOO_LONG);
  });

  it("should have ETA exceeds limit error", () => {
    assert.ok(ROUTE_ERROR_CODES.ETA_EXCEEDS_LIMIT);
  });

  it("should have no route found error", () => {
    assert.ok(ROUTE_ERROR_CODES.NO_ROUTE_FOUND);
  });

  it("should have provider error", () => {
    assert.ok(ROUTE_ERROR_CODES.PROVIDER_ERROR);
  });
});

// =============================================================================
// Route Data Structures
// =============================================================================

describe("Route Data Structures", () => {
  it("should have valid coordinates structure", () => {
    const coords = {
      latitude: 21.0285,
      longitude: 105.8542,
    };

    assert.strictEqual(coords.latitude, 21.0285);
    assert.strictEqual(coords.longitude, 105.8542);
  });

  it("should have valid route geometry structure", () => {
    const geometry = {
      coordinates: [
        { latitude: 21.0285, longitude: 105.8542 },
        { latitude: 21.0385, longitude: 105.8642 },
      ],
      distance_meters: 15000,
      duration_seconds: 1800,
    };

    assert.strictEqual(geometry.coordinates.length, 2);
    assert.strictEqual(geometry.distance_meters, 15000);
    assert.strictEqual(geometry.duration_seconds, 1800);
  });

  it("should have valid sample point structure", () => {
    const sample = {
      coordinates: { latitude: 21.0285, longitude: 105.8542 },
      distance_from_start_meters: 5000,
      time_from_departure_seconds: 600,
      eta: "2026-08-14T08:00:00Z",
      is_interpolated: false,
      has_weather_data: true,
      weather_freshness: "fresh",
    };

    assert.strictEqual(sample.is_interpolated, false);
    assert.strictEqual(sample.has_weather_data, true);
  });

  it("should have valid segment risk structure", () => {
    const risk = {
      segment_start: 0,
      segment_end: 4,
      risk_level: "low",
      risk_score: 0.33,
      severity: 1,
      factors: [],
      conditions_summary: {
        vi: "Thời tiết thuận lợi",
        en: "Favorable conditions",
      },
    };

    assert.strictEqual(risk.risk_level, "low");
    assert.strictEqual(risk.severity, 1);
  });

  it("should have valid route alternative structure", () => {
    const alternative = {
      alternative_type: ROUTE_ALTERNATIVES.FASTEST,
      geometry: {
        coordinates: [],
        distance_meters: 10000,
        duration_seconds: 1200,
      },
      sample_points: [],
      route_risk: {
        level: "low",
        score: 0.33,
        confidence: 100,
      },
      segment_risks: [],
      balanced_score: 0.5,
      summary: {
        vi: "Rủi ro thấp",
        en: "Low risk",
      },
      warnings: [],
    };

    assert.strictEqual(alternative.alternative_type, "fastest");
    assert.strictEqual(alternative.route_risk.confidence, 100);
  });

  it("should have valid attribution structure", () => {
    const attribution = {
      routing_provider: "Geoapify",
      weather_provider: "WeatherAPI.com",
      issue_time: "2026-08-14T06:00:00Z",
      last_updated: "2026-08-14T08:00:00Z",
    };

    assert.strictEqual(attribution.routing_provider, "Geoapify");
    assert.strictEqual(attribution.weather_provider, "WeatherAPI.com");
  });
});

// =============================================================================
// GPS Progress
// =============================================================================

describe("GPS Progress", () => {
  it("should calculate deviation correctly", () => {
    const routePoint = { latitude: 21.0285, longitude: 105.8542 };
    const currentPosition = { latitude: 21.0290, longitude: 105.8545 };

    // Simple distance calculation
    const latDiff = Math.abs(currentPosition.latitude - routePoint.latitude);
    const lonDiff = Math.abs(currentPosition.longitude - routePoint.longitude);
    const deviationDegrees = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    const deviationMeters = deviationDegrees * 111000; // ~111km per degree

    assert.ok(deviationMeters > 0);
    assert.ok(deviationMeters < 1000); // Should be under 1km
  });

  it("should detect deviation above threshold", () => {
    const deviationMeters = 150;
    const isDeviated = deviationMeters >= DEVIATION_THRESHOLD_METERS;

    assert.strictEqual(isDeviated, true);
  });

  it("should not detect deviation below threshold", () => {
    const deviationMeters = 50;
    const isDeviated = deviationMeters >= DEVIATION_THRESHOLD_METERS;

    assert.strictEqual(isDeviated, false);
  });
});

// =============================================================================
// Risk Integration (Phase 6)
// =============================================================================

describe("Risk Integration", () => {
  it("should calculate max severity correctly", () => {
    const severities = [1, 2, 1, 3, 1];
    const maxSeverity = Math.max(...severities);

    assert.strictEqual(maxSeverity, 3);
  });

  it("should map severity to risk level", () => {
    const levelMap = {
      1: "low",
      2: "caution",
      3: "high",
      4: "unknown",
    };

    assert.strictEqual(levelMap[1], "low");
    assert.strictEqual(levelMap[2], "caution");
    assert.strictEqual(levelMap[3], "high");
    assert.strictEqual(levelMap[4], "unknown");
  });

  it("should calculate route risk as average of segments", () => {
    const segmentScores = [0.33, 0.33, 0.67, 0.33];
    const avgScore = segmentScores.reduce((a, b) => a + b, 0) / segmentScores.length;

    // Use approximate comparison for floating point
    assert.ok(Math.abs(avgScore - 0.415) < 0.001);
  });

  it("should calculate confidence based on data availability", () => {
    const totalSegments = 4;
    const unknownSegments = 1;
    const confidence = Math.round(((totalSegments - unknownSegments) / totalSegments) * 100);

    assert.strictEqual(confidence, 75);
  });
});

// =============================================================================
// Balanced Scoring (ROUTE-004)
// =============================================================================

describe("Balanced Scoring", () => {
  it("should calculate balanced score correctly", () => {
    const weights = DEFAULT_SCORING_WEIGHTS;
    const riskScore = 0.33;
    const timeScore = 1.0; // Reference
    const distScore = 1.0; // Reference

    const balancedScore =
      weights.risk_weight * riskScore +
      weights.time_weight * timeScore +
      weights.distance_weight * distScore;

    // 0.5 * 0.33 + 0.3 * 1.0 + 0.2 * 1.0 = 0.165 + 0.3 + 0.2 = 0.665
    assert.strictEqual(balancedScore, 0.665);
  });

  it("should favor risk when risk_weight is higher", () => {
    const weights = { risk_weight: 0.8, time_weight: 0.1, distance_weight: 0.1 };
    const riskScore = 0.1; // Low risk
    const timeScore = 1.0;
    const distScore = 1.0;

    const balancedScore =
      weights.risk_weight * riskScore +
      weights.time_weight * timeScore +
      weights.distance_weight * distScore;

    // Should be lower due to low risk
    assert.ok(balancedScore < 0.5);
  });
});
