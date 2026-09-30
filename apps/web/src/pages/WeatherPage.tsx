/**
 * Dedicated National Weather Overview Page (63 Provinces)
 * Features:
 * - Interactive Forecast Timeline Slider with draggable points & auto-play
 * - National meteorological statistics (Avg Temp, Hot/Cool spots, Risk distribution)
 * - Multi-dimensional filtering (Search, Region, Risk Level, Condition, Sort)
 * - Grid & Matrix Table view toggles
 * - Detailed Weather Modal with 24-hour hourly trend & AI Safety Advisories
 * - Zero emojis — strictly lucide-react icons
 */

import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Haze,
  Wind,
  Thermometer,
  Droplets,
  Eye,
  Compass,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  X,
  SlidersHorizontal,
  Sparkles,
  MapPin,
  Navigation,
  LayoutGrid,
  Table as TableIcon,
  Info,
  Clock,
  RefreshCw,
  Lock,
} from "lucide-react";
import { type ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { VIETNAM_REGIONS } from "@/data/provinces";
import { useReportProvinceWeather } from "@/hooks/useReportProvinceWeather";
import { forecastHours, useProvinceWeather, weatherStateText } from "@/hooks/useProvinceWeather";
import { formatMeasurement as measurement, riskReasonText, weatherConditionText, generalRiskNote } from "@/utils/reportRisk";
import { ForecastTimelineSlider } from "@/components/common/ForecastTimelineSlider";
import { RiskEvidenceWarnings } from "@/components/common/RiskEvidenceWarnings";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import styles from "./WeatherPage.module.css";

// Helper for Weather Condition Icon
function renderWeatherIcon(conditionCode: string, size = 20) {
  switch (conditionCode) {
    case "clear":
      return <Sun size={size} color="#f59e0b" />;
    case "partly_cloudy":
      return <CloudSun size={size} color="#60a5fa" />;
    case "haze":
    case "smoke":
    case "smog":
      return <Haze size={size} color="#94a3b8" />;
    case "dust":
    case "dust_storm":
    case "sandstorm":
      return <Wind size={size} color="#d97706" />;
    case "fog":
    case "snow":
    case "hail":
    case "cloudy":
      return <Cloud size={size} color="#94a3b8" />;
    case "drizzle":
    case "sleet":
    case "rain":
      return <CloudRain size={size} color="#38bdf8" />;
    case "heavy_rain":
    case "thunderstorm":
      return <CloudLightning size={size} color="#818cf8" />;
    default:
      return <Info size={size} />;
  }
}

function rainChance(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? `${measurement(value)}%` : "—";
}

export function WeatherPage() {
  const { t, i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");
  const { isAuthenticated } = useAuthStore();
  const { openModal } = useRequireLoginModal();

  // Timeline offset state (0 = current, 1..72h)
  const [timelineOffsetHours, setTimelineOffsetHours] = useState(0);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name_asc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Selected province for detail modal
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);

  const allProvinces = useReportProvinceWeather(timelineOffsetHours);
  const selectedProvince = allProvinces.find(p => p.id === selectedProvinceId) ?? null;
  const forecast = useProvinceWeather({
    latitude: selectedProvince?.latitude,
    longitude: selectedProvince?.longitude,
    includeForecast: true,
    enabled: Boolean(selectedProvince) && isAuthenticated,
  });
  const hourlyForecast = forecastHours(forecast.hourly, 24, selectedProvince?.weatherTargetTime ? Date.parse(selectedProvince.weatherTargetTime) : Date.now() + timelineOffsetHours * 3600000);
  const unknownRiskText = isEn ? "Unknown — insufficient evidence" : "Chưa đủ bằng chứng đánh giá";

  // National weather statistics
  const stats = useMemo(() => {
    if (allProvinces.length === 0) {
      return { avgTemp: NaN, hottest: null, coolest: null, lowCount: 0, cautionCount: 0, highCount: 0 };
    }

    const measured = allProvinces.filter(p => Number.isFinite(p.temp));
    let totalTemp = 0;
    let hottest: ProvinceGeoFeatureProperties | null = measured[0] ?? null;
    let coolest: ProvinceGeoFeatureProperties | null = measured[0] ?? null;
    let lowCount = 0;
    let cautionCount = 0;
    let highCount = 0;

    for (const p of allProvinces) {
      if (Number.isFinite(p.temp)) totalTemp += p.temp;
      if (hottest && p.temp > hottest.temp) hottest = p;
      if (coolest && p.temp < coolest.temp) coolest = p;
      if (p.riskLevel === "low") lowCount++;
      else if (p.riskLevel === "caution") cautionCount++;
      else if (p.riskLevel === "high") highCount++;
    }

    return {
      avgTemp: measured.length ? Math.round((totalTemp / measured.length) * 10) / 10 : NaN,
      hottest,
      coolest,
      lowCount,
      cautionCount,
      highCount,
    };
  }, [allProvinces]);

  // Filter and sort provinces
  const filteredProvinces = useMemo(() => {
    return allProvinces
      .filter((p) => {
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(query);
          const matchRegion = p.regionVi.toLowerCase().includes(query);
          const matchCondition = p.conditionText.toLowerCase().includes(query);
          if (!matchName && !matchRegion && !matchCondition) return false;
        }

        // Region filter
        if (regionFilter !== "all") {
          if (regionFilter === "North") {
            const isNorth = ["Tây Bắc", "Đông Bắc", "Đồng bằng sông Hồng"].some((r) =>
              p.regionVi.includes(r)
            );
            if (!isNorth) return false;
          } else if (regionFilter === "Central") {
            const isCentral = [
              "Bắc Trung Bộ",
              "Duyên hải Nam Trung Bộ",
              "Tây Nguyên",
              "Nam Trung Bộ",
            ].some((r) => p.regionVi.includes(r));
            if (!isCentral) return false;
          } else if (regionFilter === "South") {
            const isSouth = ["Đông Nam Bộ", "Đồng bằng sông Cửu Long", "Tây Nam Bộ"].some((r) =>
              p.regionVi.includes(r)
            );
            if (!isSouth) return false;
          } else {
            if (!p.regionVi.includes(regionFilter)) return false;
          }
        }

        // Risk filter
        if (riskFilter !== "all" && p.riskLevel !== riskFilter) {
          return false;
        }

        // Condition filter
        if (conditionFilter !== "all") {
          if (conditionFilter === "rain" && p.conditionCode !== "rain" && p.conditionCode !== "heavy_rain") {
            return false;
          }
          if (conditionFilter === "thunderstorm" && p.conditionCode !== "thunderstorm") return false;
          if (conditionFilter === "clear" && p.conditionCode !== "clear") return false;
          if (conditionFilter === "cloudy" && p.conditionCode !== "cloudy" && p.conditionCode !== "partly_cloudy") {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name_asc":
            return a.name.localeCompare(b.name, "vi");
          case "name_desc":
            return b.name.localeCompare(a.name, "vi");
          case "temp_desc":
            return b.temp - a.temp;
          case "temp_asc":
            return a.temp - b.temp;
          case "risk_desc":
            return (b.riskScore ?? -1) - (a.riskScore ?? -1);
          case "rain_desc":
            return (Number.isFinite(b.rainProbabilityPercent) ? b.rainProbabilityPercent! : -1) - (Number.isFinite(a.rainProbabilityPercent) ? a.rainProbabilityPercent! : -1);
          case "wind_desc":
            return b.windSpeedKmh - a.windSpeedKmh;
          default:
            return 0;
        }
      });
  }, [allProvinces, searchQuery, regionFilter, riskFilter, conditionFilter, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    regionFilter !== "all" ||
    riskFilter !== "all" ||
    conditionFilter !== "all" ||
    sortBy !== "name_asc";

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setRegionFilter("all");
    setRiskFilter("all");
    setConditionFilter("all");
    setSortBy("name_asc");
  }, []);

  return (
    <div className={styles.weatherPage}>
      <div className={styles.container}>
        {/* ==================================================================
            Hero & Summary Header
            ================================================================== */}
        <div className={styles.heroSection}>
          <div className={styles.heroHeader}>
            <div className={styles.heroTitleArea}>
              <div className={styles.heroBadge}>
                <Sparkles size={14} />
                <span>{isEn ? "Nationwide 63 Provinces Meteorological Telemetry" : "Quan trắc khí tượng toàn quốc 63 tỉnh thành"}</span>
              </div>
              <h1 className={styles.heroTitle}>{isEn ? "Vietnam 63 Provinces Weather Directory" : (t("weatherPage.title") || "Thời tiết 63 Tỉnh Thành Toàn Quốc")}</h1>
              <p className={styles.heroSubtitle}>
                {isEn
                  ? "Weather observations and available forecasts along an interactive timeline"
                  : "Dữ liệu quan trắc và dự báo hiện có theo dòng thời gian tương tác"}
              </p>
            </div>

            <div className={styles.quickActions}>
              <Link to="/map" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                <MapPin size={16} />
                <span>{isEn ? "Open Digital Map" : "Xem bản đồ số"}</span>
              </Link>
              <Link to="/route" className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}>
                <Navigation size={16} />
                <span>{isEn ? "Plan Route" : "Lập lộ trình"}</span>
              </Link>
            </div>
          </div>

          {/* National Stats Grid */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <Thermometer size={16} />
                <span>{isEn ? "Average Temp" : "Nhiệt độ trung bình"}</span>
              </div>
              <div className={styles.statValue}>{measurement(stats.avgTemp)}°C</div>
              <div className={styles.statSubtext}>{isEn ? "Provinces with available measurements" : "Các tỉnh có số liệu hiện có"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <Sun size={16} color="#f59e0b" />
                <span>{isEn ? "Warmest Locality" : "Nơi nóng nhất"}</span>
              </div>
              <div className={styles.statValue}>
                {stats.hottest ? `${stats.hottest.temp}°C` : "--"}
              </div>
              <div className={styles.statSubtext}>{stats.hottest?.name || "--"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <Wind size={16} color="#38bdf8" />
                <span>{isEn ? "Coolest Locality" : "Nơi mát nhất"}</span>
              </div>
              <div className={styles.statValue}>
                {stats.coolest ? `${stats.coolest.temp}°C` : "--"}
              </div>
              <div className={styles.statSubtext}>{stats.coolest?.name || "--"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <ShieldCheck size={16} color="#22c55e" />
                <span>{isEn ? "Low risk" : "Rủi ro thấp"}</span>
              </div>
              <div className={styles.statValue} style={{ color: "#4ade80" }}>
                {stats.lowCount}
              </div>
              <div className={styles.statSubtext}>{isEn ? "Completed low-risk assessments" : "Đánh giá đủ dữ liệu ở mức thấp"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span>{isEn ? "Caution Zone" : "Cần theo dõi"}</span>
              </div>
              <div className={styles.statValue} style={{ color: "#fbbf24" }}>
                {stats.cautionCount}
              </div>
              <div className={styles.statSubtext}>{isEn ? "Completed caution assessments" : "Đánh giá đủ dữ liệu cần chú ý"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <ShieldAlert size={16} color="#ef4444" />
                <span>{isEn ? "High Risk" : "Rủi ro cao"}</span>
              </div>
              <div className={styles.statValue} style={{ color: "#f87171" }}>
                {stats.highCount}
              </div>
              <div className={styles.statSubtext}>{isEn ? "Completed high-risk assessments" : "Đánh giá đủ dữ liệu ở mức cao"}</div>
            </div>
          </div>

          {/* Interactive Timeline Slider with draggable points */}
          <div className={styles.timelineSliderWrapper}>
            <ForecastTimelineSlider
              value={timelineOffsetHours}
              onChange={(val) => setTimelineOffsetHours(val)}
            />
          </div>
        </div>

        {/* ==================================================================
            Filter & Search Toolbar
            ================================================================== */}
        <div className={styles.toolbarSection}>
          <div className={styles.searchSortRow}>
            {/* Search Box */}
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? "Search province, city, region or atmospheric condition..." : "Tìm tỉnh, thành phố, vùng miền hoặc kiểu thời tiết..."}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery("")}
                  title={isEn ? "Clear search" : "Xóa tìm kiếm"}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Right Controls */}
            <div className={styles.controlsRight}>
              {/* Sort Selector */}
              <div className={styles.sortDropdownWrapper}>
                <SlidersHorizontal size={14} />
                <span>{isEn ? "Sort:" : "Sắp xếp:"}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={styles.sortSelect}
                >
                  <option value="name_asc">{isEn ? "Province name (A - Z)" : "Tên tỉnh (A - Z)"}</option>
                  <option value="name_desc">{isEn ? "Province name (Z - A)" : "Tên tỉnh (Z - A)"}</option>
                  <option value="temp_desc">{isEn ? "Temperature (High - Low)" : "Nhiệt độ (Cao - Thấp)"}</option>
                  <option value="temp_asc">{isEn ? "Temperature (Low - High)" : "Nhiệt độ (Thấp - Cao)"}</option>
                  <option value="risk_desc">{isEn ? "Highest risk score" : "Mức độ rủi ro cao nhất"}</option>
                  <option value="rain_desc">{isEn ? "Highest rain probability" : "Xác suất mưa cao nhất"}</option>
                  <option value="wind_desc">{isEn ? "Strongest wind speed" : "Tốc độ gió mạnh nhất"}</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className={styles.viewModeToggle}>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${viewMode === "grid" ? styles.viewModeBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                  title={isEn ? "Grid card view" : "Dạng thẻ lưới"}
                >
                  <LayoutGrid size={15} />
                  <span>{isEn ? "Grid" : "Dạng thẻ"}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewModeBtn} ${viewMode === "table" ? styles.viewModeBtnActive : ""}`}
                  onClick={() => setViewMode("table")}
                  title={isEn ? "Table data view" : "Dạng bảng dữ liệu"}
                >
                  <TableIcon size={15} />
                  <span>{isEn ? "Table" : "Dạng bảng"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className={styles.filterPillsRow}>
            {/* Regions */}
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>{isEn ? "Region:" : "Vùng miền:"}</span>
              <div className={styles.filterChipsList}>
                {[
                  { label: isEn ? "All (63)" : "Tất cả (63)", value: "all" },
                  { label: isEn ? "Northern" : "Miền Bắc", value: "North" },
                  { label: isEn ? "Central" : "Miền Trung", value: "Central" },
                  { label: isEn ? "Southern" : "Miền Nam", value: "South" },
                  { label: isEn ? "Central Highlands" : "Tây Nguyên", value: "Tây Nguyên" },
                  { label: isEn ? "Mekong Delta" : "ĐBSCL", value: "Cửu Long" },
                ].map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    className={`${styles.filterChip} ${regionFilter === chip.value ? styles.filterChipActive : ""}`}
                    onClick={() => setRegionFilter(chip.value)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Level */}
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>{isEn ? "Risk Tier:" : "Mức rủi ro:"}</span>
              <div className={styles.filterChipsList}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${riskFilter === "all" ? styles.filterChipActive : ""}`}
                  onClick={() => setRiskFilter("all")}
                >
                  {isEn ? `All (${allProvinces.length})` : `Tất cả (${allProvinces.length})`}
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${styles.filterChipSafe} ${riskFilter === "low" ? styles.filterChipActive : ""}`}
                  onClick={() => setRiskFilter("low")}
                >
                  <ShieldCheck size={13} />
                  <span>{isEn ? `Low (${stats.lowCount})` : `Thấp (${stats.lowCount})`}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${styles.filterChipCaution} ${riskFilter === "caution" ? styles.filterChipActive : ""}`}
                  onClick={() => setRiskFilter("caution")}
                >
                  <AlertTriangle size={13} />
                  <span>{isEn ? `Caution (${stats.cautionCount})` : `Cần chú ý (${stats.cautionCount})`}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${styles.filterChipHighRisk} ${riskFilter === "high" ? styles.filterChipActive : ""}`}
                  onClick={() => setRiskFilter("high")}
                >
                  <ShieldAlert size={13} />
                  <span>{isEn ? `High Risk (${stats.highCount})` : `Rủi ro cao (${stats.highCount})`}</span>
                </button>
              </div>
            </div>

            {/* Condition Filter */}
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>{isEn ? "Condition:" : "Thời tiết:"}</span>
              <div className={styles.filterChipsList}>
                {[
                  { label: isEn ? "All" : "Tất cả", value: "all", icon: null },
                  { label: isEn ? "Clear" : "Nắng ráo", value: "clear", icon: <Sun size={12} color="#f59e0b" /> },
                  { label: isEn ? "Cloudy" : "Có mây", value: "cloudy", icon: <CloudSun size={12} color="#60a5fa" /> },
                  { label: isEn ? "Rain" : "Mưa rào", value: "rain", icon: <CloudRain size={12} color="#38bdf8" /> },
                  { label: isEn ? "Thunderstorm" : "Dông sét", value: "thunderstorm", icon: <CloudLightning size={12} color="#818cf8" /> },
                ].map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    className={`${styles.filterChip} ${conditionFilter === chip.value ? styles.filterChipActive : ""}`}
                    onClick={() => setConditionFilter(chip.value)}
                  >
                    {chip.icon}
                    <span>{chip.label}</span>
                  </button>
                ))}

                {hasActiveFilters && (
                  <button
                    type="button"
                    className={styles.resetFiltersBtn}
                    onClick={handleResetFilters}
                  >
                    <RefreshCw size={12} />
                    <span>{isEn ? "Reset filters" : "Đặt lại bộ lọc"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results Count Bar */}
        <div className={styles.resultsBar}>
          <div>
            {isEn ? `Showing ${filteredProvinces.length} of 63 provinces` : `Hiển thị ${filteredProvinces.length} trên tổng số 63 tỉnh thành`}
            {timelineOffsetHours > 0 && (isEn ? ` • Forecast +${timelineOffsetHours}h` : ` • Dự báo +${timelineOffsetHours}h tới`)}
            <p role="status">{allProvinces.some(p => p.dataState === "loading") ? (isEn ? "Loading weather…" : "Đang tải thời tiết…") : allProvinces.some(p => p.dataState === "error") ? (isEn ? "Some weather requests failed. Reload to retry." : "Một số truy vấn thời tiết thất bại. Tải lại để thử lại.") : (isEn ? "Incomplete assessments remain Unknown. Known evidence warnings are shown separately." : "Đánh giá thiếu bằng chứng vẫn là Chưa đủ dữ liệu. Cảnh báo từ bằng chứng đã biết được hiển thị riêng.")}</p>
          </div>
        </div>

        {/* ==================================================================
            Main Content: Grid or Table
            ================================================================== */}
        {viewMode === "grid" ? (
          <div className={styles.provinceGrid}>
            {filteredProvinces.map((p) => {
              const riskTier = p.riskLevel || "unknown";
              const riskColor =
                p.riskColor;
              const rainProb = rainChance(p.rainProbabilityPercent);

              return (
                <div key={p.code || p.name} className={styles.provinceCard}>
                  {/* Card Header */}
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleArea}>
                      <h3 className={styles.provinceName}>
                        <MapPin size={16} color="#60a5fa" />
                        <span>{p.name}</span>
                      </h3>
                      <span className={styles.regionBadge}>
                        {isEn ? (VIETNAM_REGIONS[p.region]?.en || p.region) : p.regionVi}
                      </span>
                    </div>

                    <div
                      className={`${styles.riskBadge} ${
                        riskTier === "high"
                          ? styles.riskBadgeHigh
                          : riskTier === "caution"
                          ? styles.riskBadgeCaution
                          : riskTier === "low" ? styles.riskBadgeLow : ""
                      }`}
                    >
                      {riskTier === "high" ? (
                        <ShieldAlert size={12} />
                      ) : riskTier === "caution" ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Info size={12} />
                      )}
                      <span>
                        {riskTier === "high" ? (isEn ? "High Risk" : "Nguy cơ cao") : riskTier === "caution" ? (isEn ? "Caution" : "Cần chú ý") : riskTier === "low" ? (isEn ? "Low" : "Thấp") : unknownRiskText}
                      </span>
                    </div>
                  </div>

                  {/* Main Weather Display */}
                  <div className={styles.cardMainWeather}>
                    <div className={styles.weatherLeft}>
                      <div className={styles.weatherIconWrapper}>
                        {renderWeatherIcon(p.conditionCode, 24)}
                      </div>
                      <span className={styles.conditionText}>
                        {weatherConditionText(p.conditionCode, isEn)}
                      </span>
                    </div>

                    <div className={styles.tempRight}>
                      <div className={styles.temperature}>{measurement(p.temp)}°C</div>
                      <div className={styles.feelsLike}>{isEn ? `Feels like ${measurement(p.feelsLike)}°C` : `Cảm nhận ${measurement(p.feelsLike)}°C`}</div>
                    </div>
                  </div>

                  {/* Metrics Mini Grid */}
                  <div className={styles.metricsGrid}>
                    <div className={styles.metricItem}>
                      <Droplets size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "Humidity:" : "Độ ẩm:"}</span>
                      <span className={styles.metricVal}>{measurement(p.humidity)}%</span>
                    </div>

                    <div className={styles.metricItem}>
                      <Wind size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "Wind:" : "Gió:"}</span>
                      <span className={styles.metricVal}>{measurement(p.windSpeedKmh)} km/h</span>
                    </div>

                    <div className={styles.metricItem}>
                      <CloudRain size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "Rain chance (1h)" : "Xác suất mưa (1h)"}</span>
                      <span className={styles.metricVal}>{rainProb}</span>
                    </div>

                    <div className={styles.metricItem}>
                      <Sun size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "UV index:" : "Chỉ số UV:"}</span>
                      <span className={styles.metricVal}>{measurement(p.uvIndex)}</span>
                    </div>
                  </div>

                  {/* Risk Score Dimensions Progress */}
                  <div className={styles.riskDimensions}>
                    <p>{generalRiskNote(p.assessment, isEn)}</p>
                    <div className={styles.riskDimensionsHeader}>
                      <span>{isEn ? "Composite Risk Index" : "Chỉ số rủi ro tổng hợp"}</span>
                      <span style={{ color: riskColor, fontWeight: 700 }}>
                        {p.riskScore == null ? (isEn ? "Insufficient data" : "Chưa đủ dữ liệu") : `${p.riskScore} / 100`}
                      </span>
                    </div>
                    {p.riskScore != null && <div className={styles.riskBarContainer}>
                      <div
                        className={styles.riskBarFill}
                        style={{ width: `${p.riskScore}%`, backgroundColor: riskColor }}
                      />
                    </div>}
                    <RiskEvidenceWarnings evidence={p.assessment?.evidence} isEn={isEn} />
                  </div>

                  {/* Card Actions */}
                  <div className={styles.cardFooter}>
                    <button
                      type="button"
                      className={styles.detailBtn}
                      onClick={() => setSelectedProvinceId(p.id)}
                    >
                      <Info size={14} />
                      <span>{isEn ? "Details & 24h" : "Xem chi tiết & 24h"}</span>
                    </button>

                    <Link
                      to={`/map?lat=${p.latitude}&lng=${p.longitude}&province=${encodeURIComponent(p.name)}`}
                      className={styles.mapBtn}
                      title={isEn ? "View on Digital Map" : "Xem trên Bản đồ số"}
                    >
                      <MapPin size={16} />
                    </Link>

                    <Link
                      to={`/route?dest=${encodeURIComponent(p.name)}`}
                      className={styles.routeBtn}
                      title={isEn ? "Plan Route" : "Lập lộ trình di chuyển"}
                    >
                      <Navigation size={16} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table / Matrix View */
          <div className={styles.tableContainer}>
            <table className={styles.weatherTable}>
              <thead>
                <tr>
                  <th>{isEn ? "Province / City" : "Tỉnh / Thành phố"}</th>
                  <th>{isEn ? "Region" : "Vùng miền"}</th>
                  <th>{isEn ? "Weather" : "Thời tiết"}</th>
                  <th>{isEn ? "Temp" : "Nhiệt độ"}</th>
                  <th>{isEn ? "Humidity" : "Độ ẩm"}</th>
                  <th>{isEn ? "Wind Speed" : "Tốc độ gió"}</th>
                  <th>{isEn ? "Rain chance (1h)" : "Xác suất mưa (1h)"}</th>
                  <th>{isEn ? "Risk Level" : "Mức rủi ro"}</th>
                  <th>{isEn ? "Actions" : "Thao tác"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProvinces.map((p) => {
                  const riskTier = p.riskLevel || "unknown";
                  const rainProb = rainChance(p.rainProbabilityPercent);

                  return (
                    <tr key={p.code || p.name}>
                      <td>
                        <div className={styles.tableProvinceName}>
                          <MapPin size={14} color="#60a5fa" />
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td>{isEn ? (VIETNAM_REGIONS[p.region]?.en || p.region) : p.regionVi}</td>
                      <td>
                        <div className={styles.tableConditionCell}>
                          {renderWeatherIcon(p.conditionCode, 16)}
                          <span>
                            {weatherConditionText(p.conditionCode, isEn)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "#ffffff" }}>{measurement(p.temp)}°C</strong>
                      </td>
                      <td>{measurement(p.humidity)}%</td>
                      <td>{measurement(p.windSpeedKmh)} km/h</td>
                      <td>{rainProb}</td>
                      <td>
                        <span
                          className={`${styles.riskBadge} ${
                            riskTier === "high"
                              ? styles.riskBadgeHigh
                              : riskTier === "caution"
                              ? styles.riskBadgeCaution
                              : riskTier === "low" ? styles.riskBadgeLow : ""
                          }`}
                        >
                          {riskTier === "high" ? (isEn ? "High Risk" : "Nguy cơ cao") : riskTier === "caution" ? (isEn ? "Caution" : "Chú ý") : riskTier === "low" ? (isEn ? "Low" : "Thấp") : unknownRiskText}
                        </span>
                        {p.assessment?.evidence.some(e => e.severity >= 2) && <p>{isEn ? "Known caution/high evidence — see details" : "Có bằng chứng cần chú ý / nguy cơ cao — xem chi tiết"}</p>}
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            className={styles.detailBtn}
                            style={{ padding: "6px 10px" }}
                            onClick={() => setSelectedProvinceId(p.id)}
                          >
                            <span>{isEn ? "Details" : "Chi tiết"}</span>
                          </button>
                          <Link
                            to={`/map?lat=${p.latitude}&lng=${p.longitude}&province=${encodeURIComponent(p.name)}`}
                            className={styles.mapBtn}
                            title={isEn ? "View Map" : "Xem bản đồ"}
                          >
                            <MapPin size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================================================================
            Detail Modal with 24h Hourly Trend & Safety Advisory
            ================================================================== */}
        {selectedProvince && (
          <div className={styles.modalBackdrop} onClick={() => setSelectedProvinceId(null)}>
            <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label={selectedProvince.name} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitleArea}>
                  <h2 className={styles.modalTitle}>{selectedProvince.name}</h2>
                  <span className={styles.modalSubtitle}>
                    {isEn ? (VIETNAM_REGIONS[selectedProvince.region]?.en || selectedProvince.region) : selectedProvince.regionVi} • {selectedProvince.latitude.toFixed(2)}°N, {selectedProvince.longitude.toFixed(2)}°E
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  aria-label={isEn ? "Close details" : "Đóng chi tiết"}
                  onClick={() => setSelectedProvinceId(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <p>{generalRiskNote(selectedProvince.assessment, isEn)}</p>
                {selectedProvince.weatherTargetTime && <p>{isEn ? "Selected time: " : "Thời điểm đã chọn: "}{new Date(selectedProvince.weatherTargetTime).toLocaleString(isEn ? "en-US" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>}
                {/* Hero weather box inside modal */}
                <div className={styles.modalHeroWeather}>
                  <div className={styles.modalWeatherDesc}>
                    <div className={styles.weatherIconWrapper} style={{ width: 56, height: 56 }}>
                      {renderWeatherIcon(selectedProvince.conditionCode, 32)}
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                        {weatherConditionText(selectedProvince.conditionCode, isEn)}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
                        {isEn ? `Feels like ${measurement(selectedProvince.feelsLike)}°C` : `Cảm nhận thực tế: ${measurement(selectedProvince.feelsLike)}°C`}
                      </div>
                    </div>
                  </div>

                  <div className={styles.modalBigTemp}>{measurement(selectedProvince.temp)}°C</div>
                </div>

                {/* Metrics Grid */}
                <div className={styles.metricsGrid} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className={styles.metricItem}>
                    <Droplets size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Humidity" : "Độ ẩm"}</span>
                    <span className={styles.metricVal}>{measurement(selectedProvince.humidity)}%</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Wind size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Wind Speed" : "Tốc độ gió"}</span>
                    <span className={styles.metricVal}>{measurement(selectedProvince.windSpeedKmh)} km/h</span>
                  </div>
                  <div className={styles.metricItem}>
                    <CloudRain size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Rain chance (1h)" : "Xác suất mưa (1h)"}</span>
                    <span className={styles.metricVal}>{rainChance(selectedProvince.rainProbabilityPercent)}</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Sun size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "UV Index" : "Chỉ số UV"}</span>
                    <span className={styles.metricVal}>{measurement(selectedProvince.uvIndex)}</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Eye size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Visibility" : "Tầm nhìn xa"}</span>
                    <span className={styles.metricVal}>{measurement(selectedProvince.visibilityKm)} km</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Compass size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Pressure" : "Khí áp"}</span>
                    <span className={styles.metricVal}>{measurement(selectedProvince.pressureHpa)} hPa</span>
                  </div>
                </div>

                {/* 24-Hour Trend Section */}
                <div className={styles.trendSection}>
                  <h4 className={styles.trendTitle}>
                    <Clock size={16} />
                    <span>{isEn ? `24-Hour Forecast Trajectory for ${selectedProvince.name}` : `Dự báo xu hướng 24 giờ tới tại ${selectedProvince.name}`}</span>
                  </h4>

                  {!isAuthenticated ? (
                    <div
                      className={styles.lockedHourlyBox}
                      onClick={() =>
                        openModal(
                          isEn ? "24-Hour Hourly Forecast" : "Dự báo chi tiết 24 giờ tới",
                          isEn
                            ? "Guests can only view current real-time weather. Please sign in to unlock hourly forecast trajectories, temperatures, and rain chances."
                            : "Khách chỉ xem được số liệu hiện tại. Vui lòng đăng nhập hoặc đăng ký để mở khóa chuỗi dự báo nhiệt độ và xác suất mưa chi tiết từng giờ!"
                        )
                      }
                    >
                      <Lock size={20} style={{ margin: "0 auto 8px auto", color: "var(--color-primary, #0066cc)" }} />
                      <div className={styles.lockedHourlyTitle}>
                        {isEn ? "Hourly Forecast Locked for Guests" : "Dự báo 24 giờ tới yêu cầu đăng nhập"}
                      </div>
                      <div className={styles.lockedHourlySubtitle}>
                        {isEn ? "Click here or sign in to view hourly forecast trajectories." : "Bấm vào đây hoặc Đăng nhập để mở khóa biểu đồ xu hướng theo giờ."}
                      </div>
                      <span className={styles.lockedHourlyBtn}>
                        {isEn ? "Sign In to Unlock" : "Đăng nhập để xem dự báo theo giờ"}
                      </span>
                    </div>
                  ) : hourlyForecast.length > 0 ? (
                    <div className={styles.hourlyTrack}>
                      {hourlyForecast.map(slot => (
                        <div key={slot.validInterval.from} className={styles.hourlyCard}>
                          <span className={styles.hourlyTime}>{new Date(slot.validInterval.from).toLocaleString(isEn ? "en-US" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                          <div>{renderWeatherIcon(slot.conditionCode ?? "unknown", 18)}</div>
                          <span className={styles.hourlyTemp}>{measurement(slot.temperatureCelsius)}°C</span>
                          <span className={styles.hourlyRainProb}>
                            <Droplets size={10} />
                            {rainChance(slot.precipitationProbabilityPercent)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div role="status">
                      <p>{weatherStateText(forecast.hourlyState === "ready" ? "unavailable" : forecast.hourlyState, isEn)}</p>
                      <button type="button" disabled={forecast.isFetching} onClick={() => void forecast.refetch()}>{isEn ? "Retry" : "Thử lại"}</button>
                    </div>
                  )}
                </div>

                {/* AI Safety Advisory Box */}
                <div className={styles.advisoryBox}>
                  <Sparkles size={20} className={styles.advisoryIcon} />
                  <div className={styles.advisoryContent}>
                    <h4 className={styles.advisoryTitle}>
                      {isEn ? "Travel Safety & Outdoor Activity Advisories" : "Khuyến nghị an toàn di chuyển & hoạt động ngoài trời"}
                    </h4>
                    <RiskEvidenceWarnings evidence={selectedProvince.assessment?.evidence} isEn={isEn} />
                    <p className={styles.advisoryText}>
                      {selectedProvince.assessment?.reasons.map(reason => riskReasonText(reason, isEn)).join(" ") || (isEn ? "Insufficient evidence for a travel recommendation." : "Chưa đủ bằng chứng để khuyến nghị di chuyển.")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.modalFooter}>
                <Link
                  to={`/map?lat=${selectedProvince.latitude}&lng=${selectedProvince.longitude}&province=${encodeURIComponent(selectedProvince.name)}`}
                  className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                  onClick={() => setSelectedProvinceId(null)}
                >
                  <MapPin size={16} />
                  <span>{isEn ? "View on Map" : "Xem trên bản đồ"}</span>
                </Link>

                <Link
                  to={`/route?dest=${encodeURIComponent(selectedProvince.name)}`}
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                  onClick={() => setSelectedProvinceId(null)}
                >
                  <Navigation size={16} />
                  <span>{isEn ? "Plan Route to Here" : "Lập lộ trình đến đây"}</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
