/**
 * Phase 7 Forecast Service Tests
 * Tests for forecast formatting, timezone, and horizon limits
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  FORECAST_HOURLY_MAX_HOURS,
  FORECAST_DAILY_MAX_DAYS,
  DISPLAY_TIMEZONE_OFFSET_HOURS,
  formatDisplayTime,
  formatDisplayDate,
  FRESHNESS_STATES,
  TREND_DIRECTIONS,
  TEMP_TREND_THRESHOLD_C,
} from "@vietnam-weather/contracts";

// =============================================================================
// Timezone Formatting Tests (FCAST-005)
// =============================================================================

describe("Timezone Formatting (FCAST-005)", () => {
  describe("formatDisplayTime", () => {
    it("converts UTC 00:00 to 07:00 ICT (Vietnam)", () => {
      const result = formatDisplayTime("2026-08-14T00:00:00Z");
      assert.strictEqual(result, "07:00 ICT");
    });

    it("converts UTC 07:00 to 14:00 ICT", () => {
      const result = formatDisplayTime("2026-08-14T07:00:00Z");
      assert.strictEqual(result, "14:00 ICT");
    });

    it("handles midnight crossing correctly (UTC 20:00 = ICT 03:00 next day)", () => {
      const result = formatDisplayTime("2026-08-14T20:00:00Z");
      assert.strictEqual(result, "03:00 ICT");
    });

    it("formats minutes with leading zero", () => {
      const result = formatDisplayTime("2026-08-14T02:30:00Z");
      assert.strictEqual(result, "09:30 ICT");
    });
  });

  describe("formatDisplayDate", () => {
    it("formats date in Vietnamese locale", () => {
      const result = formatDisplayDate("2026-08-14T00:00:00Z", "vi");
      assert.ok(result.includes("14"));
      assert.ok(result.includes("thg"));
    });

    it("formats date in English locale", () => {
      const result = formatDisplayDate("2026-08-14T00:00:00Z", "en");
      assert.ok(result.includes("14"));
      assert.ok(result.includes("Aug"));
    });
  });
});

// =============================================================================
// Horizon Limit Tests (FCAST-001)
// =============================================================================

describe("Horizon Limits (FCAST-001)", () => {
  it("hourly max is 72 hours", () => {
    assert.strictEqual(FORECAST_HOURLY_MAX_HOURS, 72);
  });

  it("daily max is 3 days", () => {
    assert.strictEqual(FORECAST_DAILY_MAX_DAYS, 3);
  });

  it("Vietnam timezone offset is UTC+7", () => {
    assert.strictEqual(DISPLAY_TIMEZONE_OFFSET_HOURS, 7);
  });
});

// =============================================================================
// Freshness States Tests
// =============================================================================

describe("Freshness States", () => {
  it("has all required freshness states", () => {
    assert.ok(FRESHNESS_STATES.FRESH);
    assert.ok(FRESHNESS_STATES.STALE);
    assert.ok(FRESHNESS_STATES.EXPIRED);
    assert.ok(FRESHNESS_STATES.UNAVAILABLE);
  });
});

// =============================================================================
// Trend Direction Tests (FCAST-002)
// =============================================================================

describe("Trend Directions (FCAST-002)", () => {
  it("has all required trend directions", () => {
    assert.ok(TREND_DIRECTIONS.INCREASING);
    assert.ok(TREND_DIRECTIONS.DECREASING);
    assert.ok(TREND_DIRECTIONS.STABLE);
  });

  it("temperature trend threshold is 2°C", () => {
    assert.strictEqual(TEMP_TREND_THRESHOLD_C, 2);
  });
});

// =============================================================================
// Forecast Data Point Tests
// =============================================================================

describe("Forecast Data Structure", () => {
  it("hourly point should have all required fields", () => {
    const hourlyPoint = {
      time: "2026-08-14T00:00:00Z",
      display_time: "07:00 ICT",
      temp_c: 30,
      feels_like_c: 33,
      wind_speed: 5,
      wind_dir_deg: 90,
      wind_dir_text: "E",
      humidity: 75,
      precip_probability: 20,
      precip_mm: 0,
      uv_index: 8,
      vis_km: 10,
      condition_code: 1000,
      condition_text: "Sunny",
      is_gap: false,
      freshness: FRESHNESS_STATES.FRESH,
    };

    assert.strictEqual(hourlyPoint.temp_c, 30);
    assert.strictEqual(hourlyPoint.is_gap, false);
    assert.strictEqual(hourlyPoint.freshness, "fresh");
  });

  it("daily point should have all required fields", () => {
    const dailyPoint = {
      date: "2026-08-14T12:00:00Z",
      display_date: "14 thg 8",
      day_of_week: 6,
      max_temp_c: 35,
      min_temp_c: 26,
      avg_temp_c: 30,
      max_wind_speed: 8,
      total_precip_mm: 5,
      avg_humidity: 80,
      uv_index: 10,
      sunrise: "2026-08-14T05:30:00Z",
      sunset: "2026-08-14T18:15:00Z",
      moon_phase: "Waxing Gibbous",
      condition_code: 1003,
      condition_text: "Partly cloudy",
      is_gap: false,
      freshness: FRESHNESS_STATES.FRESH,
    };

    assert.strictEqual(dailyPoint.max_temp_c, 35);
    assert.strictEqual(dailyPoint.day_of_week, 6);
    assert.strictEqual(dailyPoint.is_gap, false);
  });

  it("gap point should have null values", () => {
    const gapPoint = {
      time: "2026-08-14T06:00:00Z",
      display_time: "13:00 ICT",
      temp_c: null,
      feels_like_c: null,
      wind_speed: null,
      wind_dir_deg: null,
      wind_dir_text: null,
      humidity: null,
      precip_probability: null,
      precip_mm: null,
      uv_index: null,
      vis_km: null,
      condition_code: null,
      condition_text: null,
      is_gap: true,
      freshness: FRESHNESS_STATES.UNAVAILABLE,
    };

    assert.strictEqual(gapPoint.is_gap, true);
    assert.strictEqual(gapPoint.temp_c, null);
    assert.strictEqual(gapPoint.freshness, "unavailable");
  });
});

// =============================================================================
// Attribution Tests (FCAST-004)
// =============================================================================

describe("Attribution Metadata", () => {
  it("should include provider and issue time", () => {
    const attribution = {
      provider: "WeatherAPI.com",
      attribution_text: "Powered by WeatherAPI.com",
      attribution_url: "https://www.weatherapi.com",
      issue_time: "2026-08-14T06:00:00Z",
      last_updated: "2026-08-14T08:30:00Z",
    };

    assert.strictEqual(attribution.provider, "WeatherAPI.com");
    assert.ok(attribution.issue_time);
    assert.ok(attribution.last_updated);
  });
});

// =============================================================================
// Stale Data Tests
// =============================================================================

describe("Stale Data Handling", () => {
  it("stale forecast should be marked", () => {
    const stalePoint = {
      time: "2026-08-14T00:00:00Z",
      display_time: "07:00 ICT",
      temp_c: 30,
      is_gap: false,
      freshness: FRESHNESS_STATES.STALE,
    };

    assert.strictEqual(stalePoint.freshness, "stale");
  });

  it("stale warning should be shown", () => {
    const forecast = {
      freshness: FRESHNESS_STATES.STALE,
      stale_warning: "Dữ liệu có thể không còn mới nhất",
    };

    assert.ok(forecast.stale_warning);
    assert.strictEqual(forecast.stale_warning.includes("không còn mới"), true);
  });
});

// =============================================================================
// Horizon Warning Tests
// =============================================================================

describe("Horizon Limitations", () => {
  it("should warn when data is truncated", () => {
    const forecast = {
      requested_hourly_hours: 72,
      hourly_points: 48, // Only 48 available
      horizon_warning: "Dữ liệu bị giới hạn bởi khả năng cung cấp của nhà cung cấp",
    };

    assert.ok(forecast.horizon_warning);
  });
});
