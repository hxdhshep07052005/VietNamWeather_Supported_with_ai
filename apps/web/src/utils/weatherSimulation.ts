/**
 * Weather Simulation Engine & Geographic Realism Utility
 * Computes realistic baseline weather and future simulated forecasts (+3h, +6h, +12h, +24h, +48h, +72h)
 * for Vietnam's 63 provinces across 8 socio-economic regions.
 */

import type { ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import type { VietnamRegion } from "@/data/provinces";

export interface TimelineMilestone {
  value: number; // offset in hours
  shortLabel: string;
  subLabel: string;
  dayLabel: string;
}

export const TIMELINE_MILESTONES: TimelineMilestone[] = [
  { value: 0, shortLabel: "Hiện tại", subLabel: "Bây giờ", dayLabel: "Hôm nay" },
  { value: 3, shortLabel: "+3h", subLabel: "3 giờ tới", dayLabel: "Hôm nay" },
  { value: 6, shortLabel: "+6h", subLabel: "6 giờ tới", dayLabel: "Hôm nay" },
  { value: 12, shortLabel: "+12h", subLabel: "12 giờ tới", dayLabel: "Hôm nay" },
  { value: 24, shortLabel: "+24h", subLabel: "1 ngày sau", dayLabel: "Ngày mai" },
  { value: 48, shortLabel: "+48h", subLabel: "2 ngày sau", dayLabel: "Ngày kia" },
  { value: 72, shortLabel: "+72h", subLabel: "3 ngày sau", dayLabel: "3 ngày tới" },
];

interface RegionalBaseline {
  temp: number;
  feelsLike: number;
  conditionCode: ProvinceGeoFeatureProperties["conditionCode"];
  conditionText: string;
  humidity: number;
  windSpeedKmh: number;
  windGustKmh: number;
  precipitationMm: number;
  uvIndex: number;
  visibilityKm: number;
  pressureHpa: number;
  cloudCoverPercent: number;
  riskLevel: "low" | "caution" | "high";
  riskScore: number;
  riskText: string;
  riskColor: string;
}

// Realistic baseline profiles per region
const REGION_BASELINES: Record<VietnamRegion, RegionalBaseline> = {
  "Northwest": {
    temp: 22,
    feelsLike: 23,
    conditionCode: "partly_cloudy",
    conditionText: "Trời mát, sương mù đèo dốc rải rác",
    humidity: 78,
    windSpeedKmh: 14,
    windGustKmh: 22,
    precipitationMm: 0.2,
    uvIndex: 4,
    visibilityKm: 7.5,
    pressureHpa: 1014,
    cloudCoverPercent: 45,
    riskLevel: "caution",
    riskScore: 35,
    riskText: "Cần chú ý",
    riskColor: "#F59E0B",
  },
  "Northeast": {
    temp: 25,
    feelsLike: 26,
    conditionCode: "partly_cloudy",
    conditionText: "Mây thay đổi, ngày nắng nhẹ",
    humidity: 72,
    windSpeedKmh: 15,
    windGustKmh: 24,
    precipitationMm: 0,
    uvIndex: 5,
    visibilityKm: 9.5,
    pressureHpa: 1013,
    cloudCoverPercent: 35,
    riskLevel: "low",
    riskScore: 18,
    riskText: "An toàn",
    riskColor: "#22C55E",
  },
  "Red River Delta": {
    temp: 29,
    feelsLike: 31,
    conditionCode: "clear",
    conditionText: "Trời nắng, tầm nhìn thông thoáng",
    humidity: 68,
    windSpeedKmh: 12,
    windGustKmh: 18,
    precipitationMm: 0,
    uvIndex: 7,
    visibilityKm: 10.0,
    pressureHpa: 1011,
    cloudCoverPercent: 20,
    riskLevel: "low",
    riskScore: 12,
    riskText: "An toàn",
    riskColor: "#22C55E",
  },
  "North Central Coast": {
    temp: 31,
    feelsLike: 34,
    conditionCode: "thunderstorm",
    conditionText: "Có mưa dông đối lưu cục bộ về chiều",
    humidity: 82,
    windSpeedKmh: 24,
    windGustKmh: 42,
    precipitationMm: 28.5,
    uvIndex: 6,
    visibilityKm: 4.0,
    pressureHpa: 1008,
    cloudCoverPercent: 75,
    riskLevel: "high",
    riskScore: 72,
    riskText: "Nguy cơ cao",
    riskColor: "#EF4444",
  },
  "South Central Coast": {
    temp: 30,
    feelsLike: 32,
    conditionCode: "clear",
    conditionText: "Nắng ven biển, gió thổi êm ả",
    humidity: 65,
    windSpeedKmh: 18,
    windGustKmh: 26,
    precipitationMm: 0,
    uvIndex: 8,
    visibilityKm: 10.0,
    pressureHpa: 1010,
    cloudCoverPercent: 15,
    riskLevel: "low",
    riskScore: 14,
    riskText: "An toàn",
    riskColor: "#22C55E",
  },
  "Central Highlands": {
    temp: 24,
    feelsLike: 25,
    conditionCode: "rain",
    conditionText: "Mưa rào nhẹ, khí hậu cao nguyên se lạnh",
    humidity: 80,
    windSpeedKmh: 16,
    windGustKmh: 25,
    precipitationMm: 4.5,
    uvIndex: 4,
    visibilityKm: 8.0,
    pressureHpa: 1012,
    cloudCoverPercent: 60,
    riskLevel: "caution",
    riskScore: 38,
    riskText: "Cần chú ý",
    riskColor: "#F59E0B",
  },
  "Southeast": {
    temp: 32,
    feelsLike: 36,
    conditionCode: "partly_cloudy",
    conditionText: "Nắng nóng ban ngày, chiều tối có mưa rào",
    humidity: 74,
    windSpeedKmh: 14,
    windGustKmh: 20,
    precipitationMm: 2.0,
    uvIndex: 9,
    visibilityKm: 9.0,
    pressureHpa: 1009,
    cloudCoverPercent: 40,
    riskLevel: "low",
    riskScore: 22,
    riskText: "An toàn",
    riskColor: "#22C55E",
  },
  "Mekong Delta": {
    temp: 31,
    feelsLike: 35,
    conditionCode: "rain",
    conditionText: "Mưa rào rải rác vùng đồng bằng ven sông",
    humidity: 85,
    windSpeedKmh: 16,
    windGustKmh: 28,
    precipitationMm: 8.0,
    uvIndex: 6,
    visibilityKm: 8.5,
    pressureHpa: 1010,
    cloudCoverPercent: 65,
    riskLevel: "caution",
    riskScore: 40,
    riskText: "Cần chú ý",
    riskColor: "#F59E0B",
  },
};

/**
 * Deterministically enriches a province with realistic weather and simulation logic
 */
export function getEnrichedProvinceWeather(
  province: ProvinceGeoFeatureProperties,
  offsetHours = 0
): ProvinceGeoFeatureProperties {
  const base = REGION_BASELINES[province.region] || REGION_BASELINES["Red River Delta"];

  // Province-specific slight delta based on province name char code
  const seed = province.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tempVariance = (seed % 5) - 2; // -2 to +2 °C
  const humidVariance = (seed % 9) - 4; // -4 to +4 %

  // Special climate exceptions
  let localTemp = base.temp + tempVariance;
  let localCondition = base.conditionCode;
  let localText = base.conditionText;
  let localRisk = base.riskLevel;
  let localRiskScore = base.riskScore;
  let localRiskColor = base.riskColor;
  let localRiskText = base.riskText;
  let localPrecip = base.precipitationMm;

  if (province.name === "Lâm Đồng" || province.name === "Lào Cai") {
    // High mountain cooling (Da Lat, Sa Pa)
    localTemp = 18 + (seed % 3);
    localCondition = "rain";
    localText = "Se lạnh vùng cao, có sương mù và mưa phùn";
  }

  if (province.name === "Hà Tĩnh" || province.name === "Quảng Bình") {
    // Storm hotspot in simulation
    localCondition = "thunderstorm";
    localText = "Cảnh báo dông sét và gió giật mạnh";
    localRisk = "high";
    localRiskScore = 78;
    localRiskColor = "#EF4444";
    localRiskText = "Nguy cơ cao";
    localPrecip = 38.0;
  }

  // --- TIME OFFSET SIMULATION ---
  let simTemp = localTemp;
  let simHumid = base.humidity + humidVariance;
  let simCondition = localCondition;
  let simText = localText;
  let simRisk = localRisk;
  let simRiskScore = localRiskScore;
  let simRiskColor = localRiskColor;
  let simRiskText = localRiskText;
  let simPrecip = localPrecip;

  if (offsetHours > 0) {
    if (offsetHours <= 3) {
      simTemp += 1;
      simText = `${localText} (Xu hướng tăng nhẹ nhiệt độ)`;
    } else if (offsetHours <= 6) {
      simTemp -= 2;
      simHumid += 5;
      simText = `Đêm chuyển mát, độ ẩm tăng lên ${simHumid}%`;
    } else if (offsetHours <= 12) {
      simTemp -= 4;
      simHumid += 10;
      simText = `Rạng sáng se lạnh, sương mù xuất hiện ven sông`;
    } else if (offsetHours <= 24) {
      // 1 ngày sau (24h)
      // Diurnal cycle: next day forecast
      simTemp += (seed % 3) === 0 ? -1 : 1;
      if (localRisk === "high") {
        // High storm weakens over 24h
        simRisk = "caution";
        simRiskScore = 48;
        simRiskColor = "#F59E0B";
        simRiskText = "Cần chú ý";
        simCondition = "rain";
        simText = "Dông sét suy yếu thành mưa rào rải rác (Dự báo 1 ngày sau)";
        simPrecip = 12.0;
      } else if (localCondition === "clear") {
        simText = "Trời nắng đẹp, tầm nhìn trên 10 km (Dự báo 1 ngày sau)";
      } else {
        simText = `${localText} (Dự báo 1 ngày sau)`;
      }
    } else if (offsetHours <= 48) {
      // 2 ngày sau (48h)
      simTemp += 2;
      simText = "Áp cao lục địa suy yếu, ngày nắng ráo (Dự báo 2 ngày sau)";
      if (simRisk === "high") {
        simRisk = "low";
        simRiskScore = 20;
        simRiskColor = "#22C55E";
        simRiskText = "An toàn";
        simCondition = "partly_cloudy";
      }
    } else {
      // 3 ngày sau (72h)
      simText = "Thời tiết ổn định trên diện rộng (Dự báo 3 ngày sau)";
      simRisk = "low";
      simRiskScore = 15;
      simRiskColor = "#22C55E";
      simRiskText = "An toàn";
      simCondition = "clear";
    }
  }

  return {
    ...province,
    temp: Math.round(simTemp),
    feelsLike: Math.round(simTemp + 2),
    humidity: Math.min(99, Math.max(40, simHumid)),
    conditionCode: simCondition,
    conditionText: simText,
    precipitationMm: simPrecip,
    riskLevel: simRisk,
    riskScore: simRiskScore,
    riskColor: simRiskColor,
    riskText: simRiskText,
  };
}
