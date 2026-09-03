/**
 * Phase 9 Location Detail Page
 * Comprehensive weather analysis, hourly forecast, 6-dimensional risk, and travel advisories
 */

import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/hooks/useAuthStore";
import { PROVINCE_MAP } from "@/data/provinces";
import {
  WeatherIcon,
  WindIcon,
  RainIcon,
  RiskIcon,
} from "@/components/ui/Icons";
import styles from "./LocationPage.module.css";

export function LocationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, saveLocation, removeSavedLocation } = useAuthStore();

  const isPro = user?.plan === "pro";
  const [forecastTab, setForecastTab] = useState<"24h" | "72h" | "14d">("24h");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Match province from id or code
  const province = useMemo(() => {
    if (!id) return { name: "Hà Nội", region: "Đồng bằng sông Hồng", code: "HN" };

    const decoded = decodeURIComponent(id).toLowerCase();
    const entry = Object.entries(PROVINCE_MAP).find(
      ([key, p]) =>
        key.toLowerCase() === decoded ||
        p.name.toLowerCase() === decoded ||
        p.code.toLowerCase() === decoded
    );

    if (entry) {
      return {
        name: entry[1].name,
        region: entry[1].region,
        code: entry[1].code,
      };
    }

    return { name: decodeURIComponent(id), region: "Việt Nam", code: "VN" };
  }, [id]);

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
      showToast("⭐ Dự báo dài hạn 7 - 14 ngày là đặc quyền của gói PRO. Hãy nâng cấp ngay!");
      return;
    }
    setForecastTab(tab);
  };

  // Mock hourly data points
  const hourlyPoints = useMemo(() => {
    const hours = forecastTab === "24h" ? 24 : forecastTab === "72h" ? 72 : 24;
    return Array.from({ length: Math.min(hours, 24) }, (_, i) => {
      const hour = (new Date().getHours() + i) % 24;
      return {
        time: `${String(hour).padStart(2, "0")}:00`,
        temp: Math.round(26 + Math.sin(i * 0.4) * 5),
        rainProb: Math.round(15 + Math.cos(i * 0.3) * 25),
        condition: i % 4 === 0 ? "Mưa nhẹ" : i % 3 === 0 ? "Nhiều mây" : "Nắng ráo",
      };
    });
  }, [forecastTab]);

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
          <span>ℹ️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back Link */}
      <Link to="/map" className={styles.backBtn}>
        <span>← Quay lại Bản đồ thời tiết</span>
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
            <span>{isSaved ? "★ Đã lưu yêu thích" : "☆ Lưu địa điểm"}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/route?to=${encodeURIComponent(province.name)}`)}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          >
            <span>🚗 Lên lộ trình đến đây</span>
          </button>
        </div>
      </div>

      {/* Current Weather Card */}
      <div className={styles.currentCard}>
        <div className={styles.currentMain}>
          <div className={styles.tempRow}>
            <span className={styles.temperature}>29°C</span>
            <span className={styles.feelsLike}>Cảm giác như 32°C</span>
          </div>
          <div className={styles.conditionText}>Trời quang, nắng nhẹ</div>
          <div className={styles.updateTime}>
            Cập nhật theo dữ liệu nguồn WeatherAPI • 10 phút trước
          </div>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Độ ẩm không khí</span>
            <span className={styles.metricVal}>74%</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Tốc độ gió</span>
            <span className={styles.metricVal}>14 km/h</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Tầm nhìn xa</span>
            <span className={styles.metricVal}>10 km</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Xác suất mưa</span>
            <span className={styles.metricVal} style={{ color: "#38BDF8" }}>
              20%
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Chỉ số UV</span>
            <span className={styles.metricVal} style={{ color: "#F59E0B" }}>
              6.2 (Trung bình)
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Áp suất khí quyển</span>
            <span className={styles.metricVal}>1012 hPa</span>
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
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            Tổng thể: An toàn (Thấp)
          </span>
        </div>

        <div className={styles.riskGrid}>
          {/* Dimension 1: Rain */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <RainIcon size={18} /> 1. Mưa lớn & Ngập úng
              </span>
              <span className={styles.riskBadgeLow}>Thấp</span>
            </div>
            <div className={styles.riskProgressBar}>
              <div className={styles.riskProgressFill} style={{ width: "20%", background: "#10B981" }} />
            </div>
            <p className={styles.riskDesc}>Lượng mưa dự kiến &lt; 5mm trong 24h tới. Không có nguy cơ ngập cục bộ.</p>
          </div>

          {/* Dimension 2: Wind */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WindIcon size={18} /> 2. Gió giật & Áp thấp
              </span>
              <span className={styles.riskBadgeLow}>Thấp</span>
            </div>
            <div className={styles.riskProgressBar}>
              <div className={styles.riskProgressFill} style={{ width: "25%", background: "#10B981" }} />
            </div>
            <p className={styles.riskDesc}>Gió cấp 2 - 3, tốc độ 12-16 km/h. Thích hợp cho các phương tiện di chuyển.</p>
          </div>

          {/* Dimension 3: Visibility */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WeatherIcon size={18} /> 3. Tầm nhìn xa
              </span>
              <span className={styles.riskBadgeLow}>Tốt (&gt;10km)</span>
            </div>
            <div className={styles.riskProgressBar}>
              <div className={styles.riskProgressFill} style={{ width: "15%", background: "#10B981" }} />
            </div>
            <p className={styles.riskDesc}>Tầm nhìn thông thoáng, không có sương mù dày đặc hay khói bụi cản trở.</p>
          </div>

          {/* Dimension 4: Lightning */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <RiskIcon size={18} /> 4. Dông sét & Lốc xoáy
              </span>
              <span className={styles.riskBadgeLow}>An toàn</span>
            </div>
            <div className={styles.riskProgressBar}>
              <div className={styles.riskProgressFill} style={{ width: "10%", background: "#10B981" }} />
            </div>
            <p className={styles.riskDesc}>Chỉ số bất ổn định khí quyển thấp, không phát hiện dấu hiệu dông nhiệt.</p>
          </div>

          {/* Dimension 5: Extreme Temperature */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WeatherIcon size={18} /> 5. Cực đoan Nhiệt
              </span>
              <span className={styles.riskBadgeCaution}>Trung bình</span>
            </div>
            <div className={styles.riskProgressBar}>
              <div className={styles.riskProgressFill} style={{ width: "55%", background: "#F59E0B" }} />
            </div>
            <p className={styles.riskDesc}>Buổi trưa oi bức 32°C. Nên bổ sung nước và hạn chế hoạt động nặng giữa trưa.</p>
          </div>

          {/* Dimension 6: UV & Air Quality */}
          <div className={styles.riskItemCard}>
            <div className={styles.riskCardTop}>
              <span className={styles.riskCardTitle}>
                <WeatherIcon size={18} /> 6. Chỉ số UV & Khí quyển
              </span>
              <span className={styles.riskBadgeCaution}>UV 6.2</span>
            </div>
            <div className={styles.riskProgressBar}>
              <div className={styles.riskProgressFill} style={{ width: "62%", background: "#F59E0B" }} />
            </div>
            <p className={styles.riskDesc}>Khuyến nghị đeo kính râm, thoa kem chống nắng khi ra đường từ 11:00 đến 14:00.</p>
          </div>
        </div>
      </div>

      {/* Travel Advisories */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Khuyến cáo Du lịch & Di chuyển</h2>
        <div className={styles.advisoriesList}>
          <div className={styles.advisoryRow}>
            <span style={{ fontSize: "20px" }}>🏕️</span>
            <div>
              <div className={styles.advisoryRowTitle}>Hoạt động tham quan ngoài trời: Rất thuận lợi</div>
              <div className={styles.advisoryRowDesc}>
                Thời tiết khô ráo, nắng ấm lý tưởng cho việc chụp ảnh, dạo phố và trekking nhẹ buổi sáng.
              </div>
            </div>
          </div>

          <div className={styles.advisoryRow}>
            <span style={{ fontSize: "20px" }}>🏍️</span>
            <div>
              <div className={styles.advisoryRowTitle}>Lưu ý phương tiện hai bánh</div>
              <div className={styles.advisoryRowDesc}>
                Đường sá khô ráo, tuy nhiên cần chú ý gió tạt khi qua các cây cầu lớn và chuẩn bị áo khoác chống nắng.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
