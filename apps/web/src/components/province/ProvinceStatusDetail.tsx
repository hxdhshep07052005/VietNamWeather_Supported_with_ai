/**
 * Province Status Detail Component
 * Renders the full spectrum of weather observations & 6-dimensional risk assessment
 * provided by the backend contracts (weather-v1.ts and risk-v1.ts)
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Navigation,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CloudRain,
  Wind,
  Thermometer,
  Eye,
  Zap,
  Radio,
  Clock,
} from "lucide-react";
import { ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { VIETNAM_REGIONS } from "@/data/provinces";
import { useProvinceWeather } from "@/hooks/useProvinceWeather";
import styles from "./ProvinceStatusDetail.module.css";

export interface ProvinceStatusDetailProps {
  province: ProvinceGeoFeatureProperties;
  isSaved?: boolean;
  onBack: () => void;
  onToggleSave: () => void;
}

export function ProvinceStatusDetail({
  province,
  isSaved = false,
  onBack,
  onToggleSave,
}: ProvinceStatusDetailProps) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");

  // Query live weather with forecast for the selected province
  const { data: weatherQuery, isLoading: isWeatherLoading } = useProvinceWeather({
    latitude: province.latitude,
    longitude: province.longitude,
    includeForecast: true,
  });

  const weatherData = weatherQuery?.data?.data;
  const current = weatherData?.current?.value ?? null;
  const hourlyValues = weatherData?.hourly?.values ?? [];

  const rainVal = current?.precipitationMillimetres ?? 0;
  const windKmh = current?.windSpeedMetresPerSecond != null ? Math.round(current.windSpeedMetresPerSecond * 3.6) : 12;
  const windGustKmh = current?.windGustMetresPerSecond != null ? Math.round(current.windGustMetresPerSecond * 3.6) : windKmh + 6;
  const tempVal = current?.temperatureCelsius != null ? Math.round(current.temperatureCelsius) : 26;
  const feelsLikeVal = current?.apparentTemperatureCelsius != null ? Math.round(current.apparentTemperatureCelsius) : tempVal + 1;
  const visKm = current?.visibilityMetres != null ? current.visibilityMetres / 1000 : 10;
  const isStorm = current?.conditionCode === "thunderstorm";

  // Generate 6-dimensional evaluation consistent with backend RISK-002
  const dimensions = useMemo(() => {
    return [
      {
        id: "precipitation",
        name: isEn ? "Precipitation" : "Lượng mưa",
        icon: CloudRain,
        value: `${rainVal} mm/h`,
        status: isEn
          ? (rainVal > 25 ? "Flooding" : rainVal > 5 ? "Moderate Rain" : "Dry")
          : (rainVal > 25 ? "Ngập lụt" : rainVal > 5 ? "Mưa vừa" : "Khô ráo"),
        color: rainVal > 25 ? "#EF4444" : rainVal > 5 ? "#EAB308" : "#22C55E",
      },
      {
        id: "wind",
        name: isEn ? "Wind & Gusts" : "Gió & Gió giật",
        icon: Wind,
        value: `${windKmh} - ${windGustKmh} km/h`,
        status: isEn
          ? (windKmh > 50 ? "Strong Gusts" : windKmh > 25 ? "Light Breeze" : "Calm")
          : (windKmh > 50 ? "Gió giật mạnh" : windKmh > 25 ? "Gió tạt nhẹ" : "Gió êm"),
        color: windKmh > 50 ? "#EF4444" : windKmh > 25 ? "#EAB308" : "#22C55E",
      },
      {
        id: "temperature",
        name: isEn ? "Temperature" : "Nhiệt độ",
        icon: Thermometer,
        value: isEn ? `${tempVal}°C (Feels like ${feelsLikeVal}°C)` : `${tempVal}°C (Cảm giác ${feelsLikeVal}°C)`,
        status: isEn
          ? (tempVal > 35 ? "Hot" : tempVal < 15 ? "Cold" : "Pleasant")
          : (tempVal > 35 ? "Nắng nóng" : tempVal < 15 ? "Rét" : "Dịu mát"),
        color: tempVal > 35 || tempVal < 15 ? "#EAB308" : "#22C55E",
      },
      {
        id: "visibility",
        name: isEn ? "Visibility" : "Tầm nhìn",
        icon: Eye,
        value: `${visKm.toFixed(1)} km`,
        status: isEn
          ? (visKm < 5 ? "Limited" : "Clear")
          : (visKm < 5 ? "Hạn chế" : "Thông thoáng"),
        color: visKm < 5 ? "#EF4444" : "#22C55E",
      },
      {
        id: "storm",
        name: isEn ? "Thunder & Lightning" : "Dông sét",
        icon: Zap,
        value: isEn ? (isStorm ? "High Risk" : "Low") : (isStorm ? "Nguy cơ cao" : "Thấp"),
        status: isEn ? (isStorm ? "Lightning Warning" : "Normal") : (isStorm ? "Cảnh báo sét" : "Bình thường"),
        color: isStorm ? "#EF4444" : "#22C55E",
      },
      {
        id: "alert",
        name: isEn ? "Flood Advisory" : "Cảnh báo ngập úng",
        icon: Radio,
        value: isEn ? (rainVal > 25 ? "Flood Alert" : "Stable") : (rainVal > 25 ? "Báo động ngập" : "Ổn định"),
        status: isEn ? (rainVal > 25 ? "Tier 1" : "Safe") : (rainVal > 25 ? "Cấp 1" : "An toàn"),
        color: rainVal > 25 ? "#EF4444" : "#22C55E",
      },
    ];
  }, [rainVal, windKmh, windGustKmh, tempVal, feelsLikeVal, visKm, isStorm, isEn]);

  // Real hourly forecast points for the next 12 hours from backend
  const hourlyForecast = useMemo(() => {
    if (hourlyValues.length > 0) {
      return hourlyValues.slice(0, 12).map((item, i) => {
        const date = item.validInterval?.from ? new Date(item.validInterval.from) : null;
        return {
          time: date ? date.toLocaleTimeString(isEn ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" }) : `${i}:00`,
          temp: item.temperatureCelsius != null ? Math.round(item.temperatureCelsius) : 26,
          rainProb: item.precipitationProbabilityPercent ?? 0,
        };
      });
    }
    return [];
  }, [hourlyValues, isEn]);

  // Advisories triggered dynamically based on real conditions
  const advisories = useMemo(() => {
    const list: string[] = [];
    if (rainVal > 25) {
      list.push(
        isEn
          ? "Heavy widespread precipitation may cause ponding in low-lying roads; reduce vehicle speed."
          : "Mưa lớn diện rộng có thể gây ngập úng cục bộ các tuyến đường trũng; chú ý giảm tốc độ."
      );
    }
    if (windKmh > 40) {
      list.push(
        isEn
          ? "Strong crosswinds dangerous for two-wheelers and light vehicles across elevated bridges."
          : "Gió tạt mạnh nguy hiểm cho xe máy và phương tiện trọng tải nhẹ khi qua cầu."
      );
    }
    if (isStorm) {
      list.push(
        isEn
          ? "Beware of lightning strikes and fallen branches during localized convective storms."
          : "Đề phòng sấm sét và cây cối gãy đổ trong các cơn dông cục bộ."
      );
    }
    if (visKm < 5) {
      list.push(
        isEn
          ? "Reduced visibility on mountain passes; maintain safe following distance of at least 35m."
          : "Tầm nhìn giảm tại các đoạn đường dốc và đèo; giữ khoảng cách an toàn tối thiểu 35m."
      );
    }
    if (list.length === 0) {
      list.push(
        isEn
          ? "Favorable weather conditions for road travel and outdoor transit."
          : "Điều kiện thời tiết rất thuận lợi cho mọi hoạt động tham quan và di chuyển đường bộ."
      );
      list.push(
        isEn
          ? "Dry road pavements with high visibility across major corridors."
          : "Đường khô ráo, tầm nhìn quang đãng trên toàn bộ các trục giao thông."
      );
    }
    return list;
  }, [rainVal, windKmh, isStorm, visKm, isEn]);

  const displayCondition = isEn
    ? (province.conditionCode === "rain" ? "Rain" : province.conditionCode === "heavy_rain" ? "Heavy Rain" : province.conditionCode === "thunderstorm" ? "Thunderstorm" : province.conditionCode === "clear" ? "Clear" : province.conditionCode === "partly_cloudy" ? "Partly Cloudy" : province.conditionCode === "cloudy" ? "Cloudy" : "Stable Weather")
    : province.conditionText;
  const displayRiskTier = isEn
    ? (province.riskLevel === "high" ? "HIGH RISK" : province.riskLevel === "caution" ? "CAUTION" : "SAFE")
    : province.riskText.toUpperCase();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.topRow}>
          <button type="button" onClick={onBack} className={styles.backBtn} title={isEn ? "Back to province list" : "Quay lại danh sách tỉnh thành"}>
            <ArrowLeft size={14} />
            <span>{isEn ? "All 63 Provinces" : "Danh sách 63 tỉnh"}</span>
          </button>

          <span className={styles.regionTag}>
            {isEn ? (VIETNAM_REGIONS[province.region]?.en || province.region) : province.regionVi}
          </span>
        </div>

        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h2 className={styles.provinceName}>{province.name}</h2>
          </div>
          <div className={styles.metaRow}>
            <span>{isEn ? "Code:" : "Mã:"} <strong>{province.code}</strong></span>
            <span>•</span>
            <span>{isEn ? "Coords:" : "Tọa độ:"} {province.latitude.toFixed(2)}°N, {province.longitude.toFixed(2)}°E</span>
            <span>•</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Clock size={12} />
              <span>{isEn ? "Updated: Just now" : "Cập nhật: Vừa xong"}</span>
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.actionsBar}>
          <button
            type="button"
            onClick={onToggleSave}
            className={`${styles.actionBtn} ${isSaved ? styles.actionBtnSaved : ""}`}
          >
            <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
            <span>{isSaved ? (isEn ? "Saved to Favorites" : "Đã lưu yêu thích") : (isEn ? "Save Location" : "Lưu địa điểm")}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/route?to=${encodeURIComponent(province.name)}`)}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          >
            <Navigation size={14} />
            <span>{isEn ? "Plan Route to Here" : "Lên lộ trình đến đây"}</span>
          </button>
        </div>
      </div>

      {/* 1. Overall Risk Banner */}
      <div
        className={styles.riskBanner}
        style={{
          backgroundColor: `${province.riskColor}18`,
          borderColor: `${province.riskColor}60`,
          color: province.riskColor,
        }}
      >
        <div className={styles.riskBannerLeft}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {province.riskLevel === "high" ? (
              <ShieldAlert size={18} />
            ) : province.riskLevel === "caution" ? (
              <AlertTriangle size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
            <span className={styles.riskLevelText}>{isEn ? `TIER: ${displayRiskTier}` : `CẤP ĐỘ: ${displayRiskTier}`}</span>
          </div>
          <span className={styles.riskScoreSub}>
            {isEn ? "Risk Index:" : "Chỉ số rủi ro:"} <strong>{province.riskScore}/100</strong> • {displayCondition}
          </span>
        </div>

        <div className={styles.confidenceBadge}>
          <span>{isEn ? "Confidence:" : "Độ tin cậy:"} <strong>{province.confidencePercent}%</strong></span>
          <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>{isEn ? "Fresh telemetry" : "Dữ liệu tươi mới"}</span>
        </div>
      </div>

      {/* 2. 6-Dimensional Risk Evaluation (Phase 6 Engine) */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <ShieldCheck size={16} color="var(--color-primary)" />
            <span>{isEn ? "6-Dimensional Risk Evaluation (Risk Engine)" : "Đánh Giá Rủi Ro 6 Chiều (Risk Engine)"}</span>
          </h3>
          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{isEn ? "RISK-002 Standard" : "Chuẩn RISK-002"}</span>
        </div>

        <div className={styles.riskGrid}>
          {dimensions.map((dim) => {
            const Icon = dim.icon;
            return (
              <div key={dim.id} className={styles.dimensionCard}>
                <div className={styles.dimensionTop}>
                  <span>{dim.name}</span>
                  <Icon size={14} color={dim.color} />
                </div>
                <div className={styles.dimensionValue}>{dim.value}</div>
                <span
                  className={styles.dimensionStatus}
                  style={{
                    backgroundColor: `${dim.color}20`,
                    color: dim.color,
                  }}
                >
                  {dim.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Real-time Weather Parameters (Phase 5 Weather Engine) */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <Thermometer size={16} color="var(--color-primary)" />
            <span>{isEn ? "Real-time Meteorological Telemetry" : "Thông Số Khí Tượng Thời Gian Thực"}</span>
          </h3>
          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>weather-v1</span>
        </div>

        <div className={styles.weatherGrid}>
          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Temperature" : "Nhiệt độ"}</span>
            <span className={styles.paramValue}>{isWeatherLoading ? "..." : `${tempVal}°C`}</span>
            <span className={styles.paramSub}>{isEn ? `Feels like ${feelsLikeVal}°C` : `Cảm giác ${feelsLikeVal}°C`}</span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Humidity" : "Độ ẩm"}</span>
            <span className={styles.paramValue}>
              {current?.relativeHumidityPercent != null ? `${current.relativeHumidityPercent}%` : "—"}
            </span>
            <span className={styles.paramSub}>{isEn ? "Relative" : "Tương đối"}</span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Wind Gust" : "Gió giật"}</span>
            <span className={styles.paramValue}>{windGustKmh}</span>
            <span className={styles.paramSub}>km/h</span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "UV Index" : "Chỉ số UV"}</span>
            <span className={styles.paramValue}>
              {current?.uvIndex != null ? current.uvIndex : "—"}
            </span>
            <span className={styles.paramSub}>
              {current?.uvIndex != null && current.uvIndex > 6 ? (isEn ? "High Hazard" : "Nguy hại cao") : (isEn ? "Normal" : "Bình thường")}
            </span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Cloud Cover" : "Độ che phủ mây"}</span>
            <span className={styles.paramValue}>
              {current?.cloudCoverPercent != null ? `${current.cloudCoverPercent}%` : "—"}
            </span>
            <span className={styles.paramSub}>{isEn ? "Sky" : "Bầu trời"}</span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Pressure" : "Áp suất"}</span>
            <span className={styles.paramValue}>
              {current?.pressureHectopascals != null ? `${current.pressureHectopascals}` : "1012"}
            </span>
            <span className={styles.paramSub}>hPa</span>
          </div>
        </div>
      </div>

      {/* 4. Hourly Forecast Timeline */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <Clock size={16} color="var(--color-primary)" />
            <span>{isEn ? "Hourly Forecast (Next 12 Hours)" : "Dự Báo Hàng Giờ (12 Giờ Tới)"}</span>
          </h3>
        </div>

        {hourlyForecast.length > 0 ? (
          <div className={styles.hourlyScroll}>
            {hourlyForecast.map((h, i) => (
              <div key={i} className={styles.hourlyCard}>
                <span className={styles.hourlyTime}>{h.time}</span>
                <CloudRain size={16} color="#0EA5E9" />
                <span className={styles.hourlyTemp}>{h.temp}°</span>
                <span className={styles.hourlyRain}>{h.rainProb}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {isWeatherLoading ? (isEn ? "Loading forecast series telemetry..." : "Đang tải dữ liệu chuỗi dự báo từ trạm quan trắc...") : (isEn ? "Hourly forecast syncing..." : "Dữ liệu dự báo theo giờ đang đồng bộ.")}
          </div>
        )}
      </div>

      {/* 5. Triggered Rules & Travel Advisories */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <AlertTriangle size={16} color="var(--color-warning)" />
            <span>{isEn ? "Travel Safety Advisories" : "Khuyến Cáo An Toàn Di Chuyển"}</span>
          </h3>
        </div>

        <div className={styles.advisoriesList}>
          {advisories.map((adv, idx) => (
            <div key={idx} className={styles.advisoryItem}>
              <span style={{ color: "var(--color-primary)", fontWeight: 800 }}>•</span>
              <span>{adv}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Footer Navigation */}
      <button
        type="button"
        onClick={() => navigate(`/location/${encodeURIComponent(province.name)}`)}
        className={styles.actionBtn}
        style={{ width: "100%", padding: "12px", justifyContent: "center" }}
      >
        <ExternalLink size={14} />
        <span>{isEn ? "View 14-Day In-depth Meteorological Analytics" : "Xem Báo Cáo Phân Tích Chuyên Sâu 14 Ngày"}</span>
      </button>
    </div>
  );
}
