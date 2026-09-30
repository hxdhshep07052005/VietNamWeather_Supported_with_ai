/**
 * Phase 8/9 Route Planner Page
 * Weather-aware multi-alternative route planning with Free & Pro tier differentiation
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Crown,
  Zap,
  ShieldCheck,
  Ruler,
  Sparkles,
  Navigation,
  Bookmark,
  Info,
  MapPin,
  RotateCcw,
  Check,
  Trash2,
  Scale,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import { routeApi } from "@/api/client";
import { PROVINCE_MAP } from "@/data/provinces";
import { RouteInteractiveMap } from "@/components/map/RouteInteractiveMap";
import { useReportProvinceWeather } from "@/hooks/useReportProvinceWeather";
import { RouteScore, routeScoreDescription } from "@/components/route/RouteScore";
import { RestStops } from "@/components/route/RestStops";
import { RouteWeatherTimeline, type RouteCheckpoint } from "@/components/route/RouteWeatherTimeline";
import type { RouteAlternative as ApiRouteAlternative, SamplePoint, SegmentRisk, RouteResponse } from "@vietnam-weather/contracts";
import { formatRiskScore, reportMeasurements, riskReasonText } from "@/utils/reportRisk";
import {
  CarIcon,
  MotorcycleIcon,
  RiskIcon,
} from "@/components/ui/Icons";
import styles from "./RoutePlannerPage.module.css";

interface RouteAlternative {
  id: string;
  type: "fastest" | "weather_safer" | "shortest";
  titleVi: string;
  titleEn: string;
  distanceKm: number;
  durationMinutes: number;
  riskScore: number | null;
  riskLevel: "low" | "caution" | "high" | "unknown";
  provisionalRisk?: boolean;
  riskCoveragePercent?: number;
  routeScore: number | null;
  scoreRiskLevel: "low" | "caution" | "high" | "unknown";
  rainExposureKm: number | null;
  weatherSummaryVi: string;
  weatherSummaryEn: string;
  checkpoints: RouteCheckpoint[];
  segmentRisks: SegmentRisk[];
  dangerousCheckpointCount: number;
  unknownCheckpointCount: number;
  isProOnly: boolean;
  coordinates?: [number, number][];
}

type BackendSamplePoint = SamplePoint;
type BackendRouteAlternative = ApiRouteAlternative;
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
  const { user, isAuthenticated, saveRoute, incrementRouteCount } = useAuthStore();
  const { openModal } = useRequireLoginModal();
  const provinceWeather = useReportProvinceWeather(0);

  const isPro = user?.plan === "pro";
  const dailyQuotaMax = isPro ? 30 : 3;
  const remainingQuota = Math.max(0, dailyQuotaMax - (user?.dailyRouteCount || 0));

  // Form State
  const [origin, setOrigin] = useState("Hà Nội");
  const [originCoordinates, setOriginCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoordinates, setDestinationCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destination, setDestination] = useState(() => {
    const query = searchParams.get("to");
    return PROVINCES_LIST.find(p => p.name.toLowerCase() === query?.toLowerCase() || p.code.toLowerCase() === query?.toLowerCase())?.name ?? query ?? "Lào Cai";
  });
  const [vehicle, setVehicle] = useState<"car" | "motorcycle">("car");
  const [departureTime, setDepartureTime] = useState("now");
  const [isPlanning, setIsPlanning] = useState(false);
  const [hasPlanned, setHasPlanned] = useState(false);
  const [selectedAltId, setSelectedAltId] = useState<string>("alt-weather_safer");
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number | null>(null);
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
      setDestinationCoordinates(null);
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
        (position) => {
          setOriginCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
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
    setOriginCoordinates(destinationCoordinates);
    setDestinationCoordinates(originCoordinates);
  };

  // Select Quick Preset
  const handleSelectPreset = (from: string, to: string) => {
    setOrigin(from);
    setOriginCoordinates(null);
    setDestination(to);
    setDestinationCoordinates(null);
  };

  // Handle Vehicle selection (Free vs Pro)
  const handleSelectVehicle = (selected: "car" | "motorcycle") => {
    if (selected === "motorcycle" && !isPro) {
      showToast("Tính năng đánh giá rủi ro gió tạt & trơn trượt riêng cho Xe máy chỉ dành cho gói PRO!");
      return;
    }
    setVehicle(selected);
  };

  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [weatherRefreshStatus, setWeatherRefreshStatus] = useState<"pending" | "waiting" | "unavailable" | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [restStops, setRestStops] = useState<RouteResponse["rest_stops"]>();
  const [planningError, setPlanningError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const routeInputKey = JSON.stringify([origin, destination, originCoordinates, destinationCoordinates, vehicle, departureTime]);
  const previousInputKey = useRef(routeInputKey);
  useEffect(() => {
    if (previousInputKey.current === routeInputKey) return;
    previousInputKey.current = routeInputKey;
    requestVersion.current += 1;
    setHasPlanned(false);
    setAlternatives([]);
    setRestStops(undefined);
    setWeatherRefreshStatus(null);
    setIsPlanning(false);
    setPlanningError(null);
  }, [routeInputKey]);

  // Map real backend RouteResponse alternatives into UI RouteAlternative model
  const mapBackendAlternatives = useCallback(
    (data: { alternatives?: BackendRouteAlternative[] } | null | undefined): RouteAlternative[] => {
      const alts = data?.alternatives || [];
      if (!alts.length) return [];

      return alts.map((alt) => {
        const type = (alt.alternative_type || "fastest") as "fastest" | "weather_safer" | "shortest";
        const distanceKm = Math.max(1, Math.round((alt.geometry?.distance_meters || 0) / 1000));
        const durationMinutes = Math.max(1, Math.round((alt.geometry?.duration_seconds || 0) / 60));
        const provisionalRouteRisk = alt.route_risk.provisional;
        const provisionalRisk = alt.route_risk?.score == null && provisionalRouteRisk != null;
        const riskScore = alt.route_risk?.score != null ? Math.round(alt.route_risk.score * 100) : provisionalRouteRisk ? Math.round(provisionalRouteRisk.score * 100) : null;
        const riskLevel = alt.route_risk?.level === "high" ? "high" : alt.route_risk?.level === "caution" ? "caution" : alt.route_risk?.level === "low" ? "low" : "unknown";

        const titleVi =
          type === "weather_safer"
            ? "Ít rủi ro thời tiết hơn"
            : type === "fastest"
            ? "Nhanh nhất"
            : "Ngắn nhất";
        const titleEn =
          type === "weather_safer"
            ? "Weather-Safer"
            : type === "fastest"
            ? "Fastest"
            : "Shortest";

        const samplePoints = alt.sample_points || [];

        const selectedPoints: BackendSamplePoint[] = samplePoints;

        const checkpoints: RouteCheckpoint[] = selectedPoints.map((sp, idx: number) => {
          const dist = sp.distance_from_start_meters / 1000;
          const rawEtaMin = Math.round(sp.time_from_departure_seconds / 60);

          const h = Math.floor(rawEtaMin / 60);
          const m = rawEtaMin % 60;
          const elapsed = `+${h > 0 ? `${h}h ` : ""}${m}m`;
          const arrival = sp.eta ? new Date(sp.eta) : null;
          const eta = arrival && Number.isFinite(arrival.getTime())
            ? `${arrival.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })} ${arrival.toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })} (UTC+7, ${elapsed})`
            : elapsed;
          const etaShort = arrival && Number.isFinite(arrival.getTime())
            ? `${arrival.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })} · ${arrival.toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" })}`
            : elapsed;

          const defaultName =
            idx === 0
              ? `${origin} (${isEn ? "Departure" : "Xuất phát"})`
              : idx === selectedPoints.length - 1
              ? `${destination} (${isEn ? "Destination" : "Điểm đến"})`
              : (isEn ? `Weather sample · km ${Math.round(dist * 10) / 10}` : `Điểm thời tiết · km ${Math.round(dist * 10) / 10}`);

          const name = defaultName;

          const temp = sp.weather?.temperature_c ?? null;
          const condition = sp.weather ? (isEn ? (sp.weather.condition_code?.replace(/_/g, " ") ?? "Condition unavailable") : reportMeasurements(sp.weather).conditionText) : (isEn ? "Condition unavailable" : "Chưa có trạng thái thời tiết");
          const rainProb = sp.weather?.precipitation_probability_percent ?? null;
          const windKmh = sp.weather?.wind_kmh ?? null;
          const provisionalAssessment = sp.provisional_assessment;
          const strictAssessment = sp.assessment;
          const pointProvisional = (!strictAssessment || strictAssessment.level === "unknown") && provisionalAssessment?.display_score != null;
          const pointAssessment = pointProvisional ? provisionalAssessment : strictAssessment;
          const risk = pointAssessment?.level ?? "unknown";
          const note = pointAssessment?.reasons?.map(reason => riskReasonText(reason, isEn)).join("; ");

          return {
            name,
            distanceKm: dist,
            eta,
            etaShort,
            temp,
            condition,
            rainProb,
            windKmh,
            risk,
            note,
            riskScore: pointAssessment?.display_score == null ? undefined : Math.round(pointAssessment.display_score),
            provisional: pointProvisional,
            coveragePercent: pointProvisional ? provisionalRouteRisk?.coverage_percent : undefined,
            coordinates: [sp.coordinates.longitude, sp.coordinates.latitude],
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
          provisionalRisk,
          riskCoveragePercent: provisionalRouteRisk?.coverage_percent,
          routeScore: alt.balanced_score == null ? null : Math.round(alt.balanced_score * 100),
          scoreRiskLevel: riskLevel !== "unknown" || !provisionalRisk ? riskLevel
            : checkpoints.some(point => point.risk === "high") ? "high"
            : checkpoints.some(point => point.risk === "caution") ? "caution"
            : checkpoints.some(point => point.risk === "low") ? "low" : "unknown",
          rainExposureKm: null,
          weatherSummaryVi: alt.summary?.vi || "Chưa đủ dữ liệu",
          weatherSummaryEn: alt.summary?.en || "Insufficient data",
          checkpoints,
          segmentRisks: alt.segment_risks,
          dangerousCheckpointCount: alt.route_risk?.dangerous_checkpoint_count ?? samplePoints.filter(p => p.assessment?.evidence.some(e => e.severity >= 2)).length,
          unknownCheckpointCount: alt.route_risk?.unknown_checkpoint_count ?? samplePoints.filter(p => !p.assessment || p.assessment.severity === 0).length,
          isProOnly: !isPro && type === "shortest",
          coordinates: alt.geometry.coordinates.map(c => [c.longitude, c.latitude]),
        };
      });
    },
    [origin, destination, isPro, isEn]
  );

  // Execute Route Planning via Backend API
  const handlePlanRoute = useCallback(async (isInitial = false) => {
    if (!origin.trim() || !destination.trim()) {
      showToast("Vui lòng nhập đầy đủ Điểm xuất phát và Điểm đến!");
      return;
    }

    if (!isAuthenticated && !isInitial) {
      openModal(
        isEn ? "Safe Route Planning" : "Lập lộ trình an toàn thời tiết",
        isEn
          ? "Please sign in or create a free account to calculate weather-aware routes and check checkpoints on your route!"
          : "Vui lòng đăng nhập hoặc tạo tài khoản miễn phí để tính toán các tuyến theo dữ liệu thời tiết và cảnh báo trạm kiểm soát dọc đường!"
      );
      return;
    }

    if (!isInitial) {
      // Check quota for live user queries
      const quotaCheck = incrementRouteCount();
      if (!quotaCheck.allowed) {
        showToast(
          isPro
            ? "Bạn đã dùng hết 30 lượt tìm lộ trình hôm nay."
            : "Bạn đã dùng hết 3 lượt miễn phí hôm nay. Hãy nâng cấp Pro để có 30 lượt/ngày!"
        );
        return;
      }
    }

    const version = ++requestVersion.current;
    setIsPlanning(true);
    setPlanningError(null);
    setAlternatives([]);
    setRestStops(undefined);
    setWeatherRefreshStatus(null);

    let hasInterimResult = false;
    try {
      const selectedDeparture = new Date();
      if (departureTime === "morning") { selectedDeparture.setDate(selectedDeparture.getDate() + 1); selectedDeparture.setHours(6, 0, 0, 0); }
      else if (departureTime === "in-1h" || departureTime === "in-2h") selectedDeparture.setHours(selectedDeparture.getHours() + (departureTime === "in-1h" ? 1 : 2));
      const routeRequest = {
        origin: originCoordinates ? { coordinates: originCoordinates } : { query: origin },
        destination: destinationCoordinates ? { coordinates: destinationCoordinates } : { query: destination },
        vehicle_type: vehicle,
        departure_time: departureTime === "now" ? undefined : selectedDeparture.toISOString(),
      };
      for (let refreshAttempt = 0; refreshAttempt <= 6; refreshAttempt++) {
        if (!mountedRef.current || version !== requestVersion.current) return;
        const response = await routeApi.calculateRoutes(routeRequest);

        if (!mountedRef.current || version !== requestVersion.current) return;
        const routeResponse = response as { alternatives?: BackendRouteAlternative[]; recommended_alternative?: string | null; rest_stops?: RouteResponse["rest_stops"]; weather_refresh?: RouteResponse["weather_refresh"] };
        const mapped = mapBackendAlternatives(routeResponse);
        if (mapped.length > 0) {
          hasInterimResult = true;
          setAlternatives(mapped);
          setRestStops(routeResponse.rest_stops);
          setHasPlanned(true);
          setSelectedAltId(mapped.find(alternative => alternative.type === routeResponse.recommended_alternative)?.id ?? mapped[0]!.id);
          setSelectedCheckpointIndex(null);
        } else {
          throw new Error("Không tìm thấy dữ liệu lộ trình.");
        }
        if (routeResponse.weather_refresh?.status !== "pending") {
          setWeatherRefreshStatus(routeResponse.weather_refresh?.status === "unavailable" ? "unavailable" : null);
          break;
        }
        setWeatherRefreshStatus(refreshAttempt === 6 ? "waiting" : "pending");
        if (refreshAttempt === 6) break;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch {
      if (!mountedRef.current || version !== requestVersion.current) return;
      if (hasInterimResult) {
        setWeatherRefreshStatus("unavailable");
        return;
      }
      setAlternatives([]);
      setRestStops(undefined);
      setWeatherRefreshStatus(null);
      setHasPlanned(false);
      setPlanningError(isEn ? "Route unavailable. Please try again." : "Không tải được lộ trình. Vui lòng thử lại.");
    } finally {
      if (mountedRef.current && version === requestVersion.current) setIsPlanning(false);
    }
  }, [origin, destination, originCoordinates, destinationCoordinates, vehicle, departureTime, isPro, isEn, isAuthenticated, openModal, showToast, incrementRouteCount, mapBackendAlternatives]);

  const initialPlanStarted = useRef(false);
  useEffect(() => {
    if (initialPlanStarted.current) return;
    initialPlanStarted.current = true;
    void handlePlanRoute(true);
  }, [handlePlanRoute]);

  // Selected Alternative Object
  const currentSelectedAlt = useMemo<RouteAlternative | null>(() => {
    if (!alternatives.length) return null;
    return alternatives.find((a) => a.id === selectedAltId) ?? alternatives[0] ?? null;
  }, [alternatives, selectedAltId]);

  // Comparison Data between 3 alternatives
  const comparisonData = useMemo(() => {
    const safer = alternatives.find((a) => a.type === "weather_safer") || null;
    const fastest = alternatives.find((a) => a.type === "fastest") || null;
    const shortest = alternatives.find((a) => a.type === "shortest") || null;
    return { safer, fastest, shortest };
  }, [alternatives]);

  const saferAlt = comparisonData.safer;
  const fastestAlt = comparisonData.fastest;
  const shortestAlt = comparisonData.shortest;

  // Save Route Action
  const handleSaveCurrentRoute = () => {
    if (!isAuthenticated) {
      openModal(
        isEn ? "Save Travel Route" : "Lưu lộ trình di chuyển",
        isEn
          ? "Please sign in or create an account to save your routes and track real-time weather changes before departing!"
          : "Vui lòng đăng nhập hoặc tạo tài khoản để lưu trữ lộ trình này và theo dõi cập nhật thời tiết trước khi khởi hành!"
      );
      return;
    }
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
      {planningError && <p role="alert">{planningError}</p>}
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
                    onChange={(e) => {
                      setOrigin(e.target.value);
                      setOriginCoordinates(null);
                    }}
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
                    onChange={(e) => { setDestination(e.target.value); setDestinationCoordinates(null); }}
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
                onClick={() => void handlePlanRoute(false)}
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
              <section className={styles.alternativesCard} aria-labelledby="travel-alternatives-title">
                <div className={styles.resultsHeader}>
                  <div className={styles.resultsTitleRow}>
                    <div className={styles.resultsHeading}>
                      <h2 id="travel-alternatives-title" className={styles.resultsTitle}>{isEn ? "Travel Alternatives" : "Phương án di chuyển"}</h2>
                    <button
                      type="button"
                      onClick={() => {
                        requestVersion.current += 1;
                        setIsPlanning(false);
                        setWeatherRefreshStatus(null);
                        setHasPlanned(false);
                        setSelectedCheckpointIndex(null);
                        setSelectedAltId("alt-weather_safer");
                        showToast(isEn ? "Route cleared and map reset." : "Đã hủy lộ trình và làm mới bản đồ.");
                      }}
                      className={styles.clearRouteBtn}
                      title={isEn ? "Clear route and reset map" : "Hủy toàn bộ lộ trình và làm mới bản đồ"}
                    >
                      <Trash2 size={12} />
                      <span>{isEn ? "Clear Route" : "Hủy lộ trình"}</span>
                    </button>
                    </div>
                    <span className={styles.resultsCount}>
                      {isEn ? `${alternatives.length} ${alternatives.length === 1 ? "alternative" : "alternatives"}` : `${alternatives.length} phương án`}
                    </span>
                  </div>
              </div>

              {weatherRefreshStatus && <p role="status" className={styles.resultsMetaText}>{weatherRefreshStatus === "pending" ? (isEn ? "Refreshing weather along the route… Assessment will update automatically." : "Đang bổ sung thời tiết dọc tuyến… Đánh giá sẽ tự động cập nhật.") : weatherRefreshStatus === "waiting" ? (isEn ? "Weather refresh is still processing. Use Find Safe Route again to check progress." : "Dữ liệu thời tiết vẫn đang được xử lý. Bấm tìm lộ trình lần nữa để cập nhật.") : (isEn ? "Weather refresh is unavailable. Missing sections remain unknown." : "Chưa thể bổ sung dữ liệu thời tiết. Các đoạn thiếu dữ liệu vẫn chưa xác định.")}</p>}
              {!saferAlt && (
                <p className={styles.resultsMetaText} role="status">
                  {alternatives.every(alternative => alternative.riskScore === null)
                    ? (isEn ? "Weather-Safer unavailable: weather coverage is incomplete along the candidate routes." : "Chưa thể đề xuất tuyến ít rủi ro thời tiết: dữ liệu chưa phủ đầy đủ các tuyến.")
                    : (isEn ? "Weather-Safer unavailable: the routing provider returned no distinct eligible road to compare." : "Chưa thể đề xuất tuyến ít rủi ro thời tiết: nhà cung cấp chưa trả về tuyến khác đủ điều kiện để so sánh.")}
                </p>
              )}
              <p className={styles.resultsMetaText}>
                {isEn ? "Combined score: lower is better. Color shows weather risk." : "Điểm tổng hợp: càng thấp càng tốt. Màu thể hiện rủi ro thời tiết."}
              </p>
              {/* Vertical Stack of Alternative Cards */}
              <div className={styles.alternativesStack}>
                {alternatives.map((alt) => {
                  const isSelected = selectedAltId === alt.id;

                  return (
                    <article
                      key={alt.id}
                      className={`${styles.altCard} ${isSelected ? styles.altCardSelected : ""}`}
                      data-route-type={alt.type}
                      title={routeScoreDescription({ score: alt.routeScore, level: alt.scoreRiskLevel, provisional: alt.provisionalRisk, coveragePercent: alt.riskCoveragePercent, isEn })}
                    >
                        {/* Top Bar */}
                        <div className={styles.cardTop}>
                          <button
                            type="button"
                            className={styles.altBadge}
                            aria-pressed={isSelected}
                            aria-label={isEn ? `Select ${alt.titleEn} route` : `Chọn tuyến ${alt.titleVi}`}
                            aria-describedby={`${alt.id}-metrics`}
                            onClick={() => {
                              setSelectedAltId(alt.id);
                              setSelectedCheckpointIndex(null);
                            }}
                          >
                            {alt.type === "weather_safer" && <ShieldCheck size={14} />}
                            {alt.type === "fastest" && <Zap size={14} />}
                            {alt.type === "shortest" && <Ruler size={14} />}
                            <span>{isEn ? alt.titleEn : alt.titleVi}</span>
                          </button>

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
                        <div id={`${alt.id}-metrics`} className={styles.cardMetrics}>
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
                          <RouteScore id={`${alt.id}-score`} score={alt.routeScore} level={alt.scoreRiskLevel} provisional={alt.provisionalRisk} coveragePercent={alt.riskCoveragePercent} isEn={isEn} />
                        </div>

                        {/* Summary */}
                        <div className={styles.cardWeatherSummary}>
                          {alt.provisionalRisk && <span>{isEn ? "Provisional" : "Tạm tính"}{alt.riskCoveragePercent == null ? "" : (isEn ? ` · Weather coverage: ${alt.riskCoveragePercent}%` : ` · Độ phủ thời tiết: ${alt.riskCoveragePercent}%`)}</span>}
                          <span>{isEn ? alt.weatherSummaryEn : alt.weatherSummaryVi}</span>
                          {alt.type === "weather_safer" && alternatives.some(other => other.type !== "weather_safer" && JSON.stringify(other.coordinates) === JSON.stringify(alt.coordinates)) && (
                            <span>{isEn ? "Uses the same road as another option; selected by the combined risk, time and distance score." : "Cùng đường với một phương án khác; được chọn theo điểm tổng hợp rủi ro, thời gian và khoảng cách."}</span>
                          )}
                        </div>

                      </article>
                    );
                  })}
                </div>
              </section>

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
                    {isEn ? currentSelectedAlt.weatherSummaryEn : currentSelectedAlt.weatherSummaryVi}
                    <p>{isEn ? "Checkpoints with Caution/High evidence" : "Điểm có bằng chứng Chú ý/Cao"}: {currentSelectedAlt.dangerousCheckpointCount}; {isEn ? "Unknown checkpoints" : "Điểm chưa đủ dữ liệu"}: {currentSelectedAlt.unknownCheckpointCount}</p>
                  </div>
                </div>
              </div>

              <RestStops stops={restStops} isEn={isEn} />

              {/* Checkpoints Timeline Mode */}
              <div className={styles.timelineCard}>
                <div className={styles.timelineTitle}>
                  <div className={styles.timelineTitleLeft}>
                    <span>
                      {isEn ? "Weather along your route:" : "Thời tiết dọc tuyến:"}{" "}
                      <strong>{isEn ? currentSelectedAlt.titleEn : currentSelectedAlt.titleVi}</strong>
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedCheckpointIndex !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedCheckpointIndex(null)}
                        className={styles.clearCheckpointBtn}
                        title={isEn ? "Deselect weather point to view the full route" : "Bỏ chọn điểm thời tiết để xem toàn tuyến"}
                      >
                        <RotateCcw size={12} />
                        <span>{isEn ? "View full route" : "Xem toàn tuyến"}</span>
                      </button>
                    )}
                    <button type="button" onClick={handleSaveCurrentRoute} className={styles.saveBtn}>
                      <Bookmark size={14} />
                      <span>{isEn ? "Save route" : "Lưu tuyến"}</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 10px 0" }}>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {isEn ? `${currentSelectedAlt.checkpoints.length} weather points` : `${currentSelectedAlt.checkpoints.length} điểm thời tiết`}
                  </span>
                  <a
                    href="#comparison-matrix"
                    style={{ fontSize: "12px", color: "var(--color-primary, #0066cc)", textDecoration: "none", fontWeight: 600 }}
                  >
                    {isEn ? "Compare routes" : "So sánh các tuyến"}
                  </a>
                </div>

                <RouteWeatherTimeline
                  checkpoints={currentSelectedAlt.checkpoints}
                  selectedIndex={selectedCheckpointIndex}
                  onSelect={setSelectedCheckpointIndex}
                  isEn={isEn}
                />
              </div>
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
              provinces={provinceWeather}
              hasPlanned={hasPlanned}
              originName={origin === "Hà Nội" && isEn ? "Hanoi" : origin}
              destinationName={destination === "Lào Cai" && isEn ? "Lao Cai" : destination}
              checkpoints={hasPlanned && currentSelectedAlt ? currentSelectedAlt.checkpoints : []}
              segmentRisks={currentSelectedAlt?.segmentRisks}
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
        <div id="comparison-matrix" className={styles.fullWidthComparisonSection}>
          <div className={styles.comparisonHeader}>
            <div className={styles.comparisonTitleRow}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Scale size={20} color="var(--color-primary)" />
                <h3 className={styles.comparisonTitle}>
                  {isEn
                    ? `Multi-Criteria ${alternatives.length}-Alternative Corridor Comparison (${origin === "Hà Nội" ? "Hanoi" : origin} → ${destination === "Lào Cai" ? "Lao Cai" : destination})`
                    : `Bảng đối sánh đa tiêu chí ${alternatives.length} phương án di chuyển hành lang (${origin} → ${destination})`}
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
                   <td className={styles.colSafer}>{isEn ? saferAlt.weatherSummaryEn : saferAlt.weatherSummaryVi}</td>
                   <td className={styles.colFastest}>{isEn ? fastestAlt.weatherSummaryEn : fastestAlt.weatherSummaryVi}</td>
                   {shortestAlt && <td className={styles.colShortest}>{isEn ? shortestAlt.weatherSummaryEn : shortestAlt.weatherSummaryVi}</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Total Distance" : "Tổng quãng đường"}</td>
                   <td className={styles.colSafer}><strong>{saferAlt.distanceKm} km</strong></td>
                  <td className={styles.colFastest}><strong>{fastestAlt.distanceKm} km</strong> ({isEn ? "Baseline distance" : "Khoảng cách chuẩn"})</td>
                   {shortestAlt && <td className={styles.colShortest}><strong>{shortestAlt.distanceKm} km</strong></td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Estimated Duration (ETA)" : "Thời gian dự kiến (ETA)"}</td>
                  <td className={styles.colSafer}>
                     <strong>{Math.floor(saferAlt.durationMinutes / 60)}h {saferAlt.durationMinutes % 60}m</strong>
                  </td>
                  <td className={styles.colFastest}>
                    <strong>{Math.floor(fastestAlt.durationMinutes / 60)}h {fastestAlt.durationMinutes % 60}m</strong> ({isEn ? "Fastest" : "Nhanh nhất"})
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest}>
                       <strong>{Math.floor(shortestAlt.durationMinutes / 60)}h {shortestAlt.durationMinutes % 60}m</strong>
                    </td>
                  )}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Meteorological Risk Score" : "Chỉ số rủi ro khí tượng"}</td>
                  <td className={styles.colSafer}>
                     <span className={styles.riskScoreBadge}>{saferAlt.provisionalRisk ? (isEn ? "Provisional · " : "Tạm tính · ") : ""}{formatRiskScore(saferAlt.riskScore == null ? null : saferAlt.riskScore / 100, isEn)}</span>
                  </td>
                  <td className={styles.colFastest}>
                     <span className={styles.riskScoreBadge}>{fastestAlt.provisionalRisk ? (isEn ? "Provisional · " : "Tạm tính · ") : ""}{formatRiskScore(fastestAlt.riskScore == null ? null : fastestAlt.riskScore / 100, isEn)}</span>
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest}>
                       <span className={styles.riskScoreBadge}>{shortestAlt.provisionalRisk ? (isEn ? "Provisional · " : "Tạm tính · ") : ""}{formatRiskScore(shortestAlt.riskScore == null ? null : shortestAlt.riskScore / 100, isEn)}</span>
                    </td>
                  )}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Severe Weather Exposure" : "Phơi nhiễm thời tiết cực đoan"}</td>
                   <td className={styles.colSafer}>—</td>
                   <td className={styles.colFastest}>—</td>
                   {shortestAlt && <td className={styles.colShortest}>—</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Visibility & Road Condition" : "Tầm nhìn & Trạng thái đường"}</td>
                   <td className={styles.colSafer}>—</td>
                   <td className={styles.colFastest}>—</td>
                   {shortestAlt && <td className={styles.colShortest}>—</td>}
                </tr>
                <tr>
                  <td className={styles.comparisonCriteriaCell}>{isEn ? "Pareto Optimal Evaluation" : "Đánh giá tối ưu Pareto"}</td>
                  <td className={styles.colSafer} style={{ color: "#10B981", fontWeight: 700 }}>
                     {isEn ? saferAlt.weatherSummaryEn : saferAlt.weatherSummaryVi}
                  </td>
                  <td className={styles.colFastest} style={{ color: "#EF4444", fontWeight: 600 }}>
                     {isEn ? fastestAlt.weatherSummaryEn : fastestAlt.weatherSummaryVi}
                  </td>
                  {shortestAlt && (
                    <td className={styles.colShortest} style={{ color: "#F59E0B", fontWeight: 600 }}>
                       {isEn ? shortestAlt.weatherSummaryEn : shortestAlt.weatherSummaryVi}
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
