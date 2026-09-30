/**
 * Phase 9 Location Detail Page
 * Comprehensive weather analysis, hourly forecast, 6-dimensional risk, and travel advisories
 */

import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Bookmark, Navigation, Info, ArrowLeft, Lock, LogIn } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ReportPointResponse } from "@vietnam-weather/contracts";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/hooks/useAuthStore";
import { getProvincePropertiesByCode } from "@/data/vietnamGeoJsonWGS84";
import { forecastHours, useProvinceWeather, weatherStateText } from "@/hooks/useProvinceWeather";
import { reportRiskDisplay, riskReasonText, weatherConditionText } from "@/utils/reportRisk";
import {
  RainIcon,
} from "@/components/ui/Icons";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import { RiskEvidenceWarnings } from "@/components/common/RiskEvidenceWarnings";
import styles from "./LocationPage.module.css";

function getConditionVi(code: string | null | undefined): string {
  return weatherConditionText(code ?? "unknown");
}

export function LocationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, saveLocation, removeSavedLocation } = useAuthStore();
  const { openModal } = useRequireLoginModal();

  const [forecastTab, setForecastTab] = useState<"24h" | "72h">("24h");
  const [riskVehicle, setRiskVehicle] = useState<"car" | "motorcycle" | "">("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Match province from id or code, including centroid coordinates
  const province = useMemo(() => {
    return getProvincePropertiesByCode(id || "HN");
  }, [id]);

  // Real weather query with forecast
  const weather = useProvinceWeather({
    latitude: province?.latitude,
    longitude: province?.longitude,
    includeForecast: isAuthenticated,
  });

  const { current } = weather;
  const conditionVi = getConditionVi(current?.conditionCode);
  const riskQuery = useQuery({
    queryKey: ["location-report-risk", province?.id, riskVehicle],
    enabled: Boolean(province && riskVehicle),
    queryFn: () => {
      const query = new URLSearchParams({
        latitude: String(province!.latitude), longitude: String(province!.longitude),
        target_time: new Date().toISOString(), vehicle: riskVehicle,
      });
      return apiClient.get<{ data: ReportPointResponse }>(`/risk/report-point?${query}`);
    },
    staleTime: 120000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const assessment = riskVehicle && !riskQuery.isError ? riskQuery.data?.data.assessment : undefined;
  const riskDisplay = reportRiskDisplay(assessment);
  const dimensionLabels = { rain: "Mưa (mm/h)", wind: "Gió giật (km/h)", temperature: "Nhiệt độ (°C)", visibility: "Tầm nhìn (m)", storm: "Dông", alert: "Cảnh báo chính thức" };
  const severityLabels = ["Chưa đủ dữ liệu", "Thấp", "Chú ý", "Cao"];
  const severityColors = ["#64748B", "#22C55E", "#EAB308", "#EF4444"];

  const isSaved = user?.savedLocations?.some(
    (l) => l.name.toLowerCase() === province?.name.toLowerCase()
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleSave = () => {
    if (!province) return;
    if (!isAuthenticated) {
      openModal(
        "Lưu địa điểm yêu thích",
        "Vui lòng đăng nhập hoặc tạo tài khoản để lưu trữ các địa điểm yêu thích và theo dõi cập nhật thời tiết nhanh chóng!"
      );
      return;
    }
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

  const handleTabChange = (tab: "24h" | "72h") => {
    if (!isAuthenticated) {
      openModal(
        tab === "24h" ? "Dự báo 24 giờ tới" : "Dự báo 3 ngày (72h)",
        "Bạn đang xem thời tiết hiện tại ở chế độ khách. Vui lòng đăng nhập hoặc đăng ký tài khoản để mở khóa chuỗi dự báo theo giờ và các ngày tiếp theo!"
      );
      return;
    }
    setForecastTab(tab);
  };

  // Real hourly forecast points from backend
  const hourlyPoints = useMemo(() => {
    const hourlyValues = weather.hourly;
    if (hourlyValues && hourlyValues.length > 0) {
      return forecastHours(hourlyValues, forecastTab === "24h" ? 24 : 72).map(item => {
        const timeStr = new Date(item.validInterval.from).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return {
          time: timeStr,
          temp: item.temperatureCelsius != null ? Math.round(item.temperatureCelsius) : "—",
          rainProb: item.precipitationProbabilityPercent ?? "—",
          condition: getConditionVi(item.conditionCode),
        };
      });
    }
    return [];
  }, [weather.hourly, forecastTab]);

  if (!province) return <div className={styles.page}><p role="status">Không tìm thấy tỉnh thành. Chưa truy vấn thời tiết cho địa điểm này.</p><Link to="/map">Chọn địa điểm trên bản đồ</Link></div>;

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
            Khu vực: {province.regionVi} • Mã tỉnh: {province.code}
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
                : weather.isLoading
                ? "..."
                : "—"}
            </span>
            {current?.apparentTemperatureCelsius != null && (
              <span className={styles.feelsLike}>
                Cảm giác như {Math.round(current.apparentTemperatureCelsius)}°C
              </span>
            )}
          </div>
          <div className={styles.conditionText}>{conditionVi}</div>
          <div className={styles.updateTime}>
            {current?.observedAt ? `Thời điểm quan trắc: ${new Date(current.observedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : weatherStateText(weather.currentState)}
          </div>
          {(weather.currentState === "error" || weather.currentState === "unavailable") && <button type="button" disabled={weather.isFetching} onClick={() => void weather.refetch()}>Thử lại thời tiết</button>}
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
                : "—"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Chỉ số UV</span>
            <span
              className={styles.metricVal}
              style={{
                color: "var(--color-text-primary)",
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
          </div>
        </div>

        {!isAuthenticated ? (
          <div
            className={styles.lockedForecastBox}
            onClick={() =>
              openModal(
                "Dự báo theo giờ & Nhiều ngày",
                "Bạn đang xem thời tiết hiện tại ở chế độ khách. Vui lòng đăng nhập hoặc đăng ký tài khoản để mở khóa toàn bộ chuỗi dự báo theo giờ và xu hướng nhiều ngày tới!"
              )
            }
          >
            <div className={styles.lockedIconWrapper}>
              <Lock size={22} />
            </div>
            <h4 className={styles.lockedTitle}>
              Dự báo 24 giờ & Nhiều ngày tới yêu cầu đăng nhập
            </h4>
            <p className={styles.lockedSubtitle}>
              Khách chỉ xem được các thông số thời tiết hiện tại. Bấm vào đây hoặc Đăng nhập để mở khóa biểu đồ dự báo chi tiết nhiệt độ, gió và xác suất mưa theo giờ!
            </p>
            <span className={styles.lockedButton}>
              <LogIn size={15} />
              <span>Đăng nhập để xem dự báo theo giờ</span>
            </span>
          </div>
        ) : hourlyPoints.length > 0 ? (
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
            <p role="status">{weatherStateText(weather.hourlyState === "ready" ? "unavailable" : weather.hourlyState)}</p>
            <button type="button" disabled={weather.isFetching} onClick={() => void weather.refetch()}>Thử lại</button>
          </div>
        )}
      </div>

      {/* 6-Dimensional Risk Assessment Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Đánh giá Rủi ro Du lịch 6 Chiều</h2>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Đánh giá theo phương tiện và bằng chứng Bảng 3.1
            </span>
          </div>
          <span
            style={{
              padding: "4px 12px",
              color: riskDisplay.riskColor,
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {!riskVehicle ? "Chưa chọn phương tiện" : riskQuery.isLoading ? "Đang tải đánh giá…" : riskQuery.isError ? "Không tải được đánh giá" : riskDisplay.riskText}
          </span>
        </div>

        <label>Phương tiện đánh giá rủi ro: <select value={riskVehicle} onChange={event => setRiskVehicle(event.target.value as typeof riskVehicle)}>
          <option value="">Chọn phương tiện</option>
          <option value="car">Ô tô</option>
          <option value="motorcycle">Xe máy</option>
        </select></label>
        {assessment ? <>
          <p>Chỉ số rủi ro: {riskDisplay.riskScore == null ? "Chưa đủ dữ liệu" : `${riskDisplay.riskScore}/100`}</p>
          <div className={styles.riskGrid}>
            {assessment.evidence.map(evidence => (
              <div key={evidence.dimension} className={styles.riskItemCard}>
                <div className={styles.riskCardTop}>
                  <span className={styles.riskCardTitle}>{dimensionLabels[evidence.dimension]}</span>
                  <span style={{ color: severityColors[evidence.severity] }}>{severityLabels[evidence.severity]}</span>
                </div>
                <p className={styles.riskDesc}>{evidence.value ?? "Chưa có bằng chứng"}</p>
              </div>
            ))}
          </div>
        </> : <p role="status">{!riskVehicle ? "Chọn ô tô hoặc xe máy để xem đánh giá thực tế." : riskQuery.isLoading ? "Đang tải đánh giá theo phương tiện…" : "Chưa có đánh giá cho địa điểm này."}</p>}
        {riskVehicle && riskQuery.isError && <button type="button" disabled={riskQuery.isFetching} onClick={() => void riskQuery.refetch()}>Thử lại đánh giá</button>}
      </div>

      {/* Travel Advisories */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Khuyến cáo Du lịch & Di chuyển</h2>
        <div className={styles.advisoriesList}>
          <RiskEvidenceWarnings evidence={assessment?.evidence} />
          {assessment?.reasons.map(reason => <p key={reason} className={styles.advisoryRow}>{riskReasonText(reason)}</p>)}
          {!assessment && <p>Chưa có bằng chứng đánh giá theo phương tiện cho địa điểm này.</p>}
          {assessment && assessment.reasons.length === 0 && !assessment.evidence.some(e => e.severity >= 2) && <p>Chưa có khuyến cáo di chuyển từ đánh giá này.</p>}
        </div>
      </div>
    </div>
  );
}
