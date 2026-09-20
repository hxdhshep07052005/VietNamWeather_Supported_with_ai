/**
 * Phase 8/9 Route Planner Page
 * Weather-aware multi-alternative route planning with Free & Pro tier differentiation
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Crown,
  Zap,
  ShieldCheck,
  Ruler,
  Gauge,
  Sparkles,
  Navigation,
  Bookmark,
  Info,
  MapPin,
  RotateCcw,
  Check,
  Trash2,
  Scale,
  SlidersHorizontal,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { routeApi } from "@/api/client";
import { PROVINCE_MAP } from "@/data/provinces";
import { RouteInteractiveMap } from "@/components/map/RouteInteractiveMap";
import { resolveLocationCoords } from "@/utils/routePathGenerator";
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
  coordinates?: [number, number][];
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
  const isEn = i18n.language === "en";
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
  const [hasPlanned, setHasPlanned] = useState(true);
  const [selectedAltId, setSelectedAltId] = useState<string>("alt-safer");
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<"comparison" | "checkpoints">("comparison");
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
      setHasPlanned(true);
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
          setHasPlanned(true);
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
    setHasPlanned(true);
  };

  // Handle Vehicle selection (Free vs Pro)
  const handleSelectVehicle = (selected: "car" | "motorcycle") => {
    if (selected === "motorcycle" && !isPro) {
      showToast("Tính năng đánh giá rủi ro gió tạt & trơn trượt riêng cho Xe máy chỉ dành cho gói PRO!");
      return;
    }
    setVehicle(selected);
  };

  // State for real backend-calculated route alternatives
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);

  // Map real backend RouteResponse alternatives into UI RouteAlternative model
  const mapBackendAlternatives = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any): RouteAlternative[] => {
      const alts = (data?.alternatives || []) as any[];
      if (!alts.length) return [];

      return alts.map((alt) => {
        const type = (alt.alternative_type || "fastest") as "fastest" | "weather_safer" | "shortest";
        const distanceKm = Math.max(1, Math.round((alt.geometry?.distance_meters || 0) / 1000));
        const durationMinutes = Math.max(1, Math.round((alt.geometry?.duration_seconds || 0) / 60));
        const riskScore = Math.round((alt.route_risk?.score || 0) * 100);
        const riskLevel: "low" | "caution" | "high" =
          alt.route_risk?.level === "high" ? "high" : alt.route_risk?.level === "caution" ? "caution" : "low";

        const titleVi =
          type === "weather_safer"
            ? "An toàn Thời tiết nhất"
            : type === "fastest"
            ? "Nhanh nhất (Cao tốc)"
            : "Ngắn nhất (Quốc lộ)";
        const titleEn =
          type === "weather_safer"
            ? "Weather-Safer"
            : type === "fastest"
            ? "Fastest (Highway)"
            : "Shortest (National Road)";

        const samplePoints = (alt.sample_points || []) as any[];
        const checkpoints: RouteCheckpoint[] = samplePoints.map((sp: any, idx: number) => {
          const dist = Math.round((sp.distance_from_origin_meters || 0) / 1000);
          const etaMin = sp.eta_minutes || 0;
          const h = Math.floor(etaMin / 60);
          const m = etaMin % 60;
          const eta = `+${h > 0 ? `${h}h ` : ""}${m}m`;

          return {
            name:
              sp.name ||
              (idx === 0
                ? `${origin} (Xuất phát)`
                : idx === samplePoints.length - 1
                ? `${destination} (Điểm đến)`
                : `Trạm quan trắc Km ${dist}`),
            distanceKm: dist,
            eta,
            temp: Math.round(sp.observation?.temperature ?? 27),
            condition: sp.observation?.condition || "Thời tiết bình thường",
            rainProb: Math.round(sp.observation?.rain_probability ?? 10),
            windKmh: Math.round(sp.observation?.wind_speed ?? 12),
            risk: sp.risk_level === "high" ? "high" : sp.risk_level === "caution" ? "caution" : "low",
            note: Array.isArray(sp.factors) && sp.factors.length ? sp.factors.join(", ") : undefined,
            coordinates: sp.coordinates ? [sp.coordinates.longitude, sp.coordinates.latitude] : undefined,
          };
        });

        return {
          id: `alt-${type}`,
          type,
          titleVi,
          titleEn,
          distanceKm,
          durationMinutes,
          riskScore,
          riskLevel,
          rainExposureKm: Math.round(distanceKm * (riskLevel === "high" ? 0.35 : riskLevel === "caution" ? 0.15 : 0.05)),
          weatherSummaryVi: alt.summary?.vi || "Điều kiện thời tiết ổn định dọc tuyến di chuyển",
          weatherSummaryEn: alt.summary?.en || "Stable weather conditions along travel corridor",
          checkpoints,
          isProOnly: !isPro && type !== "fastest",
          coordinates: Array.isArray(alt.geometry?.coordinates) ? alt.geometry.coordinates : undefined,
        };
      });
    },
    [origin, destination, isPro]
  );

  // Execute Route Planning via Backend API
  const handlePlanRoute = useCallback(async () => {
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

    const originCoords = resolveLocationCoords(origin, [105.8544, 21.0285]);
    const destCoords = resolveLocationCoords(destination, [103.9754, 22.4856]);

    try {
      const response = await routeApi.calculateRoutes({
        origin: { coordinates: { latitude: originCoords[1], longitude: originCoords[0] } },
        destination: { coordinates: { latitude: destCoords[1], longitude: destCoords[0] } },
        vehicle_type: vehicle,
      });

      const mapped = mapBackendAlternatives(response);
      if (mapped.length > 0) {
        setAlternatives(mapped);
        setHasPlanned(true);
        setSelectedAltId(isPro ? mapped[0]!.id : "alt-fastest");
        setSelectedCheckpointIndex(null);
      } else {
        throw new Error("Không tìm thấy dữ liệu lộ trình.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tính toán lộ trình lúc này.";
      showToast(msg);
    } finally {
      setIsPlanning(false);
    }
  }, [origin, destination, vehicle, isPro, incrementRouteCount, mapBackendAlternatives]);

  // Initial planning on mount
  useEffect(() => {
    void handlePlanRoute();
  }, [handlePlanRoute]);

  // Selected Alternative Object
  const currentSelectedAlt = useMemo<RouteAlternative | null>(() => {
    if (!alternatives.length) return null;
    return alternatives.find((a) => a.id === selectedAltId) ?? alternatives[0] ?? null;
  }, [alternatives, selectedAltId]);

  // Comparison Data between 3 alternatives
  const comparisonData = useMemo(() => {
    const safer = alternatives.find((a) => a.type === "weather_safer") || alternatives[0] || null;
    const fastest = alternatives.find((a) => a.type === "fastest") || alternatives[1] || null;
    const shortest = alternatives.find((a) => a.type === "shortest") || alternatives[2] || null;
    return { safer, fastest, shortest };
  }, [alternatives]);

  const saferAlt = comparisonData.safer;
  const fastestAlt = comparisonData.fastest;
  const shortestAlt = comparisonData.shortest;

  // Save Route Action
  const handleSaveCurrentRoute = () => {
    if (!currentSelectedAlt) return;
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
          <Info size={18} color="#38BDF8" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar with Tier Info */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>{isEn ? "Weather-Aware Safe Route Planner" : (t("route.title") || "Lập Lộ Trình An Toàn Thời Tiết")}</span>
          </h1>
          <p className={styles.subtitle}>
            {isEn
              ? "Real-time meteorological analytics at ETA checkpoints along transit corridors across Vietnam"
              : (t("route.subtitle") || "Phân tích thời tiết theo thời gian thực tại các mốc ETA dọc tuyến di chuyển trên khắp Việt Nam")}
          </p>
        </div>

        <div className={styles.headerMeta}>
          {isPro ? (
            <span className={styles.planBadgePro}>
              <Crown size={12} strokeWidth={2.5} />
              <span>{isEn ? "PRO GOLD TIER" : "GÓI PRO CAO CẤP"}</span>
            </span>
          ) : (
            <>
              <span className={styles.planBadgeFree}>{isEn ? "FREE TIER" : "GÓI MIỄN PHÍ"}</span>
              <Link to="/upgrade" className={styles.upgradeBtnSmall}>
                <Sparkles size={12} />
                <span>{isEn ? "Upgrade to Pro" : "Nâng cấp Pro"}</span>
              </Link>
            </>
          )}

          <span className={styles.quotaCounter}>
            {isEn ? "Today's quota:" : "Lượt hôm nay:"} <strong>{remainingQuota}</strong> / {dailyQuotaMax}
          </span>
        </div>
      </div>

      {/* Main Split Layout: Left Panel (Search, Alternatives, Advisory, Checkpoints) & Right Panel (Sticky Map) */}
      <div className={styles.splitLayout}>
        {/* Left Column */}
        <div className={styles.leftSidebar}>
          {/* Form Card */}
          <div className={styles.plannerFormCard}>
            <div className={styles.routeInputsWrap}>
              {/* Origin */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  <span className={styles.inputLabelWithDot}>
                    <span className={styles.originDot} />
                    {isEn ? "Origin Location" : (t("route.from") || "Điểm xuất phát")}
                  </span>
                  <button type="button" onClick={handleUseCurrentLocation} className={styles.gpsBtn}>
                    <Navigation size={12} />
                    <span>{isEn ? "My GPS" : "GPS của tôi"}</span>
                  </button>
                </label>
                <div className={styles.inputBox}>
                  <input
                    type="text"
                    list="provinces-list"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder={isEn ? "Enter origin (e.g., Hanoi)..." : "Nhập tỉnh thành đi (ví dụ: Hà Nội)..."}
                    className={styles.inputField}
                  />
                </div>
              </div>

              {/* Swap Button Divider */}
              <div className={styles.swapRow}>
                <div className={styles.swapLine} />
                <button type="button" onClick={handleSwap} className={styles.swapBtn} title={isEn ? "Swap origin and destination" : "Đổi chiều đi - về"}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                  </svg>
                </button>
                <div className={styles.swapLine} />
              </div>

              {/* Destination */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                  <span className={styles.inputLabelWithDot}>
                    <span className={styles.destDot} />
                    {isEn ? "Destination" : (t("route.to") || "Điểm đến")}
                  </span>
                </label>
                <div className={styles.inputBox}>
                  <input
                    type="text"
                    list="provinces-list"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={isEn ? "Enter destination (e.g., Lao Cai)..." : "Nhập tỉnh thành đến (ví dụ: Lào Cai)..."}
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
              <span className={styles.presetLabel}>{isEn ? "Presets:" : "Gợi ý chặng:"}</span>
              <div className={styles.presetsList}>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => handleSelectPreset("Hà Nội", "Lào Cai")}
                >
                  {isEn ? "Hanoi → Sa Pa" : "Hà Nội → Sa Pa"}
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => handleSelectPreset("Đà Nẵng", "Thừa Thiên Huế")}
                >
                  {isEn ? "Da Nang → Hue" : "Đà Nẵng → Huế"}
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => handleSelectPreset("Hồ Chí Minh", "Lâm Đồng")}
                >
                  {isEn ? "HCMC → Da Lat" : "TP.HCM → Đà Lạt"}
                </button>
                <button
                  type="button"
                  className={styles.presetChip}
                  onClick={() => handleSelectPreset("Hồ Chí Minh", "Bà Rịa - Vũng Tàu")}
                >
                  {isEn ? "HCMC → Vung Tau" : "TP.HCM → Vũng Tàu"}
                </button>
              </div>
            </div>

            {/* Vehicle & Options Bar */}
            <div className={styles.optionsBar}>
              <div className={styles.optionsControlsRow}>
                <div className={styles.vehicleGroup}>
                  <span className={styles.optionLabel}>{isEn ? "Vehicle:" : "Phương tiện:"}</span>
                  <div className={styles.vehicleButtons}>
                    <button
                      type="button"
                      className={`${styles.vehicleBtn} ${vehicle === "car" ? styles.vehicleBtnActive : ""}`}
                      onClick={() => handleSelectVehicle("car")}
                    >
                      <CarIcon size={16} />
                      <span>{isEn ? "Car" : "Ô tô"}</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.vehicleBtn} ${vehicle === "motorcycle" ? styles.vehicleBtnActive : ""}`}
                      onClick={() => handleSelectVehicle("motorcycle")}
                    >
                      <MotorcycleIcon size={16} />
                      <span>{isEn ? "Motorbike" : "Xe máy"}</span>
                      {!isPro && <span className={styles.proTag}>PRO</span>}
                    </button>
                  </div>
                </div>

                <div className={styles.departureGroup}>
                  <span className={styles.optionLabel}>{isEn ? "Departure:" : "Khởi hành:"}</span>
                  <select
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className={styles.departureSelect}
                  >
                    <option value="now">{isEn ? "Leave Now" : "Ngay bây giờ"}</option>
                    <option value="in-1h">{isEn ? "In 1 hour" : "Sau 1 giờ"}</option>
                    <option value="in-2h">{isEn ? "In 2 hours" : "Sau 2 giờ"}</option>
                    <option value="morning">{isEn ? "Tomorrow morning (06:00)" : "Sáng mai (06:00)"}</option>
                  </select>
                </div>
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
                    <span>{isEn ? "Analyzing weather..." : "Đang phân tích thời tiết..."}</span>
                  </>
                ) : (
                  <>
                    <Navigation size={16} />
                    <span>{isEn ? "Find Safe Route" : "Tìm lộ trình an toàn"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Section */}
          {hasPlanned && currentSelectedAlt && (
            <div className={styles.resultsSection}>
              {/* Alternatives List */}
              <div className={styles.alternativesCard}>
                <div className={styles.resultsHeader}>
                  <div className={styles.resultsTitleRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h2 className={styles.resultsTitle}>{isEn ? "Travel Alternatives" : "Phương án di chuyển"}</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setHasPlanned(false);
                          setSelectedCheckpointIndex(null);
                          setSelectedAltId("alt-safer");
                          showToast(isEn ? "Route cleared and map reset." : "Đã hủy lộ trình và làm mới bản đồ.");
                        }}
                        className={styles.clearRouteBtn}
                        title={isEn ? "Clear route and reset map" : "Hủy toàn bộ lộ trình và làm mới bản đồ"}
                      >
                        <Trash2 size={12} />
                        <span>{isEn ? "Clear Route" : "Hủy lộ trình"}</span>
                      </button>
                    </div>
                    <span className={styles.resultsMetaText}>
                      {isPro ? (isEn ? "PRO: 3 alternatives" : "PRO: 3 phương án") : (isEn ? "Free: 1 alternative" : "Free: 1 phương án")}
                    </span>
                  </div>
                </div>

                {/* Vertical Stack of Alternative Cards */}
                <div className={styles.alternativesStack}>
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
                            setSelectedCheckpointIndex(null);
                          }
                        }}
                        style={{ cursor: isLocked ? "default" : "pointer" }}
                        title={
                          isLocked
                            ? (isEn ? "Upgrade to Pro to unlock this corridor" : "Nâng cấp gói Pro để mở khóa tuyến này")
                            : (isEn ? `Click to select ${alt.titleEn}` : `Nhấp để chọn phương án ${alt.titleVi}`)
                        }
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
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                          >
                            {alt.type === "weather_safer" && <ShieldCheck size={14} />}
                            {alt.type === "fastest" && <Zap size={14} />}
                            {alt.type === "shortest" && <Gauge size={14} />}
                            <span>{isEn ? alt.titleEn : alt.titleVi}</span>
                          </span>

                          {isSelected ? (
                            <span className={styles.activeSelectedPill}>
                              <Check size={11} strokeWidth={2.5} />
                              <span>{isEn ? "Applied" : "Đang áp dụng"}</span>
                            </span>
                          ) : alt.type === "weather_safer" ? (
                            <span className={styles.recommendedRibbon}>
                              <Sparkles size={12} />
                              <span>{isEn ? "Recommended" : "Khuyên dùng"}</span>
                            </span>
                          ) : null}
                        </div>

                        {/* Metrics */}
                        <div className={styles.cardMetrics}>
                          <div className={styles.metricItem}>
                            <span className={styles.metricLabel}>{isEn ? "Distance" : "Khoảng cách"}</span>
                            <span className={styles.metricVal}>{alt.distanceKm} km</span>
                          </div>
                          <div className={styles.metricItem}>
                            <span className={styles.metricLabel}>{isEn ? "Duration" : "Thời gian"}</span>
                            <span className={styles.metricVal}>
                              {Math.floor(alt.durationMinutes / 60)}h {alt.durationMinutes % 60}{isEn ? "m" : "p"}
                            </span>
                          </div>
                          <div className={styles.metricItem}>
                            <span className={styles.metricLabel}>{isEn ? "ETA Risk" : "Rủi ro ETA"}</span>
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
                          <span>{isEn ? alt.weatherSummaryEn : alt.weatherSummaryVi}</span>
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
                            <div className={styles.lockTitle}>
                              {isEn ? `Unlock ${alt.titleEn}` : `Mở khóa Tuyến ${alt.titleVi}`}
                            </div>
                            <p className={styles.lockDesc}>
                              {isEn
                                ? "Upgrade to PRO to compare routes avoiding severe squalls, landslides, and high winds."
                                : "Nâng cấp gói PRO để so sánh lộ trình tránh giông bão, sạt lở và gió mạnh."}
                            </p>
                            <Link to="/upgrade" className={styles.unlockBtn}>
                              {isEn ? "Upgrade to Pro now" : "Nâng cấp Pro ngay"}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vehicle Specific Advisory Banner */}
              <div className={styles.advisoryBox}>
                <div className={styles.advisoryIcon}>
                  <RiskIcon size={22} />
                </div>
                <div>
                  <div className={styles.advisoryTitle}>
                    {vehicle === "motorcycle"
                      ? (isEn ? "Specific safety advisory for Motorcycles" : "Cảnh báo an toàn đặc thù cho Xe máy")
                      : (isEn ? "Weather safety recommendation for Passenger Cars" : "Khuyến nghị thời tiết an toàn cho Ô tô")}
                  </div>
                  <div className={styles.advisoryText}>
                    {vehicle === "motorcycle" ? (
                      isEn ? (
                        <>
                          Route encounters scattered drizzle and gusty winds along mountain curves from 10:30 to 11:30.
                          Waterproof rain suits recommended; verify tire pressure and maintain speeds under 40 km/h on slick pavements.
                        </>
                      ) : (
                        <>
                          Tuyến đường có đoạn mưa rải rác và gió tạt qua các khúc cua sườn đồi lúc 10:30 - 11:30. Khuyến nghị
                          mang theo áo mưa bộ chống nước, kiểm tra áp suất lốp và duy trì tốc độ dưới 40km/h trên mặt đường trơn trượt.
                        </>
                      )
                    ) : (
                      isEn ? (
                        <>
                          Expressway visibility is forecast to drop to 300m - 500m at low-elevation stretches due to squalls.
                          Please engage fog lamps and maintain a minimum 50m following distance.
                        </>
                      ) : (
                        <>
                          Tầm nhìn trên cao tốc dự báo giảm xuống còn 300m - 500m tại một số trạm trũng thấp do mưa giông. Vui
                          lòng bật đèn sương mù và giữ khoảng cách tối thiểu 50m với xe phía trước.
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* View Mode Tabs: Comparison Matrix vs Checkpoints */}
              <div className={styles.viewTabsRow}>
                <button
                  type="button"
                  className={`${styles.viewTabBtn} ${activeViewTab === "comparison" ? styles.viewTabBtnActive : ""}`}
                  onClick={() => setActiveViewTab("comparison")}
                >
                  <Scale size={13} />
                  <span>{isEn ? "Compare 3 alternatives" : "So sánh 3 phương án"}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewTabBtn} ${activeViewTab === "checkpoints" ? styles.viewTabBtnActive : ""}`}
                  onClick={() => setActiveViewTab("checkpoints")}
                >
                  <MapPin size={13} />
                  <span>
                    {isEn
                      ? `Checkpoints (${currentSelectedAlt.checkpoints.length})`
                      : `Trạm kiểm tra (${currentSelectedAlt.checkpoints.length} trạm)`}
                  </span>
                </button>
              </div>

              {/* 1. Comparison Matrix Mode */}
              {activeViewTab === "comparison" && saferAlt && fastestAlt && (
                <div className={styles.comparisonCard}>
                  <div className={styles.comparisonHeader}>
                    <div className={styles.comparisonTitleRow}>
                      <div className={styles.comparisonTitle}>
                        <SlidersHorizontal size={15} color="#38BDF8" />
                        <span>{isEn ? "Multi-Criteria 3-Alternative Comparison" : "So sánh đa tiêu chí 3 phương án"}</span>
                      </div>
                      <span className={styles.paretoBadge}>{isEn ? "Pareto Optimal" : "Tối ưu Pareto"}</span>
                    </div>
                    <p className={styles.comparisonSubtitle}>
                      {isEn
                        ? "Evaluating trade-offs between travel duration, total distance, and extreme meteorological risk exposure."
                        : "Đánh giá tương quan giữa thời gian lưu thông, tổng quãng đường và mức độ phơi nhiễm trước rủi ro khí tượng cực đoan."}
                    </p>
                  </div>

                  <div className={styles.comparisonTableWrap}>
                    <table className={styles.comparisonTable}>
                      <thead>
                        <tr>
                          <th className={styles.comparisonCriteriaCell}>{isEn ? "Criteria" : "Tiêu chí"}</th>
                          <th className={`${styles.colSafer} ${selectedAltId === saferAlt.id ? styles.colSelected : ""}`}>
                            <span style={{ color: "#10B981", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <ShieldCheck size={14} /> {isEn ? "Weather-Safer" : "An toàn"}
                            </span>
                          </th>
                          <th className={`${styles.colFastest} ${selectedAltId === fastestAlt.id ? styles.colSelected : ""}`}>
                            <span style={{ color: "#0EA5E9", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <Zap size={14} /> {isEn ? "Fastest" : "Nhanh nhất"}
                            </span>
                          </th>
                          {shortestAlt && (
                            <th className={`${styles.colShortest} ${selectedAltId === shortestAlt.id ? styles.colSelected : ""}`}>
                              <span style={{ color: "#8B5CF6", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                <Ruler size={14} /> {isEn ? "Shortest" : "Ngắn nhất"}
                              </span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Route Corridor" : "Hành lang tuyến"}</td>
                          <td className={styles.colSafer}>{isEn ? "CT05 (Squall Evading)" : "CT05 (Tránh dông)"}</td>
                          <td className={styles.colFastest}>{isEn ? "CT05 (Direct Crossing)" : "CT05 (Đi xuyên tâm)"}</td>
                          {shortestAlt && <td className={styles.colShortest}>{isEn ? "QL70 (Bao Yen Pass)" : "QL70 (Đèo Bảo Yên)"}</td>}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Distance" : "Quãng đường"}</td>
                          <td className={styles.colSafer}><strong>{saferAlt.distanceKm} km</strong> ({isEn ? "+11 km" : "+11 km"})</td>
                          <td className={styles.colFastest}><strong>{fastestAlt.distanceKm} km</strong> ({isEn ? "Baseline" : "Chuẩn"})</td>
                          {shortestAlt && <td className={styles.colShortest}><strong>{shortestAlt.distanceKm} km</strong> ({isEn ? "-12 km" : "-12 km"})</td>}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "ETA Duration" : "Thời gian ETA"}</td>
                          <td className={styles.colSafer}>
                            <strong>{Math.floor(saferAlt.durationMinutes / 60)}h {saferAlt.durationMinutes % 60}m</strong> ({isEn ? "+26m" : "+26p"})
                          </td>
                          <td className={styles.colFastest}>
                            <strong>{Math.floor(fastestAlt.durationMinutes / 60)}h {fastestAlt.durationMinutes % 60}m</strong> ({isEn ? "Fastest" : "Nhanh nhất"})
                          </td>
                          {shortestAlt && (
                            <td className={styles.colShortest}>
                              <strong>{Math.floor(shortestAlt.durationMinutes / 60)}h {shortestAlt.durationMinutes % 60}m</strong> ({isEn ? "+1h 36m" : "+1h 36p"})
                            </td>
                          )}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Risk Score" : "Chỉ số rủi ro"}</td>
                          <td className={styles.colSafer}>
                            <span className={`${styles.riskScoreBadge} ${styles.riskLow}`}>{saferAlt.riskScore}/100</span> {isEn ? "Safe" : "An toàn"}
                          </td>
                          <td className={styles.colFastest}>
                            <span className={`${styles.riskScoreBadge} ${styles.riskHigh}`}>{fastestAlt.riskScore}/100</span> {isEn ? "Hazard" : "Nguy hiểm"}
                          </td>
                          {shortestAlt && (
                            <td className={styles.colShortest}>
                              <span className={`${styles.riskScoreBadge} ${styles.riskMedium}`}>{shortestAlt.riskScore}/100</span> {isEn ? "Caution" : "Chú ý"}
                            </td>
                          )}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Severe Weather" : "Thời tiết cực đoan"}</td>
                          <td className={styles.colSafer}>{isEn ? "0 km squalls (15 km light rain)" : "0 km dông (15 km mưa nhẹ)"}</td>
                          <td className={styles.colFastest}>{isEn ? "98 km heavy storm >35mm/h" : "98 km mưa dông >35mm/h"}</td>
                          {shortestAlt && <td className={styles.colShortest}>{isEn ? "41 km mountain fog" : "41 km sương mù đèo dốc"}</td>}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Visibility & Road" : "Tầm nhìn & Đường"}</td>
                          <td className={styles.colSafer}>{isEn ? "> 10 km, dry pavement" : "> 10 km, khô thoáng"}</td>
                          <td className={styles.colFastest}>{isEn ? "< 300 m, aquaplaning" : "< 300 m, trơn trượt ngập úng"}</td>
                          {shortestAlt && <td className={styles.colShortest}>{isEn ? "< 500 m, winding bends" : "< 500 m, khúc cua trơn"}</td>}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Pareto Evaluation" : "Đánh giá Pareto"}</td>
                          <td className={styles.colSafer} style={{ color: "#10B981", fontWeight: 700 }}>{isEn ? "Recommended Optimal" : "Khuyên dùng tối ưu"}</td>
                          <td className={styles.colFastest} style={{ color: "#EF4444", fontWeight: 600 }}>{isEn ? "Hazardous Warning" : "Cảnh báo nguy hiểm"}</td>
                          {shortestAlt && <td className={styles.colShortest} style={{ color: "#F59E0B", fontWeight: 600 }}>{isEn ? "Not Recommended" : "Không khuyến nghị"}</td>}
                        </tr>
                        <tr>
                          <td className={styles.comparisonCriteriaCell}>{isEn ? "Apply Route" : "Áp dụng tuyến"}</td>
                          <td className={styles.colSafer}>
                            <button
                              type="button"
                              className={`${styles.tableApplyBtn} ${selectedAltId === saferAlt.id ? styles.tableApplyBtnActive : ""}`}
                              onClick={() => {
                                setSelectedAltId(saferAlt.id);
                                setSelectedCheckpointIndex(null);
                              }}
                            >
                              {selectedAltId === saferAlt.id ? <Check size={11} /> : null}
                              <span>{selectedAltId === saferAlt.id ? (isEn ? "Active" : "Đang chọn") : (isEn ? "Select" : "Chọn")}</span>
                            </button>
                          </td>
                          <td className={styles.colFastest}>
                            <button
                              type="button"
                              className={`${styles.tableApplyBtn} ${selectedAltId === fastestAlt.id ? styles.tableApplyBtnActive : ""}`}
                              onClick={() => {
                                setSelectedAltId(fastestAlt.id);
                                setSelectedCheckpointIndex(null);
                              }}
                            >
                              {selectedAltId === fastestAlt.id ? <Check size={11} /> : null}
                              <span>{selectedAltId === fastestAlt.id ? (isEn ? "Active" : "Đang chọn") : (isEn ? "Select" : "Chọn")}</span>
                            </button>
                          </td>
                          {shortestAlt && (
                            <td className={styles.colShortest}>
                              <button
                                type="button"
                                className={`${styles.tableApplyBtn} ${selectedAltId === shortestAlt.id ? styles.tableApplyBtnActive : ""}`}
                                onClick={() => {
                                  setSelectedAltId(shortestAlt.id);
                                  setSelectedCheckpointIndex(null);
                                }}
                              >
                                {selectedAltId === shortestAlt.id ? <Check size={11} /> : null}
                                <span>{selectedAltId === shortestAlt.id ? (isEn ? "Active" : "Đang chọn") : (isEn ? "Select" : "Chọn")}</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. Checkpoints Timeline Mode */}
              {activeViewTab === "checkpoints" && (
                <div className={styles.timelineCard}>
                  <div className={styles.timelineTitle}>
                    <div className={styles.timelineTitleLeft}>
                      <span>
                        {isEn ? "Corridor Checkpoints:" : "Trạm kiểm tra dọc tuyến:"}{" "}
                        <strong>{isEn ? currentSelectedAlt.titleEn : currentSelectedAlt.titleVi}</strong>
                      </span>
                    </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedCheckpointIndex !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedCheckpointIndex(null)}
                        className={styles.clearCheckpointBtn}
                        title={isEn ? "Deselect checkpoint to view entire corridor" : "Bỏ chọn trạm để quay lại xem toàn cảnh lộ trình"}
                      >
                        <RotateCcw size={12} />
                        <span>{isEn ? "View Corridor" : "Xem toàn tuyến"}</span>
                      </button>
                    )}
                    <button type="button" onClick={handleSaveCurrentRoute} className={styles.saveBtn}>
                      <Bookmark size={14} />
                      <span>{isEn ? "Save Route" : "Lưu lộ trình"}</span>
                    </button>
                  </div>
                </div>

                <div className={styles.checkpointsList}>
                  {currentSelectedAlt.checkpoints.map((cp, idx) => {
                    const isSelected = selectedCheckpointIndex === idx;
                    const displayName = isEn
                      ? cp.name
                          .replace("Hà Nội (Xuất phát)", "Hanoi (Departure)")
                          .replace("Lào Cai - Sa Pa (Đích)", "Lao Cai - Sa Pa (Destination)")
                          .replace("Trạm Vĩnh Yên", "Vinh Yen Station")
                          .replace("Trạm Phú Thọ", "Phu Tho Station")
                          .replace("Trạm Yên Bái", "Yen Bai Station")
                          .replace("Trạm Bảo Thắng", "Bao Thang Station")
                          .replace("Trạm Km 115 (Cao tốc)", "Station Km 115 (Expressway)")
                          .replace("Trạm quan trắc", "Monitoring Station")
                          .replace("Hà Nội", "Hanoi")
                          .replace("Lào Cai", "Lao Cai")
                      : cp.name;

                    const displayCondition = isEn
                      ? cp.condition
                          .replace("Mây nhẹ", "Partly Cloudy")
                          .replace("Trời nắng nhẹ", "Mild Sun")
                          .replace("Mây rải rác", "Scattered Clouds")
                          .replace("Mưa nhỏ rải rác", "Light Drizzle")
                          .replace("Mây thay đổi", "Variable Clouds")
                          .replace("Trời mát", "Cool & Clear")
                          .replace("Dông lốc nguy hiểm", "Severe Squalls")
                          .replace("Mưa rào", "Rain Showers")
                          .replace("Sương mù", "Dense Fog")
                          .replace("Thời tiết bình thường", "Normal Weather")
                      : cp.condition;

                    return (
                      <div
                        key={idx}
                        className={`${styles.checkpointItem} ${isSelected ? styles.checkpointItemSelected : ""}`}
                        onClick={() => setSelectedCheckpointIndex((prev) => (prev === idx ? null : idx))}
                        style={{ cursor: "pointer" }}
                        title={isSelected ? (isEn ? "Click to deselect" : "Nhấp lại để bỏ chọn trạm này") : (isEn ? "Click to inspect on map" : "Nhấp để xem trạm này trên bản đồ")}
                      >
                        <div className={styles.checkpointDot} />
                        <div className={styles.checkpointContent}>
                          <div>
                            <div className={styles.checkpointName}>{displayName}</div>
                            <div className={styles.checkpointEta}>
                              {isEn ? "Milestone" : "Cột mốc"} {cp.distanceKm} km • ETA: <strong>{cp.eta}</strong>
                            </div>
                          </div>

                          <div className={styles.checkpointWeather}>
                            <div style={{ textAlign: "right" }}>
                              <span className={styles.checkpointTemp}>{cp.temp}°C</span>
                              <div className={styles.checkpointCondition}>{displayCondition}</div>
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Right Column: Sticky Interactive Map */}
        <div className={styles.rightMapPane}>
          <div className={styles.mapCardTopBar}>
            <div className={styles.mapCardInfo}>
              <MapPin size={18} className={styles.mapPinIcon} />
              <div className={styles.mapTitleMeta}>
                <span className={styles.mapRouteCorridor}>
                  {hasPlanned
                    ? `${origin === "Hà Nội" && isEn ? "Hanoi" : origin} → ${destination === "Lào Cai" && isEn ? "Lao Cai" : destination}`
                    : (isEn ? "Vietnam National Weather Overview" : "Toàn cảnh bản đồ thời tiết Việt Nam")}
                </span>
                <span className={styles.mapRouteAltBadge}>
                  {hasPlanned && currentSelectedAlt
                    ? `${isEn ? currentSelectedAlt.titleEn : currentSelectedAlt.titleVi} • ${currentSelectedAlt.distanceKm} km • ${Math.floor(currentSelectedAlt.durationMinutes / 60)}h ${currentSelectedAlt.durationMinutes % 60}${isEn ? "m" : "p"}`
                    : (isEn ? "No route planned" : "Chưa tìm lộ trình (Nhập điểm đi - điểm đến và bấm Tìm lộ trình)")}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.mapCanvasHolder}>
            <RouteInteractiveMap
              hasPlanned={hasPlanned}
              originName={origin === "Hà Nội" && isEn ? "Hanoi" : origin}
              destinationName={destination === "Lào Cai" && isEn ? "Lao Cai" : destination}
              checkpoints={hasPlanned && currentSelectedAlt ? currentSelectedAlt.checkpoints : []}
              coordinates={hasPlanned && currentSelectedAlt ? currentSelectedAlt.coordinates : undefined}
              routeType={currentSelectedAlt ? currentSelectedAlt.type : "fastest"}
              titleVi={hasPlanned && currentSelectedAlt ? currentSelectedAlt.titleVi : "Bản đồ thời tiết"}
              titleEn={hasPlanned && currentSelectedAlt ? currentSelectedAlt.titleEn : "Weather Map"}
              selectedCheckpointIndex={selectedCheckpointIndex}
              onSelectCheckpoint={(idx) => setSelectedCheckpointIndex(idx)}
            />
          </div>
        </div>
      </div>

      {/* Full-width Comprehensive Corridor Comparison Table */}
      {hasPlanned && saferAlt && fastestAlt && (
        <div className={styles.fullWidthComparisonSection}>
          <div className={styles.comparisonHeader}>
            <div className={styles.comparisonTitleRow}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Scale size={20} color="var(--color-primary)" />
                <h3 className={styles.comparisonTitle}>
                  {isEn
                    ? `Multi-Criteria 3-Alternative Corridor Comparison (${origin === "Hà Nội" ? "Hanoi" : origin} → ${destination === "Lào Cai" ? "Lao Cai" : destination})`
                    : `Bảng đối sánh đa tiêu chí 3 phương án di chuyển hành lang (${origin} → ${destination})`}
                </h3>
              </div>
              <span className={styles.paretoBadge}>
                {isEn ? "Pareto Decision Model" : "Mô hình Ra quyết định Pareto"}
              </span>
            </div>
            <p className={styles.comparisonSubtitle}>
              {isEn
                ? "Scientific analysis of trade-offs between transit duration, distance, and extreme meteorological risk exposure."
                : "Phân tích khoa học sự đánh đổi giữa thời gian lưu thông, quãng đường và chỉ số phơi nhiễm rủi ro khí tượng cực đoan."}
            </p>
          </div>

          <div className={styles.comparisonTableWrap}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th className={styles.comparisonCriteriaCell}>{isEn ? "Evaluation Criteria" : "Tiêu chí đánh giá"}</th>
                  <th className={`${styles.colSafer} ${selectedAltId === saferAlt.id ? styles.colSelected : ""}`}>
                    <span style={{ color: "#10B981", fontSize: "12px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <ShieldCheck size={16} /> {isEn ? "WEATHER-SAFER (Recommended)" : "AN TOÀN THỜI TIẾT NHẤT (Đề xuất)"}
                    </span>
                  </th>
                  <th className={`${styles.colFastest} ${selectedAltId === fastestAlt.id ? styles.colSelected : ""}`}>
                    <span style={{ color: "#0EA5E9", fontSize: "12px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Zap size={16} /> {isEn ? "FASTEST (Direct Expressway)" : "NHANH NHẤT (Cao tốc trực diện)"}
                    </span>
                  </th>
                  {shortestAlt && (
                    <th className={`${styles.colShortest} ${selectedAltId === shortestAlt.id ? styles.colSelected : ""}`}>
                      <span style={{ color: "#8B5CF6", fontSize: "12px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Ruler size={16} /> {isEn ? "SHORTEST (National Route)" : "NGẮN NHẤT (Quốc lộ truyền thống)"}
                      </span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Route Corridor" : "Hành lang tuyến"}</td>
                  <td className={styles.colSafer}>{isEn ? "CT05 expressway evading Doan Hung squalls" : "CT05 điều hướng vòng tránh vùng mây dông Đoan Hùng"}</td>
                  <td className={styles.colFastest}>{isEn ? "Noi Bai - Lao Cai direct via Km 110 - 150" : "Cao tốc Nội Bài - Lào Cai đi thẳng qua Km 110 - 150"}</td>
                  {shortestAlt && <td className={styles.colShortest}>{isEn ? "National Route 70 via Bao Yen Pass" : "Quốc lộ 70 qua địa phận đèo Bảo Yên"}</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Total Distance" : "Tổng quãng đường"}</td>
                  <td className={styles.colSafer}><strong>{saferAlt.distanceKm} km</strong> ({isEn ? "+11 km / +3.8%" : "+11 km / +3.8%"})</td>
                  <td className={styles.colFastest}><strong>{fastestAlt.distanceKm} km</strong> ({isEn ? "Baseline distance" : "Khoảng cách chuẩn"})</td>
                  {shortestAlt && <td className={styles.colShortest}><strong>{shortestAlt.distanceKm} km</strong> ({isEn ? "-12 km / -4.2%" : "-12 km / -4.2%"})</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Estimated Duration (ETA)" : "Thời gian dự kiến (ETA)"}</td>
                  <td className={styles.colSafer}>
                    <strong>{Math.floor(saferAlt.durationMinutes / 60)}h {saferAlt.durationMinutes % 60}m</strong> ({isEn ? "+26 min / +11.1%" : "+26 phút / +11.1%"})
                  </td>
                  <td className={styles.colFastest}>
                    <strong>{Math.floor(fastestAlt.durationMinutes / 60)}h {fastestAlt.durationMinutes % 60}m</strong> ({isEn ? "Fastest" : "Nhanh nhất"})
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest}>
                      <strong>{Math.floor(shortestAlt.durationMinutes / 60)}h {shortestAlt.durationMinutes % 60}m</strong> ({isEn ? "+1h 36 min / +41.0%" : "+1h 36 phút / +41.0%"})
                    </td>
                  )}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Meteorological Risk Score" : "Chỉ số rủi ro khí tượng"}</td>
                  <td className={styles.colSafer}>
                    <span className={`${styles.riskScoreBadge} ${styles.riskLow}`}>{saferAlt.riskScore}/100</span> {isEn ? "Absolute Safe (0/6 hazards)" : "An toàn tuyệt đối (0/6 điểm hiểm họa)"}
                  </td>
                  <td className={styles.colFastest}>
                    <span className={`${styles.riskScoreBadge} ${styles.riskHigh}`}>{fastestAlt.riskScore}/100</span> {isEn ? "High Risk (4/6 hazards)" : "Nguy cơ cao (4/6 điểm hiểm họa)"}
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest}>
                      <span className={`${styles.riskScoreBadge} ${styles.riskMedium}`}>{shortestAlt.riskScore}/100</span> {isEn ? "Caution (2/6 hazards)" : "Mức độ chú ý (2/6 điểm hiểm họa)"}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Severe Weather Exposure" : "Phơi nhiễm thời tiết cực đoan"}</td>
                  <td className={styles.colSafer}>{isEn ? "0 km squall (15 km light drizzle near Yen Bai)" : "0 km dông lốc (15 km mưa nhỏ nhẹ đoạn Yên Bái)"}</td>
                  <td className={styles.colFastest}>{isEn ? "98 km heavy storm > 35mm/h, gale force 6 - 7" : "98 km mưa dông cực lớn > 35mm/h, gió giật cấp 6 - 7"}</td>
                  {shortestAlt && <td className={styles.colShortest}>{isEn ? "41 km dense fog & slippery drizzle on Bao Yen Pass" : "41 km sương mù dày đặc và mưa phùn trơn trượt đèo Bảo Yên"}</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Visibility & Road Condition" : "Tầm nhìn & Trạng thái đường"}</td>
                  <td className={styles.colSafer}>{isEn ? "Visibility > 10 km, dry pavement, clear pass" : "Tầm nhìn > 10 km, mặt đường khô ráo, đèo dốc thông thoáng"}</td>
                  <td className={styles.colFastest}>{isEn ? "Visibility < 300 m, aquaplaning & flooded highway" : "Tầm nhìn < 300 m, nguy cơ trơn trượt và ngập úng mặt đường cao tốc"}</td>
                  {shortestAlt && <td className={styles.colShortest}>{isEn ? "Visibility < 500 m, narrow dangerous hairpin turns" : "Tầm nhìn < 500 m, đường hẹp nhiều khúc cua tay áo nguy hiểm"}</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Pareto Optimal Evaluation" : "Đánh giá tối ưu Pareto"}</td>
                  <td className={styles.colSafer} style={{ color: "#10B981", fontWeight: 700 }}>
                    {isEn ? "Recommended Optimal: 100% hazard eliminated with negligible delay (+26m)." : "Khuyên dùng tối ưu: Triệt tiêu 100% rủi ro hiểm họa, thời gian tăng không đáng kể (+26p)."}
                  </td>
                  <td className={styles.colFastest} style={{ color: "#EF4444", fontWeight: 600 }}>
                    {isEn ? "Hazard Warning: Saves 26 min but directly enters severe squall and gale winds." : "Cảnh báo nguy hiểm: Tiết kiệm 26 phút nhưng đối mặt trực diện dông lốc và gió giật mạnh."}
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest} style={{ color: "#F59E0B", fontWeight: 600 }}>
                      {isEn ? "Not Recommended: 12 km shorter but adds 1h 36 min over degraded roads." : "Không khuyến nghị: Cự ly ngắn hơn 12 km nhưng tốn thêm hơn 1h 36 phút do đường xấu."}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Select Alternative" : "Chọn phương án"}</td>
                  <td className={styles.colSafer}>
                    <button
                      type="button"
                      className={`${styles.tableApplyBtn} ${selectedAltId === saferAlt.id ? styles.tableApplyBtnActive : ""}`}
                      onClick={() => {
                        setSelectedAltId(saferAlt.id);
                        setSelectedCheckpointIndex(null);
                      }}
                    >
                      {selectedAltId === saferAlt.id ? <Check size={12} /> : null}
                      <span>{selectedAltId === saferAlt.id ? (isEn ? "Active Route" : "Đang áp dụng") : (isEn ? "Select Route" : "Chọn tuyến này")}</span>
                    </button>
                  </td>
                  <td className={styles.colFastest}>
                    <button
                      type="button"
                      className={`${styles.tableApplyBtn} ${selectedAltId === fastestAlt.id ? styles.tableApplyBtnActive : ""}`}
                      onClick={() => {
                        setSelectedAltId(fastestAlt.id);
                        setSelectedCheckpointIndex(null);
                      }}
                    >
                      {selectedAltId === fastestAlt.id ? <Check size={12} /> : null}
                      <span>{selectedAltId === fastestAlt.id ? (isEn ? "Active Route" : "Đang áp dụng") : (isEn ? "Select Route" : "Chọn tuyến này")}</span>
                    </button>
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest}>
                      <button
                        type="button"
                        className={`${styles.tableApplyBtn} ${selectedAltId === shortestAlt.id ? styles.tableApplyBtnActive : ""}`}
                        onClick={() => {
                          setSelectedAltId(shortestAlt.id);
                          setSelectedCheckpointIndex(null);
                        }}
                      >
                        {selectedAltId === shortestAlt.id ? <Check size={12} /> : null}
                        <span>{selectedAltId === shortestAlt.id ? (isEn ? "Active Route" : "Đang áp dụng") : (isEn ? "Select Route" : "Chọn tuyến này")}</span>
                      </button>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
