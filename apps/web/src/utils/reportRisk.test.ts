import { describe, it, expect } from "vitest";
import { formatMeasurement, formatRiskScore, reportRiskDisplay, reportMeasurements, weatherConditionText, formatEvidenceValue } from "./reportRisk";
import type { ReportWeatherEvidence } from "@vietnam-weather/contracts";
describe("report presentation", () => {
  it("rounds evidence while retaining real zero and rain precision", () => {
    expect(formatEvidenceValue({ dimension: "wind", severity: 1, value: 17.7012 })).toBe("17.7");
    expect(formatEvidenceValue({ dimension: "rain", severity: 1, value: 0.126 })).toBe("0.13");
    expect(formatEvidenceValue({ dimension: "rain", severity: 1, value: 0 })).toBe("0");
    expect(formatEvidenceValue({ dimension: "rain", severity: 0, value: null })).toBe("—");
    expect(formatEvidenceValue({ dimension: "storm", severity: 3, value: "direct" })).toBe("Dông trực tiếp");
  });
  it("labels every normalized weather condition", () => {
    for (const code of ["clear", "partly_cloudy", "cloudy", "fog", "drizzle", "rain", "heavy_rain", "thunderstorm", "sleet", "snow", "hail", "haze", "dust", "smoke", "smog", "dust_storm", "sandstorm"]) {
      expect(weatherConditionText(code, true)).not.toBe("Condition unavailable");
      expect(weatherConditionText(code)).not.toBe("Chưa có trạng thái thời tiết");
    }
  });
  it("distinguishes haze, fog and particulate conditions without inventing unknown labels", () => {
    expect(weatherConditionText("haze")).toBe("Mù khô");
    expect(weatherConditionText("fog")).toBe("Sương mù");
    expect(weatherConditionText("smoke")).toBe("Khói");
    expect(weatherConditionText("smog")).toBe("Mù khói");
    expect(weatherConditionText("dust_storm", true)).toBe("Dust storm");
    expect(weatherConditionText("sandstorm")).toBe("Bão cát");
    for (const code of ["unknown", "unsupported_code", "toString"]) {
      expect(weatherConditionText(code, true)).toBe("Condition unavailable");
    }
  });
  it("retains observed weather independently from unavailable hazard evidence", () => {
    const weather: ReportWeatherEvidence = {
      temperature_c: 27, humidity_percent: 80, wind_kmh: 0, gust_kmh: 12,
      feels_like_c: 29, pressure_hpa: 1008, precipitation_mm: 0,
      rain_mm_per_hour: null, visibility_m: 7200, storm: null, official_alert_level: null,
      freshness: "fresh", coverage: "covered", source: "provider", source_time: null,
      valid_from: null, valid_to: null, reasons: ["official_alert_source_not_integrated"],
    };
    expect(reportMeasurements(weather)).toMatchObject({ temp: 27, humidity: 80, windSpeedKmh: 0,
      windGustKmh: 12, feelsLike: 29, pressureHpa: 1008, precipitationMm: 0, visibilityKm: 7.2 });
    expect(reportMeasurements({ ...weather, humidity_percent: null }).humidity).toBeNaN();
    expect(reportMeasurements({ ...weather, condition_code: "haze" })).toMatchObject({ conditionCode: "haze", conditionText: "Mù khô" });
    expect(reportMeasurements({ ...weather, condition_code: "unsupported_code" }).conditionCode).toBe("unknown");
  });
  it("never turns unknown or severity zero into a safe score", () => {
    for (const value of [null, undefined, NaN, 0]) expect(formatRiskScore(value)).toBe("Chưa đủ dữ liệu");
    expect(reportRiskDisplay()).toMatchObject({ riskLevel: "unknown", riskScore: null });
  });
  it("formats report scores and absent measurements", () => {
    expect(formatRiskScore(1 / 3)).toBe("33/100");
    expect(formatRiskScore(2 / 3)).toBe("67/100");
    expect(formatRiskScore(13 / 24)).toBe("54/100");
    expect(formatMeasurement(NaN)).toBe("—");
    expect(formatMeasurement(null)).toBe("—");
    expect(formatMeasurement(0)).toBe("0");
  });
});
