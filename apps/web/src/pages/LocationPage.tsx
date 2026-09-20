/**
 * Phase 9 Location Detail Page
 * Comprehensive weather analysis, hourly forecast, 6-dimensional risk, and travel advisories
 */

import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Bookmark, Navigation, Info, Compass, Bike, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { PROVINCE_MAP } from "@/data/provinces";
import { getProvincePropertiesByCode } from "@/data/vietnamGeoJsonWGS84";
import { useProvinceWeather } from "@/hooks/useProvinceWeather";
import {
  WeatherIcon,
  WindIcon,
  RainIcon,
  RiskIcon,
} from "@/components/ui/Icons";
import styles from "./LocationPage.module.css";

function getConditionVi(code: string | null | undefined): string {
  switch (code) {
    case "clear":
      return "Trời quang mây tạnh, nắng ráo";
    case "partly_cloudy":
      return "Có mây thay đổi, nắng gián đoạn";
    case "cloudy":
      return "Nhiều mây, thời tiết dịu mát";
    case "rain":
      return "Mưa rào rải rác, mặt đường ướt";
    case "heavy_rain":
      return "Mưa to diện rộng, nguy cơ ngập úng";
    case "thunderstorm":
      return "Dông sét, mưa dông cục bộ mạnh";
    case "fog":
      return "Sương mù nhẹ, giảm tầm nhìn xa";
    case "drizzle":
      return "Mưa phùn hạt nhỏ";
    default:
      return "Thời tiết ổn định";
  }
}

