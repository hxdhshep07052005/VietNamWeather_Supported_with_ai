/**
 * Phase 8/9 Route Planner Page
 * Weather-aware multi-alternative route planning with Free & Pro tier differentiation
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/hooks/useAuthStore";
import { PROVINCE_MAP } from "@/data/provinces";
import {
  CarIcon,
  MotorcycleIcon,
  WindIcon,
  RainIcon,
  RiskIcon,
} from "@/components/ui/Icons";
import styles from "./RoutePlannerPage.module.css";

interface RouteCheckpoint {
  name: string;
  distanceKm: number;
  eta: string;
  temp: number;
  condition: string;
  rainProb: number;
  windKmh: number;
  risk: "low" | "caution" | "high";
  note?: string;
}

interface RouteAlternative {
  id: string;
  type: "fastest" | "weather_safer" | "shortest";
  titleVi: string;
  titleEn: string;
  distanceKm: number;
  durationMinutes: number;
  riskScore: number;
  riskLevel: "low" | "caution" | "high";
  rainExposureKm: number;
  weatherSummaryVi: string;
  weatherSummaryEn: string;
  checkpoints: RouteCheckpoint[];
  isProOnly: boolean;
}

// 63 Provinces flattened for quick selection
const PROVINCES_LIST = Object.entries(PROVINCE_MAP).map(([id, p]) => ({
  id,
  name: p.name,
  code: p.code,
  region: p.region,
}));

export function RoutePlannerPage() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user, saveRoute, incrementRouteCount } = useAuthStore();

  const isPro = user?.plan === "pro";
  const dailyQuotaMax = isPro ? 30 : 3;
  const remainingQuota = Math.max(0, dailyQuotaMax - (user?.dailyRouteCount || 0));

  // Form State
  const [origin, setOrigin] = useState("Hà Nội");
  const [destination, setDestination] = useState("Lào Cai");
  const [vehicle, setVehicle] = useState<"car" | "motorcycle">("car");
  const [departureTime, setDepartureTime] = useState("now");
  const [isPlanning, setIsPlanning] = useState(false);
  const [hasPlanned, setHasPlanned] = useState(false);
  const [selectedAltId, setSelectedAltId] = useState("alt-safer");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Read URL query param ?to=
  useEffect(() => {
    const toParam = searchParams.get("to");
    if (toParam) {
      // Find matching province
      const matched = PROVINCES_LIST.find(
        (p) => p.name.toLowerCase() === toParam.toLowerCase() || p.code.toLowerCase() === toParam.toLowerCase()
      );
      if (matched) {
        setDestination(matched.name);
      } else {
        setDestination(toParam);
      }
    }
  }, [searchParams]);

  // Show temporary toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Handle GPS location
  const handleUseCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setOrigin("Vị trí GPS của bạn");
          showToast("Đã lấy tọa độ GPS vị trí hiện tại thành công!");
        },
        () => {
          showToast("Không thể truy cập GPS. Vui lòng chọn địa điểm từ danh sách.");
        }
      );
    }
  };

  // Swap Origin and Destination
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Select Quick Preset
  const handleSelectPreset = (from: string, to: string) => {
    setOrigin(from);
    setDestination(to);
  };

  // Handle Vehicle selection (Free vs Pro)
  const handleSelectVehicle = (selected: "car" | "motorcycle") => {
    if (selected === "motorcycle" && !isPro) {
      showToast("⭐ Tính năng đánh giá rủi ro gió tạt & trơn trượt riêng cho Xe máy chỉ dành cho gói PRO!");
      return;
    }
    setVehicle(selected);
  };

  // Generate mock realistic route alternatives based on inputs
  const alternatives: RouteAlternative[] = useMemo(() => {
    const baseDist = origin === destination ? 35 : 295;

    return [
      {
        id: "alt-safer",
        type: "weather_safer",
        titleVi: "An toàn Thời tiết nhất",
        titleEn: "Weather-Safer",
        distanceKm: Math.round(baseDist * 1.05),
        durationMinutes: 245,
        riskScore: 14,
        riskLevel: "low",
        rainExposureKm: 8,
        weatherSummaryVi: "Tránh giông lốc đèo dốc, mặt đường khô ráo 92% chặng đi",
        weatherSummaryEn: "Avoids severe mountain storms, 92% dry road condition",
        isProOnly: false, // Recommended option
        checkpoints: [
          { name: `${origin} (Xuất phát)`, distanceKm: 0, eta: "08:00", temp: 29, condition: "Nắng ráo", rainProb: 10, windKmh: 12, risk: "low" },
          { name: "Trạm Dừng Vĩnh Phúc", distanceKm: Math.round(baseDist * 0.25), eta: "09:00", temp: 28, condition: "Mây rải rác", rainProb: 15, windKmh: 14, risk: "low" },
          { name: "Phú Thọ (Cao tốc CT05)", distanceKm: Math.round(baseDist * 0.5), eta: "10:15", temp: 27, condition: "Trời quang", rainProb: 20, windKmh: 15, risk: "low" },
          { name: "Yên Bái (Trạm Km 117)", distanceKm: Math.round(baseDist * 0.75), eta: "11:25", temp: 25, condition: "Mưa phùn nhẹ", rainProb: 35, windKmh: 18, risk: "caution", note: "Mưa phùn nhẹ, giữ khoảng cách an toàn" },
          { name: `${destination} (Điểm đến)`, distanceKm: Math.round(baseDist * 1.05), eta: "12:05", temp: 21, condition: "Mát mẻ, khô ráo", rainProb: 20, windKmh: 10, risk: "low" },
        ],
      },
      {
        id: "alt-fastest",
        type: "fastest",
        titleVi: "Nhanh nhất (Cao tốc)",
        titleEn: "Fastest (Highway)",
        distanceKm: baseDist,
        durationMinutes: 220,
        riskScore: 48,
        riskLevel: "caution",
        rainExposureKm: 52,
        weatherSummaryVi: "Đi qua khu vực mưa rào lớn và gió giật 40km/h lúc 10:45",
        weatherSummaryEn: "Passes through heavy rain and 40km/h gusts at 10:45",
        isProOnly: false,
        checkpoints: [
          { name: `${origin} (Xuất phát)`, distanceKm: 0, eta: "08:00", temp: 29, condition: "Nắng ráo", rainProb: 10, windKmh: 12, risk: "low" },
          { name: "Cao tốc Chặng 1", distanceKm: Math.round(baseDist * 0.3), eta: "09:10", temp: 28, condition: "Mây giông kéo đến", rainProb: 45, windKmh: 24, risk: "caution" },
          { name: "Khu vực Đèo Dốc Trũng", distanceKm: Math.round(baseDist * 0.65), eta: "10:35", temp: 23, condition: "Mưa rào lớn, gió giật", rainProb: 80, windKmh: 42, risk: "high", note: "⚠️ Tầm nhìn < 300m, giảm tốc độ dưới 50km/h" },
          { name: `${destination} (Điểm đến)`, distanceKm: baseDist, eta: "11:40", temp: 22, condition: "Nhiều mây", rainProb: 30, windKmh: 14, risk: "low" },
        ],
      },
      {
        id: "alt-shortest",
        type: "shortest",
        titleVi: "Ngắn nhất (Quốc lộ)",
        titleEn: "Shortest (National Road)",
        distanceKm: Math.round(baseDist * 0.92),
        durationMinutes: 275,
        riskScore: 35,
        riskLevel: "caution",
        rainExposureKm: 28,
        weatherSummaryVi: "Đoạn đường đồi núi quanh co, có sương mù nhẹ tầm nhìn 800m",
        weatherSummaryEn: "Winding mountain terrain with light fog, 800m visibility",
        isProOnly: !isPro, // Pro only alternative
        checkpoints: [
          { name: `${origin} (Xuất phát)`, distanceKm: 0, eta: "08:00", temp: 29, condition: "Nắng ráo", rainProb: 10, windKmh: 12, risk: "low" },
          { name: "Đường tránh Quốc lộ", distanceKm: Math.round(baseDist * 0.45), eta: "09:55", temp: 26, condition: "Nắng nhẹ", rainProb: 20, windKmh: 12, risk: "low" },
          { name: "Đoạn dốc đồi núi", distanceKm: Math.round(baseDist * 0.7), eta: "11:20", temp: 22, condition: "Sương mù sườn đồi", rainProb: 30, windKmh: 18, risk: "caution", note: "Bật đèn sương mù, đường trơn" },
          { name: `${destination} (Điểm đến)`, distanceKm: Math.round(baseDist * 0.92), eta: "12:35", temp: 21, condition: "Mát mẻ", rainProb: 15, windKmh: 10, risk: "low" },
        ],
      },
    ];
  }, [origin, destination, i18n.language, isPro]);

  // Execute Route Planning
  const handlePlanRoute = () => {
    if (!origin.trim() || !destination.trim()) {
      showToast("Vui lòng nhập đầy đủ Điểm xuất phát và Điểm đến!");
      return;
    }

    // Check quota
    const quotaCheck = incrementRouteCount();
    if (!quotaCheck.allowed) {
      showToast(
        isPro
          ? "Bạn đã dùng hết 30 lượt tìm lộ trình hôm nay."
          : "Bạn đã dùng hết 3 lượt miễn phí hôm nay. Hãy nâng cấp Pro để có 30 lượt/ngày!"
      );
      return;
    }

    setIsPlanning(true);
    setTimeout(() => {
      setIsPlanning(false);
      setHasPlanned(true);
      // Default to safer for Pro, or fastest for Free if safer is considered pro
      setSelectedAltId(isPro ? "alt-safer" : "alt-fastest");
    }, 700);
  };

  // Selected Alternative Object
  const currentSelectedAlt = useMemo<RouteAlternative>(() => {
    return alternatives.find((a) => a.id === selectedAltId) ?? alternatives[0]!;
  }, [alternatives, selectedAltId]);

  // Save Route Action
  const handleSaveCurrentRoute = () => {
    const res = saveRoute({
      fromName: origin,
      toName: destination,
      vehicle,
      distanceKm: currentSelectedAlt.distanceKm,
      durationMinutes: currentSelectedAlt.durationMinutes,
    });
    showToast(res.message || "Đã lưu lộ trình!");
  };

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
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span>ℹ️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar with Tier Info */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>{t("route.title") || "Lập Lộ Trình An Toàn Thời Tiết"}</span>
          </h1>
          <p className={styles.subtitle}>
            {t("route.subtitle") ||
              "Phân tích thời tiết theo thời gian thực tại các mốc ETA dọc tuyến di chuyển trên khắp Việt Nam"}
          </p>
        </div>

        <div className={styles.headerMeta}>
          {isPro ? (
            <span className={styles.planBadgePro}>
              <span>👑</span>
              <span>GÓI PRO CAO CẤP</span>
            </span>
          ) : (
            <>
              <span className={styles.planBadgeFree}>GÓI MIỄN PHÍ</span>
              <Link to="/upgrade" className={styles.upgradeBtnSmall}>
                <span>⭐ Nâng cấp Pro</span>
              </Link>
            </>
          )}

          <span className={styles.quotaCounter}>
            Lượt hôm nay: <strong>{remainingQuota}</strong> / {dailyQuotaMax}
          </span>
        </div>
      </div>

      {/* Route Planner Form Card */}
      <div className={styles.plannerFormCard}>
        <div className={styles.routeInputsGrid}>
          {/* Origin */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>
              <span>{t("route.from") || "Điểm xuất phát"}</span>
              <button type="button" onClick={handleUseCurrentLocation} className={styles.gpsBtn}>
                <span>📍 Vị trí GPS của tôi</span>
              </button>
            </label>
            <div className={styles.inputBox}>
              <span style={{ color: "#0066CC", fontSize: "18px" }}>🟢</span>
              <input
                type="text"
                list="provinces-list"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Nhập tỉnh thành đi (ví dụ: Hà Nội)..."
                className={styles.inputField}
              />
            </div>
          </div>

          {/* Swap Button */}
          <button type="button" onClick={handleSwap} className={styles.swapBtn} title="Đổi chiều đi - về">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
            </svg>
          </button>

          {/* Destination */}
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>
              <span>{t("route.to") || "Điểm đến"}</span>
            </label>
            <div className={styles.inputBox}>
              <span style={{ color: "#EF4444", fontSize: "18px" }}>🔴</span>
              <input
                type="text"
                list="provinces-list"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Nhập tỉnh thành đến (ví dụ: Lào Cai)..."
                className={styles.inputField}
              />
            </div>
          </div>

          <datalist id="provinces-list">
            {PROVINCES_LIST.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>

        {/* Quick Presets */}
        <div className={styles.presetsRow}>
          <span className={styles.presetLabel}>Gợi ý chặng phổ biến:</span>
          <button
            type="button"
            className={styles.presetChip}
            onClick={() => handleSelectPreset("Hà Nội", "Lào Cai")}
          >
            Hà Nội ➔ Sa Pa (Lào Cai)
          </button>
          <button
            type="button"
            className={styles.presetChip}
            onClick={() => handleSelectPreset("Đà Nẵng", "Thừa Thiên Huế")}
          >
            Đà Nẵng ➔ Huế (Qua Đèo)
          </button>
          <button
            type="button"
            className={styles.presetChip}
            onClick={() => handleSelectPreset("Hồ Chí Minh", "Lâm Đồng")}
          >
            TP. Hồ Chí Minh ➔ Đà Lạt
          </button>
          <button
            type="button"
            className={styles.presetChip}
            onClick={() => handleSelectPreset("Hồ Chí Minh", "Bà Rịa - Vũng Tàu")}
          >
            TP. HCM ➔ Vũng Tàu
          </button>
        </div>

        {/* Vehicle & Options Bar */}
        <div className={styles.optionsBar}>
          <div className={styles.vehicleGroup}>
            <span className={styles.optionLabel}>Phương tiện:</span>
            <div className={styles.vehicleButtons}>
              <button
                type="button"
                className={`${styles.vehicleBtn} ${vehicle === "car" ? styles.vehicleBtnActive : ""}`}
                onClick={() => handleSelectVehicle("car")}
              >
                <CarIcon size={18} />
                <span>Ô tô (Car)</span>
              </button>

              <button
                type="button"
                className={`${styles.vehicleBtn} ${vehicle === "motorcycle" ? styles.vehicleBtnActive : ""}`}
                onClick={() => handleSelectVehicle("motorcycle")}
              >
                <MotorcycleIcon size={18} />
                <span>Xe máy</span>
                {!isPro && <span className={styles.proTag}>PRO</span>}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className={styles.optionLabel}>Giờ khởi hành:</span>
            <select
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-raised)",
                color: "var(--color-text-primary)",
                fontSize: "13px",
              }}
            >
              <option value="now">Khởi hành ngay bây giờ</option>
              <option value="in-1h">Sau 1 giờ nữa</option>
              <option value="in-2h">Sau 2 giờ nữa</option>
              <option value="morning">Sáng sớm mai (06:00)</option>
            </select>
          </div>

          <button
            type="button"
            className={styles.planActionBtn}
            onClick={handlePlanRoute}
            disabled={isPlanning}
          >
            {isPlanning ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                <span>Đang phân tích thời tiết dọc tuyến...</span>
              </>
            ) : (
              <>
                <span>🚀 Tìm lộ trình an toàn</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Comparison Results Section */}
      {hasPlanned && (
        <div className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>
              So sánh các phương án di chuyển: {origin} ➔ {destination}
            </h2>
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              {isPro
                ? "✨ Tài khoản PRO: Đang so sánh đầy đủ 3 phương án tuyến đường"
                : "⚡ Tài khoản Free: Đang xem 1 phương án Nhanh nhất (Nâng cấp Pro để xem lộ trình An toàn)"}
            </span>
          </div>

          {/* 3 Alternative Cards */}
          <div className={styles.alternativesGrid}>
            {alternatives.map((alt) => {
              const isLocked = !isPro && alt.type !== "fastest";
              const isSelected = selectedAltId === alt.id && !isLocked;

              return (
                <div
                  key={alt.id}
                  className={`${styles.altCard} ${isSelected ? styles.altCardSelected : ""} ${
                    alt.type === "weather_safer" ? styles.altCardSafer : ""
                  } ${isLocked ? styles.altCardLocked : ""}`}
                  onClick={() => {
                    if (!isLocked) {
                      setSelectedAltId(alt.id);
                    }
                  }}
                >
                  {/* Top Bar */}
                  <div className={styles.cardTop}>
                    <span
                      className={`${styles.altBadge} ${
                        alt.type === "fastest"
                          ? styles.badgeFastest
                          : alt.type === "weather_safer"
                          ? styles.badgeSafer
                          : styles.badgeShortest
                      }`}
                    >
                      {alt.type === "weather_safer" && "🛡️ "}
                      {alt.type === "fastest" && "⚡ "}
                      {alt.type === "shortest" && "📏 "}
                      {alt.titleVi}
                    </span>

                    {alt.type === "weather_safer" && (
                      <span className={styles.recommendedRibbon}>
                        <span>★ Khuyên dùng</span>
                      </span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className={styles.cardMetrics}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricLabel}>Khoảng cách</span>
                      <span className={styles.metricVal}>{alt.distanceKm} km</span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricLabel}>Thời gian</span>
                      <span className={styles.metricVal}>
                        {Math.floor(alt.durationMinutes / 60)}h {alt.durationMinutes % 60}p
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricLabel}>Rủi ro ETA</span>
                      <span
                        className={`${styles.riskScoreBadge} ${
                          alt.riskLevel === "low"
                            ? styles.riskLow
                            : alt.riskLevel === "caution"
                            ? styles.riskMedium
                            : styles.riskHigh
                        }`}
                      >
                        {alt.riskScore}/100
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className={styles.cardWeatherSummary}>
                    <span>{alt.weatherSummaryVi}</span>
                  </div>

                  {/* Locked Overlay for Free Tier */}
                  {isLocked && (
                    <div className={styles.lockedOverlay}>
                      <div className={styles.lockIconWrap}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className={styles.lockTitle}>Mở khóa Tuyến đường {alt.titleVi}</div>
                      <p className={styles.lockDesc}>
                        Nâng cấp tài khoản PRO để so sánh lộ trình tránh giông bão, sạt lở và gió mạnh.
                      </p>
                      <Link to="/upgrade" className={styles.unlockBtn}>
                        Nâng cấp Pro ngay (99k)
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Vehicle Specific Advisory Banner */}
          <div className={styles.advisoryBox}>
            <div className={styles.advisoryIcon}>
              <RiskIcon size={24} />
            </div>
            <div>
              <div className={styles.advisoryTitle}>
                {vehicle === "motorcycle"
                  ? "Cảnh báo an toàn đặc thù cho Xe máy trên lộ trình này"
                  : "Khuyến nghị thời tiết an toàn cho Ô tô"}
              </div>
              <div className={styles.advisoryText}>
                {vehicle === "motorcycle" ? (
                  <>
                    Tuyến đường có đoạn mưa rải rác và gió tạt qua các khúc cua sườn đồi lúc 10:30 - 11:30. Khuyến nghị
                    mang theo áo mưa bộ chống nước chuyên dụng, kiểm tra áp suất lốp và duy trì tốc độ an toàn dưới
                    40km/h trên mặt đường trơn trượt.
                  </>
                ) : (
                  <>
                    Tầm nhìn trên cao tốc dự báo giảm xuống còn 300m - 500m tại một số trạm trũng thấp do mưa giông. Vui
                    lòng bật đèn sương mù và giữ khoảng cách tối thiểu 50m với xe phía trước.
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Checkpoints Timeline */}
          <div className={styles.timelineCard}>
            <div className={styles.timelineTitle}>
              <span>Trạm kiểm tra thời tiết dọc tuyến: {currentSelectedAlt.titleVi}</span>
              <button type="button" onClick={handleSaveCurrentRoute} className={styles.saveBtn}>
                <span>💾 Lưu lộ trình này</span>
              </button>
            </div>

            <div className={styles.checkpointsList}>
              {currentSelectedAlt.checkpoints.map((cp, idx) => (
                <div key={idx} className={styles.checkpointItem}>
                  <div className={styles.checkpointDot} />
                  <div className={styles.checkpointContent}>
                    <div>
                      <div className={styles.checkpointName}>{cp.name}</div>
                      <div className={styles.checkpointEta}>
                        Cột mốc {cp.distanceKm} km • Dự kiến tới lúc: <strong>{cp.eta}</strong>
                      </div>
                    </div>

                    <div className={styles.checkpointWeather}>
                      <div style={{ textAlign: "right" }}>
                        <span className={styles.checkpointTemp}>{cp.temp}°C</span>
                        <div className={styles.checkpointCondition}>{cp.condition}</div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            color: cp.rainProb > 40 ? "#38BDF8" : "var(--color-text-secondary)",
                          }}
                        >
                          <RainIcon size={14} /> {cp.rainProb}%
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            color: cp.windKmh > 25 ? "#F59E0B" : "var(--color-text-secondary)",
                          }}
                        >
                          <WindIcon size={14} /> {cp.windKmh} km/h
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
