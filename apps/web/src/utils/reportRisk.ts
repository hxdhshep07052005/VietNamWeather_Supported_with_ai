import type { ReportAssessment, ReportWeatherEvidence, WeatherConditionCode } from "@vietnam-weather/contracts";
import type { ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";

const conditions: Record<WeatherConditionCode, [string, string]> = {
  clear: ["Trời quang", "Clear"], partly_cloudy: ["Có mây", "Partly Cloudy"], cloudy: ["Nhiều mây", "Cloudy"],
  rain: ["Mưa", "Rain"], heavy_rain: ["Mưa lớn", "Heavy Rain"], thunderstorm: ["Dông sét", "Thunderstorm"],
  fog: ["Sương mù", "Fog"], drizzle: ["Mưa phùn", "Drizzle"], snow: ["Tuyết", "Snow"],
  haze: ["Mù khô", "Haze"],
  dust: ["Bụi", "Dust"],
  smoke: ["Khói", "Smoke"],
  smog: ["Mù khói", "Smog"],
  dust_storm: ["Bão bụi", "Dust storm"],
  sandstorm: ["Bão cát", "Sandstorm"],
  sleet: ["Mưa tuyết", "Sleet"], hail: ["Mưa đá", "Hail"], unknown: ["Chưa có trạng thái thời tiết", "Condition unavailable"],
};

export function weatherConditionText(code: string, isEn = false): string {
  const normalized = Object.prototype.hasOwnProperty.call(conditions, code) ? code as WeatherConditionCode : "unknown";
  return conditions[normalized][isEn ? 1 : 0];
}

export function generalRiskNote(assessment: ReportAssessment | undefined, isEn = false): string {
  const partial = !assessment || assessment.evidence.some(item => item.severity === 0);
  return isEn
    ? "General weather risk" + (partial ? " · Partial evidence; missing dimensions remain unknown." : "")
    : "Rủi ro thời tiết tổng quát" + (partial ? " · Dữ liệu chưa đầy đủ; các yếu tố thiếu vẫn chưa xác định." : "");
}

export function reportMeasurements(weather: ReportWeatherEvidence) {
  const code = weather.condition_code ?? "unknown";
  return {
    conditionCode: (Object.prototype.hasOwnProperty.call(conditions, code) ? code : "unknown") as ProvinceGeoFeatureProperties["conditionCode"],
    conditionText: weatherConditionText(code),
    temp: weather.temperature_c ?? NaN,
    humidity: weather.humidity_percent ?? NaN,
    windSpeedKmh: weather.wind_kmh ?? NaN,
    windGustKmh: weather.gust_kmh ?? NaN,
    feelsLike: weather.feels_like_c ?? NaN,
    pressureHpa: weather.pressure_hpa ?? NaN,
    visibilityKm: weather.visibility_m == null ? NaN : weather.visibility_m / 1000,
    precipitationMm: weather.precipitation_mm ?? NaN,
    rainProbabilityPercent: weather.precipitation_probability_percent ?? NaN,
    uvIndex: weather.uv_index ?? NaN,
    cloudCoverPercent: weather.cloud_cover_percent ?? NaN,
  };
}

export function formatMeasurement(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : String(Math.round(value * 10) / 10);
}

type ReportEvidence = ReportAssessment["evidence"][number];

export function rainEvidenceLabel(evidence: ReportEvidence | undefined, isEn = false): string {
  return evidence?.source_kind === "hourly_forecast"
    ? (isEn ? "Rain forecast (mm/h)" : "Mưa dự báo (mm/h)")
    : (isEn ? "Rain (mm/h)" : "Mưa (mm/h)");
}

export function formatEvidenceValue(evidence: ReportEvidence | undefined, isEn = false): string {
  const value = evidence?.value;
  if (value == null) return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    const precision = evidence?.dimension === "rain" ? 100 : 10;
    return String(Math.round(value * precision) / precision);
  }
  const stormLabels: Record<string, [string, string]> = {
    none: ["Không có dông", "No storm"], distant: ["Dông xa", "Distant storm"],
    cumulonimbus: ["Mây dông", "Cumulonimbus"], direct: ["Dông trực tiếp", "Direct storm"],
    hail: ["Mưa đá", "Hail"], unclassified: ["Chưa phân loại", "Unclassified"],
  };
  return stormLabels[value]?.[isEn ? 1 : 0] ?? value;
}