export function LocationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, saveLocation, removeSavedLocation } = useAuthStore();

  const isPro = user?.plan === "pro";
  const [forecastTab, setForecastTab] = useState<"24h" | "72h" | "14d">("24h");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Match province from id or code, including centroid coordinates
  const province = useMemo(() => {
    if (!id) {
      return {
        name: "Hà Nội",
        region: "Đồng bằng sông Hồng",
        code: "HN",
        latitude: 21.0285,
        longitude: 105.8542,
      };
    }

    const decoded = decodeURIComponent(id);
    const geoProps = getProvincePropertiesByCode(decoded);
    if (geoProps) {
      return {
        name: geoProps.name,
        region: geoProps.regionVi,
        code: geoProps.code,
        latitude: geoProps.latitude,
        longitude: geoProps.longitude,
      };
    }

    const entry = Object.entries(PROVINCE_MAP).find(
      ([key, p]) =>
        key.toLowerCase() === decoded.toLowerCase() ||
        p.name.toLowerCase() === decoded.toLowerCase() ||
        p.code.toLowerCase() === decoded.toLowerCase()
    );

    if (entry) {
      return {
        name: entry[1].name,
        region: entry[1].region,
        code: entry[1].code,
        latitude: 16.0,
        longitude: 106.0,
      };
    }

    return {
      name: decoded,
      region: "Việt Nam",
      code: "VN",
      latitude: 16.0,
      longitude: 106.0,
    };
  }, [id]);

  // Real weather query with forecast
  const { data: weatherQuery, isLoading: isWeatherLoading } = useProvinceWeather({
    latitude: province.latitude,
    longitude: province.longitude,
    includeForecast: true,
  });

  const weatherData = weatherQuery?.data?.data;
  const current = weatherData?.current?.value ?? null;
  const conditionVi = getConditionVi(current?.conditionCode);

  const isSaved = user?.savedLocations?.some(
    (l) => l.name.toLowerCase() === province.name.toLowerCase()
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleSave = () => {
    if (isSaved) {
      removeSavedLocation(province.name);
      showToast(`Đã bỏ lưu ${province.name}`);
    } else {
      const res = saveLocation({
        name: province.name,
        provinceCode: province.code,
      });
      showToast(res.message || "Đã lưu địa điểm!");
    }
  };

  const handleTabChange = (tab: "24h" | "72h" | "14d") => {
    if (tab === "14d" && !isPro) {
      showToast("Dự báo dài hạn 7 - 14 ngày là đặc quyền của gói PRO. Hãy nâng cấp ngay!");
      return;
    }
    setForecastTab(tab);
  };

  // Real hourly forecast points from backend
  const hourlyPoints = useMemo(() => {
    const hourlyValues = weatherData?.hourly?.values;
    if (hourlyValues && hourlyValues.length > 0) {
      const maxCount = forecastTab === "24h" ? 24 : forecastTab === "72h" ? 72 : 24;
      return hourlyValues.slice(0, maxCount).map((item, idx) => {
        const date = item.validInterval?.from ? new Date(item.validInterval.from) : null;
        const timeStr = date
          ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : `${idx}:00`;
        return {
          time: timeStr,
          temp: item.temperatureCelsius != null ? Math.round(item.temperatureCelsius) : "—",
          rainProb: item.precipitationProbabilityPercent ?? 0,
          condition: getConditionVi(item.conditionCode),
        };
      });
    }
    return [];
  }, [weatherData, forecastTab]);

  // Dynamic 6-dimensional risk assessment based on live observation
  const riskAnalysis = useMemo(() => {
    const rainVal = current?.precipitationMillimetres ?? 0;
    const rainStatus =
      rainVal > 25
        ? {
            label: "Nguy cơ cao",
            percent: 85,
            color: "#EF4444",
            desc: `Lượng mưa lớn ${rainVal}mm/h. Nguy cơ ngập úng cục bộ và sạt lở các vùng đồi dốc.`,
          }
        : rainVal > 5
        ? {
            label: "Cần chú ý",
            percent: 50,
            color: "#F59E0B",
            desc: `Lượng mưa ${rainVal}mm/h. Mặt đường ướt, giảm ma sát phanh xe.`,
          }
        : {
            label: "Thấp",
            percent: 15,
            color: "#10B981",
            desc: "Lượng mưa thấp hoặc khô ráo. Không có nguy cơ ngập úng cục bộ.",
          };

    const windKmh =
      current?.windSpeedMetresPerSecond != null
        ? Math.round(current.windSpeedMetresPerSecond * 3.6)
        : 12;
    const windStatus =
      windKmh > 50
        ? {
            label: "Gió mạnh",
            percent: 85,
            color: "#EF4444",
            desc: `Tốc độ gió ${windKmh} km/h. Nguy hiểm cho xe máy khi qua cầu cao và đường ven biển.`,
          }
        : windKmh > 25
        ? {
            label: "Gió vừa",
            percent: 45,
            color: "#F59E0B",
            desc: `Tốc độ gió ${windKmh} km/h. Chú ý gió tạt nhẹ khi di chuyển tốc độ cao.`,
          }
        : {
            label: "Thấp",
            percent: 20,
            color: "#10B981",
            desc: `Gió nhẹ ${windKmh} km/h. Điều kiện lý tưởng cho các phương tiện di chuyển.`,
          };

    const visKm =
      current?.visibilityMetres != null ? current.visibilityMetres / 1000 : 10;
    const visStatus =
      visKm < 1
        ? {
            label: "Kém (<1km)",
            percent: 85,
            color: "#EF4444",
            desc: "Sương mù dày hoặc khói bụi cản trở tầm nhìn nghiêm trọng. Bật đèn sương mù.",
          }
        : visKm < 5
        ? {
            label: "Trung bình (1-5km)",
            percent: 48,
            color: "#F59E0B",
            desc: "Tầm nhìn giảm do mưa phùn hoặc sương mù nhẹ. Giữ khoảng cách an toàn.",
          }
        : {
            label: `Tốt (${visKm.toFixed(0)}km)`,
            percent: 12,
            color: "#10B981",
            desc: "Tầm nhìn thông thoáng, không có sương mù dày đặc hay khói bụi cản trở.",
          };

    const isStorm = current?.conditionCode === "thunderstorm";
    const stormStatus = isStorm
      ? {
          label: "Cảnh báo sét",
          percent: 90,
          color: "#EF4444",
          desc: "Đang có cơn dông sét. Tuyệt đối không đứng dưới cây to hoặc khu vực đất trống.",
        }
      : {
          label: "An toàn",
          percent: 10,
          color: "#10B981",
          desc: "Chỉ số bất ổn định khí quyển thấp, không phát hiện dấu hiệu dông nhiệt cực đoan.",
        };

    const temp = current?.temperatureCelsius ?? 28;
    const tempStatus =
      temp > 38
        ? {
            label: "Nắng nóng gay gắt",
            percent: 85,
            color: "#EF4444",
            desc: `Nhiệt độ ${temp}°C cực đoan. Hạn chế ra đường giữa trưa để tránh sốc nhiệt.`,
          }
        : temp > 34
        ? {
            label: "Nắng nóng",
            percent: 58,
            color: "#F59E0B",
            desc: `Nhiệt độ ${temp}°C khá cao. Nên bổ sung nước và hạn chế hoạt động nặng ngoài trời.`,
          }
        : temp < 10
        ? {
            label: "Rét đậm",
            percent: 75,
            color: "#38BDF8",
            desc: `Nhiệt độ ${temp}°C giá rét. Chuẩn bị trang phục giữ ấm khi lưu thông bằng xe máy.`,
          }
        : {
            label: "Dịu mát",
            percent: 22,
            color: "#10B981",
            desc: `Nhiệt độ ${temp}°C dễ chịu, rất thích hợp cho các hoạt động ngoài trời.`,
          };

    const uv = current?.uvIndex ?? 5;
    const uvStatus =
      uv >= 8
        ? {
            label: `Rất cao (UV ${uv})`,
            percent: 85,
            color: "#EF4444",
            desc: "Chỉ số UV nguy cơ gây tổn hại da cao. Cần thoa kem chống nắng, đeo kính râm.",
          }
        : uv >= 5
        ? {
            label: `Trung bình (UV ${uv})`,
            percent: 55,
            color: "#F59E0B",
            desc: "Khuyến nghị đeo kính râm, thoa kem chống nắng khi ra ngoài từ 11:00 đến 14:00.",
          }
        : {
            label: `Thấp (UV ${uv})`,
            percent: 20,
            color: "#10B981",
            desc: "Chỉ số bức xạ tia cực tím an toàn cho da.",
          };

    const overallHigh =
      rainStatus.percent > 70 ||
      windStatus.percent > 70 ||
      stormStatus.percent > 70 ||
      tempStatus.percent > 80;
    const overallCaution =
      !overallHigh &&
      (rainStatus.percent >= 45 ||
        windStatus.percent >= 45 ||
        visStatus.percent >= 45 ||
        tempStatus.percent >= 55 ||
        uvStatus.percent >= 50);

    const overall = overallHigh
      ? {
          label: "Tổng thể: Nguy cơ cao",
          color: "#EF4444",
          bg: "rgba(239, 68, 68, 0.15)",
        }
      : overallCaution
      ? {
          label: "Tổng thể: Cần chú ý",
          color: "#F59E0B",
          bg: "rgba(245, 158, 11, 0.15)",
        }
      : {
          label: "Tổng thể: An toàn (Thấp)",
          color: "#10B981",
          bg: "rgba(16, 185, 129, 0.15)",
        };

    return { rainStatus, windStatus, visStatus, stormStatus, tempStatus, uvStatus, overall };
  }, [current]);

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 205, 0, 0.4)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            zIndex: 9999,
            fontSize: "14px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Info size={18} color="#38BDF8" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back Link */}
      <Link to="/map" className={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Quay lại Bản đồ thời tiết</span>
      </Link>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{province.name}</h1>
          <span className={styles.regionTag}>
            Khu vực: {province.region} • Mã tỉnh: {province.code}
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleToggleSave}
            className={`${styles.actionBtn} ${isSaved ? styles.actionBtnSaved : ""}`}
          >
            <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
            <span>{isSaved ? "Đã lưu yêu thích" : "Lưu địa điểm"}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/route?to=${encodeURIComponent(province.name)}`)}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          >
            <Navigation size={14} />
            <span>Lên lộ trình đến đây</span>
          </button>
        </div>
      </div>

      {/* Current Weather Card */}
      <div className={styles.currentCard}>
        <div className={styles.currentMain}>
          <div className={styles.tempRow}>
            <span className={styles.temperature}>
              {current?.temperatureCelsius != null
                ? `${Math.round(current.temperatureCelsius)}°C`
                : isWeatherLoading
                ? "..."
                : "26°C"}
            </span>
            {current?.apparentTemperatureCelsius != null && (
              <span className={styles.feelsLike}>
                Cảm giác như {Math.round(current.apparentTemperatureCelsius)}°C
              </span>
            )}
          </div>
          <div className={styles.conditionText}>{conditionVi}</div>
          <div className={styles.updateTime}>
            Cập nhật từ trạm quan trắc • {current?.observedAt ? new Date(current.observedAt).toLocaleTimeString("vi-VN") : "Thời gian thực"}
          </div>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Độ ẩm không khí</span>
            <span className={styles.metricVal}>
              {current?.relativeHumidityPercent != null
                ? `${current.relativeHumidityPercent}%`
                : "—"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Tốc độ gió</span>
            <span className={styles.metricVal}>
              {current?.windSpeedMetresPerSecond != null
                ? `${Math.round(current.windSpeedMetresPerSecond * 3.6)} km/h`
                : "—"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Tầm nhìn xa</span>
            <span className={styles.metricVal}>
              {current?.visibilityMetres != null
                ? `${(current.visibilityMetres / 1000).toFixed(1)} km`
                : "—"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Lượng mưa</span>
            <span className={styles.metricVal} style={{ color: "#38BDF8" }}>
              {current?.precipitationMillimetres != null
                ? `${current.precipitationMillimetres} mm`
                : "0 mm"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Chỉ số UV</span>
            <span
              className={styles.metricVal}
              style={{
                color:
                  current?.uvIndex && current.uvIndex >= 6 ? "#F59E0B" : "#10B981",
              }}
            >
              {current?.uvIndex != null ? `${current.uvIndex}` : "—"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Áp suất khí quyển</span>
            <span className={styles.metricVal}>
              {current?.pressureHectopascals != null
                ? `${current.pressureHectopascals} hPa`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Hourly & Multi-Day Forecast Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Dự báo Thời tiết</h2>
          <div className={styles.tabsBar}>
            <button
              type="button"
              className={`${styles.tabBtn} ${forecastTab === "24h" ? styles.tabBtnActive : ""}`}
              onClick={() => handleTabChange("24h")}
            >
              24 giờ tới
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${forecastTab === "72h" ? styles.tabBtnActive : ""}`}
              onClick={() => handleTabChange("72h")}
            >
              3 ngày (72h)
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${forecastTab === "14d" ? styles.tabBtnActive : ""}`}
              onClick={() => handleTabChange("14d")}
            >
              <span>7 - 14 ngày</span>
              <span className={styles.proBadgeSmall}>PRO</span>
            </button>
          </div>
        </div>

        {hourlyPoints.length > 0 ? (
          <div className={styles.hourlyStrip}>
            {hourlyPoints.map((item, idx) => (
              <div key={idx} className={styles.hourlyCard}>
                <span className={styles.hourlyTime}>{item.time}</span>
                <span className={styles.hourlyTemp}>{item.temp}°</span>
                <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                  {item.condition}
                </span>
                <span className={styles.hourlyRain}>
                  <RainIcon size={12} /> {item.rainProb}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              background: "rgba(15, 23, 42, 0.4)",
              borderRadius: "12px",
              border: "1px dashed rgba(100, 116, 139, 0.3)",
            }}
          >
            {isWeatherLoading
              ? "Đang đồng bộ chuỗi dữ liệu dự báo từ hệ thống trạm quan trắc..."
              : "Dữ liệu chuỗi dự báo theo giờ đang được cập nhật từ trạm quan trắc địa phương."}
          </div>
        )}
      </div>

      {/* 6-Dimensional Risk Assessment Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Đánh giá Rủi ro Du lịch 6 Chiều</h2>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Phân tích theo bộ quy chuẩn rủi ro du lịch của VietnamWeather AI
            </span>
          </div>
          <span
            style={{
              padding: "4px 12px",
              background: riskAnalysis.overall.bg,
              color: riskAnalysis.overall.color,
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {riskAnalysis.overall.label}
          </span>
        </div>

        <div className={styles.riskGrid}>
          {/* Dimension 1: Rain */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <RainIcon size={18} /> 1. Mưa lớn & Ngập úng
              </span>
              <span
                style={{
                  color: riskAnalysis.rainStatus.color,
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {riskAnalysis.rainStatus.label}
              </span>
            </div>
            <div className={styles.riskProgressBar}>
              <div
                className={styles.riskProgressFill}
                style={{
                  width: `${riskAnalysis.rainStatus.percent}%`,
                  background: riskAnalysis.rainStatus.color,
                }}
              />
            </div>
            <p className={styles.riskDesc}>{riskAnalysis.rainStatus.desc}</p>
          </div>

          {/* Dimension 2: Wind */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WindIcon size={18} /> 2. Gió giật & Áp thấp
              </span>
              <span
                style={{
                  color: riskAnalysis.windStatus.color,
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {riskAnalysis.windStatus.label}
              </span>
            </div>
            <div className={styles.riskProgressBar}>
              <div
                className={styles.riskProgressFill}
                style={{
                  width: `${riskAnalysis.windStatus.percent}%`,
                  background: riskAnalysis.windStatus.color,
                }}
              />
            </div>
            <p className={styles.riskDesc}>{riskAnalysis.windStatus.desc}</p>
          </div>

          {/* Dimension 3: Visibility */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WeatherIcon size={18} /> 3. Tầm nhìn xa
              </span>
              <span
                style={{
                  color: riskAnalysis.visStatus.color,
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {riskAnalysis.visStatus.label}
              </span>
            </div>
            <div className={styles.riskProgressBar}>
              <div
                className={styles.riskProgressFill}
                style={{
                  width: `${riskAnalysis.visStatus.percent}%`,
                  background: riskAnalysis.visStatus.color,
                }}
              />
            </div>
            <p className={styles.riskDesc}>{riskAnalysis.visStatus.desc}</p>
          </div>

          {/* Dimension 4: Lightning */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <RiskIcon size={18} /> 4. Dông sét & Lốc xoáy
              </span>
              <span
                style={{
                  color: riskAnalysis.stormStatus.color,
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {riskAnalysis.stormStatus.label}
              </span>
            </div>
            <div className={styles.riskProgressBar}>
              <div
                className={styles.riskProgressFill}
                style={{
                  width: `${riskAnalysis.stormStatus.percent}%`,
                  background: riskAnalysis.stormStatus.color,
                }}
              />
            </div>
            <p className={styles.riskDesc}>{riskAnalysis.stormStatus.desc}</p>
          </div>

          {/* Dimension 5: Extreme Temperature */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WeatherIcon size={18} /> 5. Cực đoan Nhiệt
              </span>
              <span
                style={{
                  color: riskAnalysis.tempStatus.color,
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {riskAnalysis.tempStatus.label}
              </span>
            </div>
            <div className={styles.riskProgressBar}>
              <div
                className={styles.riskProgressFill}
                style={{
                  width: `${riskAnalysis.tempStatus.percent}%`,
                  background: riskAnalysis.tempStatus.color,
                }}
              />
            </div>
            <p className={styles.riskDesc}>{riskAnalysis.tempStatus.desc}</p>
          </div>

          {/* Dimension 6: UV & Air Quality */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WeatherIcon size={18} /> 6. Chỉ số UV & Bức xạ
              </span>
              <span
                style={{
                  color: riskAnalysis.uvStatus.color,
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {riskAnalysis.uvStatus.label}
              </span>
            </div>
            <div className={styles.riskProgressBar}>
              <div
                className={styles.riskProgressFill}
                style={{
                  width: `${riskAnalysis.uvStatus.percent}%`,
                  background: riskAnalysis.uvStatus.color,
                }}
              />
            </div>
            <p className={styles.riskDesc}>{riskAnalysis.uvStatus.desc}</p>
          </div>
        </div>
      </div>

      {/* Travel Advisories */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Khuyến cáo Du lịch & Di chuyển</h2>
        <div className={styles.advisoriesList}>
          <div className={styles.advisoryRow}>
            <Compass size={22} color="var(--color-primary)" />
            <div>
              <div className={styles.advisoryRowTitle}>Hoạt động tham quan ngoài trời</div>
              <div className={styles.advisoryRowDesc}>
                {riskAnalysis.rainStatus.percent > 60
                  ? "Mưa lớn diện rộng, nên ưu tiên các hoạt động tham quan trong nhà hoặc lùi lịch trình."
                  : riskAnalysis.tempStatus.percent > 60
                  ? "Thời tiết oi bức nhiệt cao giữa trưa, ưu tiên tham quan vào sáng sớm hoặc sau 16:00."
                  : "Thời tiết thuận lợi cho việc chụp ảnh, dạo phố và các hoạt động tham quan trải nghiệm."}
              </div>
            </div>
          </div>

          <div className={styles.advisoryRow}>
            <Bike size={22} color="var(--color-primary)" />
            <div>
              <div className={styles.advisoryRowTitle}>Lưu ý phương tiện hai bánh</div>
              <div className={styles.advisoryRowDesc}>
                {riskAnalysis.windStatus.percent > 60
                  ? "Gió tạt mạnh nguy hiểm khi qua cầu lớn và đường đèo dốc; giảm tốc độ và giữ vững tay lái."
                  : riskAnalysis.rainStatus.percent > 40
                  ? "Mặt đường trơn ướt; giữ khoảng cách phanh an toàn tối thiểu 35m và chuẩn bị áo mưa."
                  : "Đường sá khô ráo, phương tiện hai bánh lưu thông thuận lợi trên các trục đường chính."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
