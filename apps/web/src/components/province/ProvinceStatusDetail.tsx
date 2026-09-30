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
  Lock,
  LogIn,
} from "lucide-react";
import { ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { VIETNAM_REGIONS } from "@/data/provinces";
import { forecastHours, useProvinceWeather, weatherStateText } from "@/hooks/useProvinceWeather";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import { RiskEvidenceWarnings } from "@/components/common/RiskEvidenceWarnings";
import styles from "./ProvinceStatusDetail.module.css";
import { riskReasonText, weatherConditionText, generalRiskNote, formatEvidenceValue, rainEvidenceLabel, evidenceMissingText, formatMeasurement as measurement } from "@/utils/reportRisk";

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
  const { isAuthenticated } = useAuthStore();
  const { openModal } = useRequireLoginModal();

  // Query live weather with forecast for the selected province
  const weather = useProvinceWeather({
    latitude: province.latitude,
    longitude: province.longitude,
    includeForecast: isAuthenticated,
  });

  const { hourly: hourlyValues } = weather;
  const selectedTime = province.weatherTargetTime ? Date.parse(province.weatherTargetTime) : Date.now();

  const windGustKmh = measurement(province.windGustKmh);
  const tempVal = measurement(province.temp);
  const feelsLikeVal = measurement(province.feelsLike);
  const dimensionMeta = [
    { id: "rain", name: isEn ? "Rain (mm/h)" : "Mưa (mm/h)", icon: CloudRain },
    { id: "wind", name: isEn ? "Gust (km/h)" : "Gió giật (km/h)", icon: Wind },
    { id: "temperature", name: isEn ? "Temperature (°C)" : "Nhiệt độ (°C)", icon: Thermometer },
    { id: "visibility", name: isEn ? "Visibility (m)" : "Tầm nhìn (m)", icon: Eye },
    { id: "storm", name: isEn ? "Storm" : "Dông", icon: Zap },
    { id: "alert", name: isEn ? "Official alert" : "Cảnh báo chính thức", icon: Radio },
  ];
  const dimensions = dimensionMeta.map(meta => {
    const evidence = province.assessment?.evidence.find(e => e.dimension === meta.id);
    const severity = evidence?.severity ?? 0;
    const unclassifiedStorm = meta.id === "storm" && severity === 0 && province.conditionCode === "thunderstorm";
    return { ...meta,
      name: meta.id === "rain" ? rainEvidenceLabel(evidence, isEn) : meta.name,
      value: unclassifiedStorm ? weatherConditionText(province.conditionCode, isEn) : formatEvidenceValue(evidence, isEn),
      missingText: unclassifiedStorm ? (isEn ? "Storm type not available; the weather condition does not establish storm severity." : "Chưa có phân loại dông; trạng thái thời tiết không xác định mức độ dông.") : severity === 0 ? evidenceMissingText(meta.id, province.assessment, isEn) : null, color: ["#64748B", "#22C55E", "#EAB308", "#EF4444"][severity],
      status: (isEn ? ["Not assessed", "Low", "Caution", "High"] : ["Chưa đánh giá", "Thấp", "Chú ý", "Cao"])[severity] };
  });

  // Real hourly forecast points for the next 12 hours from backend
  const hourlyForecast = useMemo(() => {
    if (hourlyValues.length > 0) {
      return forecastHours(hourlyValues, 12, selectedTime).map(item => {
        const date = new Date(item.validInterval.from);
        return {
          time: date.toLocaleTimeString(isEn ? "en-US" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }),
          temp: item.temperatureCelsius != null ? Math.round(item.temperatureCelsius) : "—",
          rainProb: item.precipitationProbabilityPercent != null && Number.isFinite(item.precipitationProbabilityPercent) ? `${measurement(item.precipitationProbabilityPercent)}%` : "—",
        };
      });
    }
    return [];
  }, [hourlyValues, isEn, selectedTime]);

  const advisories = province.assessment?.reasons.map(reason => riskReasonText(reason, isEn)) ?? [];
  if (!advisories.length && !province.assessment?.evidence.some(item => item.severity >= 2)) {
    advisories.push(isEn ? "No travel advisory is available." : "Chưa có khuyến cáo di chuyển.");
  }

  const displayCondition = weatherConditionText(province.conditionCode, isEn);
  const displayRiskTier = isEn
    ? (province.riskLevel === "high" ? "HIGH RISK" : province.riskLevel === "caution" ? "CAUTION" : province.riskLevel === "low" ? "LOW" : "UNKNOWN")
    : province.riskLevel === "unknown" ? "CHƯA ĐỦ DỮ LIỆU" : province.riskText.toUpperCase();

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
              <span>{province.weatherTargetTime ? new Date(province.weatherTargetTime).toLocaleString(isEn ? "en-US" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</span>
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
            ) : province.riskLevel === "unknown" ? (
              <AlertTriangle size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
            <span className={styles.riskLevelText}>{isEn ? `TIER: ${displayRiskTier}` : `CẤP ĐỘ: ${displayRiskTier}`}</span>
          </div>
          <span className={styles.riskScoreSub}>
            {isEn ? "Risk Index:" : "Chỉ số rủi ro:"} <strong>{province.riskScore == null ? (isEn ? "Insufficient data" : "Chưa đủ dữ liệu") : `${province.riskScore}/100`}</strong> • {displayCondition}
          </span>
        </div>

        <div className={styles.confidenceBadge}>
          <span>{province.freshnessState}</span>
          <span style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>{isEn ? "General weather" : "Thời tiết tổng quát"}</span>
        </div>
      </div>

      {/* 2. 6-Dimensional Risk Evaluation (Phase 6 Engine) */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <ShieldCheck size={16} color="var(--color-primary)" />
            <span>{isEn ? "General Weather Risk" : "Rủi Ro Thời Tiết Tổng Quát"}</span>
          </h3>
          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>{isEn ? "General weather assessment" : "Đánh giá thời tiết tổng quát"}</span>
        </div>

        <p>{generalRiskNote(province.assessment, isEn)}</p>
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
                {dim.missingText && <p className={styles.paramSub}>{dim.missingText}</p>}
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
            <span>{isEn ? "Weather at Selected Time" : "Thời Tiết Tại Thời Điểm Đã Chọn"}</span>
          </h3>
          <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>weather-v1</span>
        </div>

        {province.dataState !== "ready" && <p role="status">{weatherStateText(province.dataState === "error" ? "error" : "loading", isEn)}</p>}
        <div className={styles.weatherGrid}>
          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Temperature" : "Nhiệt độ"}</span>
            <span className={styles.paramValue}>{`${tempVal}°C`}</span>
            <span className={styles.paramSub}>{isEn ? `Feels like ${feelsLikeVal}°C` : `Cảm giác ${feelsLikeVal}°C`}</span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Humidity" : "Độ ẩm"}</span>
            <span className={styles.paramValue}>
              {`${measurement(province.humidity)}%`}
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
              {measurement(province.uvIndex)}
            </span>
            <span className={styles.paramSub}>
              {!Number.isFinite(province.uvIndex) ? (isEn ? "Unavailable" : "Chưa có dữ liệu") : (isEn ? "UV index at selected time" : "Chỉ số UV tại thời điểm đã chọn")}
            </span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Cloud Cover" : "Độ che phủ mây"}</span>
            <span className={styles.paramValue}>
              {`${measurement(province.cloudCoverPercent)}%`}
            </span>
            <span className={styles.paramSub}>{isEn ? "Sky" : "Bầu trời"}</span>
          </div>

          <div className={styles.weatherParamBox}>
            <span className={styles.paramLabel}>{isEn ? "Pressure" : "Áp suất"}</span>
            <span className={styles.paramValue}>
              {measurement(province.pressureHpa)}
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

        {!isAuthenticated ? (
          <div
            className={styles.lockedHourlyBox}
            onClick={() =>
              openModal(
                isEn ? "Hourly Forecast (Next 12 Hours)" : "Dự báo hàng giờ (12 giờ tới)",
                isEn
                  ? "Guests can only view current real-time weather. Please sign in to view detailed hourly forecast trends."
                  : "Chế độ khách chỉ xem được thời tiết hiện tại. Vui lòng đăng nhập để xem chi tiết dự báo 12 giờ tới!"
              )
            }
          >
            <Lock size={18} style={{ margin: "0 auto 6px auto", color: "var(--color-primary, #0066cc)" }} />
            <div className={styles.lockedHourlyTitle}>
              {isEn ? "Hourly Forecast Locked for Guests" : "Dự báo 12 giờ tới yêu cầu đăng nhập"}
            </div>
            <div className={styles.lockedHourlySubtitle}>
              {isEn ? "Click here or sign in to view hourly temperatures and precipitation." : "Bấm vào đây hoặc Đăng nhập để mở khóa nhiệt độ và xác suất mưa theo giờ."}
            </div>
            <span className={styles.lockedHourlyBtn}>
              <LogIn size={13} />
              <span>{isEn ? "Sign In to View" : "Đăng nhập để xem"}</span>
            </span>
          </div>
        ) : hourlyForecast.length > 0 ? (
          <div className={styles.hourlyScroll}>
            {hourlyForecast.map((h, i) => (
              <div key={i} className={styles.hourlyCard}>
                <span className={styles.hourlyTime}>{h.time}</span>
                <CloudRain size={16} color="#0EA5E9" />
                <span className={styles.hourlyTemp}>{h.temp}°</span>
                <span className={styles.hourlyRain}>{h.rainProb}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            <p role="status">{weatherStateText(weather.hourlyState === "ready" ? "unavailable" : weather.hourlyState, isEn)}</p>
            <button type="button" disabled={weather.isFetching} onClick={() => void weather.refetch()}>{isEn ? "Retry" : "Thử lại"}</button>
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
          <RiskEvidenceWarnings evidence={province.assessment?.evidence} isEn={isEn} />
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
        <span>{isEn ? "View Weather Details & Available Forecasts" : "Xem Chi Tiết Thời Tiết & Dự Báo Hiện Có"}</span>
      </button>
    </div>
  );
}