export function evidenceMissingText(dimension: string, assessment: ReportAssessment | undefined, isEn = false): string {
  if (assessment?.reasons.includes("weather_query_failed")) return riskReasonText("weather_query_failed", isEn);
  if (dimension === "alert" && assessment?.reasons.includes("official_alert_source_not_integrated")) {
    return riskReasonText("official_alert_source_not_integrated", isEn);
  }
  if (dimension === "rain" && assessment?.reasons.includes("observation_precipitation_interval_unspecified")) {
    return riskReasonText("observation_precipitation_interval_unspecified", isEn);
  }
  const labels: Record<string, [string, string]> = {
    rain: ["Nguồn chưa cung cấp cường độ mưa theo giờ.", "Source has no hourly rainfall intensity."],
    wind: ["Nguồn chưa cung cấp tốc độ gió giật.", "Source has no wind gust measurement."],
    temperature: ["Nguồn chưa cung cấp nhiệt độ.", "Source has no temperature measurement."],
    visibility: ["Nguồn chưa cung cấp tầm nhìn.", "Source has no visibility measurement."],
    storm: ["Chưa đủ bằng chứng phân loại dông; không đồng nghĩa không có dông.", "Insufficient storm classification evidence; this does not mean no storm."],
    alert: ["Chưa có dữ liệu cảnh báo chính thức; không đồng nghĩa không có cảnh báo.", "Official alert evidence is unavailable; this does not mean no alerts."],
  };
  return labels[dimension]?.[isEn ? 1 : 0] ?? (isEn ? "Evidence unavailable." : "Chưa có dữ liệu.");
}

export function formatRiskScore(score: number | null | undefined, isEn = false): string {
  return score == null || !Number.isFinite(score) || score <= 0
    ? isEn ? "Insufficient data" : "Chưa đủ dữ liệu"
    : `${Math.round(score * 100)}/100`;
}
export function reportRiskDisplay(assessment?: ReportAssessment) {
  const level = assessment?.level ?? "unknown";
  return {
    riskLevel: level,
    riskScore: level === "unknown" ? null : assessment?.display_score ?? null,
    riskColor: { unknown: "#64748B", low: "#22C55E", caution: "#F59E0B", high: "#EF4444" }[level],
    riskText: { unknown: "Chưa đủ dữ liệu", low: "Rủi ro thấp", caution: "Cần chú ý", high: "Nguy cơ cao" }[level],
  };
}

export function riskReasonText(reason: string, isEn = false): string {
  const labels: Record<string, [string, string]> = {
    general_weather_partial_evidence: ["Đánh giá tổng quát chỉ dựa trên các yếu tố đã có dữ liệu.", "General assessment uses only available evidence."],
    provider_issue_time_unavailable_using_fetch_age: ["Nguồn không cung cấp thời điểm phát hành; độ mới được tính từ lần tải dữ liệu.", "Provider issue time is unavailable; freshness uses the data retrieval time."],
    weather_stale_or_expired: ["Dữ liệu đã cũ hoặc hết hạn.", "Weather data is stale or expired."],
    rain_from_hourly_forecast: ["Cường độ mưa lấy từ dự báo theo giờ phù hợp thời điểm đã chọn, không phải lượng mưa quan trắc hiện tại.", "Rain intensity comes from the hourly forecast for the selected time, not the current rain observation."],
    hourly_rain_query_failed: ["Không tải được dự báo mưa theo giờ bổ sung; cường độ mưa chưa xác định.", "The supplementary hourly rain forecast could not be loaded; rain intensity is unavailable."],
    rain_unavailable: ["Chưa xác định cường độ mưa theo giờ.", "Hourly rainfall intensity is unavailable."],
    storm_unavailable: ["Chưa đủ dữ liệu phân loại dông.", "Storm classification is unavailable."],
    alert_unavailable: ["Chưa có dữ liệu cảnh báo chính thức.", "Official alert evidence is unavailable."],
    vehicle_not_selected: ["Chọn ô tô hoặc xe máy để đánh giá rủi ro.", "Select car or motorcycle to assess risk."],
    official_alert_source_not_integrated: ["Chưa kết nối nguồn cảnh báo thiên tai chính thức.", "Official alert source is not connected."],
    storm_classification_unavailable: ["Nguồn dữ liệu chưa phân biệt dông xa và dông trực tiếp.", "Distant versus direct storm evidence is unavailable."],
    observation_precipitation_interval_unspecified: ["Có lượng mưa nhưng chưa xác định khoảng đo để quy đổi mm/h.", "Rain accumulation interval is unspecified; hourly rate is unavailable."],
    forecast_visibility_unavailable: ["Dự báo chưa cung cấp tầm nhìn.", "Forecast visibility is unavailable."],
    weather_query_failed: ["Không truy vấn được dữ liệu thời tiết.", "Weather data query failed."],
    no_matching_weather_within_15km: ["Chưa có dữ liệu phù hợp thời điểm trong bán kính 15 km.", "No matching weather within 15 km at the selected time."],
  };
  return labels[reason]?.[isEn ? 1 : 0] ?? (isEn ? `Incomplete evidence: ${reason}` : `Bằng chứng chưa đầy đủ: ${reason}`);
}
