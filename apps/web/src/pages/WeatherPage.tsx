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
} from "lucide-react";
import { getAllProvincesData, type ProvinceGeoFeatureProperties } from "@/data/vietnamGeoJsonWGS84";
import { VIETNAM_REGIONS } from "@/data/provinces";
import { getEnrichedProvinceWeather } from "@/utils/weatherSimulation";
import { ForecastTimelineSlider } from "@/components/common/ForecastTimelineSlider";
import styles from "./WeatherPage.module.css";

// Helper for Weather Condition Icon
function renderWeatherIcon(conditionCode: string, size = 20) {
  switch (conditionCode) {
    case "clear":
      return <Sun size={size} color="#f59e0b" />;
    case "partly_cloudy":
      return <CloudSun size={size} color="#60a5fa" />;
    case "cloudy":
      return <Cloud size={size} color="#94a3b8" />;
    case "rain":
      return <CloudRain size={size} color="#38bdf8" />;
    case "heavy_rain":
    case "thunderstorm":
      return <CloudLightning size={size} color="#818cf8" />;
    default:
      return <Sun size={size} color="#f59e0b" />;
  }
}

// Helper to compute realistic rain probability (%)
function getRainProb(p: ProvinceGeoFeatureProperties): number {
  if (p.conditionCode === "thunderstorm") return 85;
  if (p.conditionCode === "heavy_rain") return 90;
  if (p.conditionCode === "rain") return 70;
  if (p.conditionCode === "partly_cloudy") return 25;
  if (p.conditionCode === "cloudy") return 35;
  return 10;
}

// Helper to generate 24h trend slots
function generate24hTrend(baseTemp: number, conditionCode: string, isEn = false) {
  const currentHour = new Date().getHours();
  return Array.from({ length: 8 }, (_, i) => {
    const h = (currentHour + i * 3) % 24;
    const timeLabel = `${h.toString().padStart(2, "0")}:00`;
    const tempDelta = Math.sin((h - 8) * (Math.PI / 12)) * 3;
    const slotTemp = Math.round(baseTemp + tempDelta);
    const rainProb =
      conditionCode === "thunderstorm"
        ? Math.min(95, 60 + (i % 4) * 10)
        : conditionCode === "rain" || conditionCode === "heavy_rain"
        ? Math.min(85, 40 + (i % 3) * 15)
        : Math.max(5, (i % 3) * 10);

    return {
      time: i === 0 ? (isEn ? "Now" : "Bây giờ") : timeLabel,
      temp: slotTemp,
      conditionCode,
      rainProb,
    };
  });
}

export function WeatherPage() {
  const { t, i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");

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
  const [selectedProvince, setSelectedProvince] = useState<ProvinceGeoFeatureProperties | null>(null);

  // Load raw provinces and enrich with timeline simulation
  const rawProvinces = useMemo(() => getAllProvincesData(), []);
  const allProvinces = useMemo(() => {
    return rawProvinces.map((p) => getEnrichedProvinceWeather(p, timelineOffsetHours));
  }, [rawProvinces, timelineOffsetHours]);

  // National weather statistics
  const stats = useMemo(() => {
    if (allProvinces.length === 0) {
      return { avgTemp: 0, hottest: null, coolest: null, lowCount: 0, cautionCount: 0, highCount: 0 };
    }

    let totalTemp = 0;
    let hottest: ProvinceGeoFeatureProperties = allProvinces[0]!;
    let coolest: ProvinceGeoFeatureProperties = allProvinces[0]!;
    let lowCount = 0;
    let cautionCount = 0;
    let highCount = 0;

    for (const p of allProvinces) {
      totalTemp += p.temp;
      if (p.temp > hottest.temp) hottest = p;
      if (p.temp < coolest.temp) coolest = p;
      if (p.riskLevel === "low") lowCount++;
      else if (p.riskLevel === "caution") cautionCount++;
      else if (p.riskLevel === "high") highCount++;
    }

    return {
      avgTemp: Math.round((totalTemp / allProvinces.length) * 10) / 10,
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
            return b.riskScore - a.riskScore;
          case "rain_desc":
            return getRainProb(b) - getRainProb(a);
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
                  ? "Real-time meteorological telemetry & multi-dimensional simulation along an interactive timeline"
                  : (t("weatherPage.subtitle") ||
                    "Dữ liệu quan trắc khí tượng thời gian thực & mô phỏng dự báo đa chiều theo dòng thời gian tương tác")}
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
              <div className={styles.statValue}>{stats.avgTemp}°C</div>
              <div className={styles.statSubtext}>{isEn ? "All 63 provinces" : "Toàn bộ 63 tỉnh thành"}</div>
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
                <span>{isEn ? "Safe Zone" : "Vùng an toàn"}</span>
              </div>
              <div className={styles.statValue} style={{ color: "#4ade80" }}>
                {stats.lowCount}
              </div>
              <div className={styles.statSubtext}>{isEn ? "Favorable travel conditions" : "Thời tiết thuận lợi di chuyển"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span>{isEn ? "Caution Zone" : "Cần theo dõi"}</span>
              </div>
              <div className={styles.statValue} style={{ color: "#fbbf24" }}>
                {stats.cautionCount}
              </div>
              <div className={styles.statSubtext}>{isEn ? "Scattered rain or breeze" : "Mưa rải rác hoặc gió nhẹ"}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <ShieldAlert size={16} color="#ef4444" />
                <span>{isEn ? "High Risk" : "Rủi ro cao"}</span>
              </div>
              <div className={styles.statValue} style={{ color: "#f87171" }}>
                {stats.highCount}
              </div>
              <div className={styles.statSubtext}>{isEn ? "Severe convective cells" : "Dông lốc, mưa to cục bộ"}</div>
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
                  <span>{isEn ? `Safe (${stats.lowCount})` : `An toàn (${stats.lowCount})`}</span>
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
            {timelineOffsetHours > 0 && (isEn ? ` • Forecast simulation +${timelineOffsetHours}h` : ` • Dự báo +${timelineOffsetHours}h tới`)}
          </div>
        </div>

        {/* ==================================================================
            Main Content: Grid or Table
            ================================================================== */}
        {viewMode === "grid" ? (
          <div className={styles.provinceGrid}>
            {filteredProvinces.map((p) => {
              const riskTier = p.riskLevel || "low";
              const riskColor =
                riskTier === "high" ? "#ef4444" : riskTier === "caution" ? "#f59e0b" : "#22c55e";
              const rainProb = getRainProb(p);

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
                          : styles.riskBadgeLow
                      }`}
                    >
                      {riskTier === "high" ? (
                        <ShieldAlert size={12} />
                      ) : riskTier === "caution" ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <ShieldCheck size={12} />
                      )}
                      <span>
                        {riskTier === "high" ? (isEn ? "High Risk" : "Nguy cơ cao") : riskTier === "caution" ? (isEn ? "Caution" : "Cần chú ý") : (isEn ? "Safe" : "An toàn")}
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
                        {isEn
                          ? (p.conditionCode === "rain" ? "Rain" : p.conditionCode === "heavy_rain" ? "Heavy Rain" : p.conditionCode === "thunderstorm" ? "Thunderstorm" : p.conditionCode === "clear" ? "Clear" : p.conditionCode === "partly_cloudy" ? "Partly Cloudy" : p.conditionCode === "cloudy" ? "Cloudy" : "Stable Weather")
                          : p.conditionText}
                      </span>
                    </div>

                    <div className={styles.tempRight}>
                      <div className={styles.temperature}>{p.temp}°C</div>
                      <div className={styles.feelsLike}>{isEn ? `Feels like ${p.feelsLike}°C` : `Cảm nhận ${p.feelsLike}°C`}</div>
                    </div>
                  </div>

                  {/* Metrics Mini Grid */}
                  <div className={styles.metricsGrid}>
                    <div className={styles.metricItem}>
                      <Droplets size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "Humidity:" : "Độ ẩm:"}</span>
                      <span className={styles.metricVal}>{p.humidity}%</span>
                    </div>

                    <div className={styles.metricItem}>
                      <Wind size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "Wind:" : "Gió:"}</span>
                      <span className={styles.metricVal}>{p.windSpeedKmh} km/h</span>
                    </div>

                    <div className={styles.metricItem}>
                      <CloudRain size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "Rain prob:" : "Xác suất mưa:"}</span>
                      <span className={styles.metricVal}>{rainProb}%</span>
                    </div>

                    <div className={styles.metricItem}>
                      <Sun size={14} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>{isEn ? "UV index:" : "Chỉ số UV:"}</span>
                      <span className={styles.metricVal}>{p.uvIndex}/10</span>
                    </div>
                  </div>

                  {/* Risk Score Dimensions Progress */}
                  <div className={styles.riskDimensions}>
                    <div className={styles.riskDimensionsHeader}>
                      <span>{isEn ? "Composite Risk Index" : "Chỉ số rủi ro tổng hợp"}</span>
                      <span style={{ color: riskColor, fontWeight: 700 }}>
                        {p.riskScore} / 100
                      </span>
                    </div>
                    <div className={styles.riskBarContainer}>
                      <div
                        className={styles.riskBarFill}
                        style={{ width: `${Math.min(100, Math.max(12, p.riskScore))}%`, backgroundColor: riskColor }}
                      />
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className={styles.cardFooter}>
                    <button
                      type="button"
                      className={styles.detailBtn}
                      onClick={() => setSelectedProvince(p)}
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
                  <th>{isEn ? "Rain Prob" : "Khả năng mưa"}</th>
                  <th>{isEn ? "Risk Level" : "Mức rủi ro"}</th>
                  <th>{isEn ? "Actions" : "Thao tác"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProvinces.map((p) => {
                  const riskTier = p.riskLevel || "low";
                  const rainProb = getRainProb(p);

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
                            {isEn
                              ? (p.conditionCode === "rain" ? "Rain" : p.conditionCode === "heavy_rain" ? "Heavy Rain" : p.conditionCode === "thunderstorm" ? "Thunderstorm" : p.conditionCode === "clear" ? "Clear" : p.conditionCode === "partly_cloudy" ? "Partly Cloudy" : p.conditionCode === "cloudy" ? "Cloudy" : "Stable")
                              : p.conditionText}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "#ffffff" }}>{p.temp}°C</strong>
                      </td>
                      <td>{p.humidity}%</td>
                      <td>{p.windSpeedKmh} km/h</td>
                      <td>{rainProb}%</td>
                      <td>
                        <span
                          className={`${styles.riskBadge} ${
                            riskTier === "high"
                              ? styles.riskBadgeHigh
                              : riskTier === "caution"
                              ? styles.riskBadgeCaution
                              : styles.riskBadgeLow
                          }`}
                        >
                          {riskTier === "high" ? (isEn ? "High Risk" : "Nguy cơ cao") : riskTier === "caution" ? (isEn ? "Caution" : "Chú ý") : (isEn ? "Safe" : "An toàn")}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            className={styles.detailBtn}
                            style={{ padding: "6px 10px" }}
                            onClick={() => setSelectedProvince(p)}
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
          <div className={styles.modalBackdrop} onClick={() => setSelectedProvince(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                  onClick={() => setSelectedProvince(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* Hero weather box inside modal */}
                <div className={styles.modalHeroWeather}>
                  <div className={styles.modalWeatherDesc}>
                    <div className={styles.weatherIconWrapper} style={{ width: 56, height: 56 }}>
                      {renderWeatherIcon(selectedProvince.conditionCode, 32)}
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                        {isEn
                          ? (selectedProvince.conditionCode === "rain" ? "Rain" : selectedProvince.conditionCode === "heavy_rain" ? "Heavy Rain" : selectedProvince.conditionCode === "thunderstorm" ? "Thunderstorm" : selectedProvince.conditionCode === "clear" ? "Clear" : selectedProvince.conditionCode === "partly_cloudy" ? "Partly Cloudy" : selectedProvince.conditionCode === "cloudy" ? "Cloudy" : "Stable Weather")
                          : selectedProvince.conditionText}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
                        {isEn ? `Feels like ${selectedProvince.feelsLike}°C` : `Cảm nhận thực tế: ${selectedProvince.feelsLike}°C`}
                      </div>
                    </div>
                  </div>

                  <div className={styles.modalBigTemp}>{selectedProvince.temp}°C</div>
                </div>

                {/* Metrics Grid */}
                <div className={styles.metricsGrid} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className={styles.metricItem}>
                    <Droplets size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Humidity" : "Độ ẩm"}</span>
                    <span className={styles.metricVal}>{selectedProvince.humidity}%</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Wind size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Wind Speed" : "Tốc độ gió"}</span>
                    <span className={styles.metricVal}>{selectedProvince.windSpeedKmh} km/h</span>
                  </div>
                  <div className={styles.metricItem}>
                    <CloudRain size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Rain Prob" : "Khả năng mưa"}</span>
                    <span className={styles.metricVal}>{getRainProb(selectedProvince)}%</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Sun size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "UV Index" : "Chỉ số UV"}</span>
                    <span className={styles.metricVal}>{selectedProvince.uvIndex}/10</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Eye size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Visibility" : "Tầm nhìn xa"}</span>
                    <span className={styles.metricVal}>{selectedProvince.visibilityKm} km</span>
                  </div>
                  <div className={styles.metricItem}>
                    <Compass size={16} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{isEn ? "Pressure" : "Khí áp"}</span>
                    <span className={styles.metricVal}>{selectedProvince.pressureHpa} hPa</span>
                  </div>
                </div>

                {/* 24-Hour Trend Section */}
                <div className={styles.trendSection}>
                  <h4 className={styles.trendTitle}>
                    <Clock size={16} />
                    <span>{isEn ? `24-Hour Forecast Trajectory for ${selectedProvince.name}` : `Dự báo xu hướng 24 giờ tới tại ${selectedProvince.name}`}</span>
                  </h4>

                  <div className={styles.hourlyTrack}>
                    {generate24hTrend(selectedProvince.temp, selectedProvince.conditionCode, isEn).map((slot, idx) => (
                      <div key={idx} className={styles.hourlyCard}>
                        <span className={styles.hourlyTime}>{slot.time}</span>
                        <div>{renderWeatherIcon(slot.conditionCode, 18)}</div>
                        <span className={styles.hourlyTemp}>{slot.temp}°C</span>
                        <span className={styles.hourlyRainProb}>
                          <Droplets size={10} />
                          {slot.rainProb}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Safety Advisory Box */}
                <div className={styles.advisoryBox}>
                  <Sparkles size={20} className={styles.advisoryIcon} />
                  <div className={styles.advisoryContent}>
                    <h4 className={styles.advisoryTitle}>
                      {isEn ? "Travel Safety & Outdoor Activity Advisories" : "Khuyến nghị an toàn di chuyển & hoạt động ngoài trời"}
                    </h4>
                    <p className={styles.advisoryText}>
                      {selectedProvince.riskLevel === "high"
                        ? (isEn
                          ? `The ${selectedProvince.name} corridor currently exhibits convective squalls or strong gusts. If traveling by two-wheelers or coach, avoid peak squall windows, equip rain gear, and reduce cruising speed on mountain passes or slippery pavements.`
                          : `Khu vực ${selectedProvince.name} đang có nguy cơ mưa dông hoặc gió giật mạnh. Nếu di chuyển bằng xe máy hoặc xe khách, nên tránh các khung giờ mưa lớn và trang bị áo mưa bộ, giảm tốc độ khi qua các đoạn đèo dốc hoặc đường trơn.`)
                        : selectedProvince.riskLevel === "caution"
                        ? (isEn
                          ? `Weather across ${selectedProvince.name} is relatively stable but exhibits localized scattered showers or mountain mist. Suitable for transit with proactive check of road checkpoints before departure.`
                          : `Thời tiết tại ${selectedProvince.name} nhìn chung tương đối ổn định nhưng có khả năng xuất hiện mưa rào cục bộ hoặc sương mù rải rác. Thích hợp cho các chuyến đi nếu chủ động kiểm tra lộ trình trước khi xuất phát.`)
                        : (isEn
                          ? `Weather across ${selectedProvince.name} is highly favorable and safe for all forms of road travel, tourism, and outdoor activities. Ideal temperature ${selectedProvince.temp}°C with comfortable humidity.`
                          : `Thời tiết tại ${selectedProvince.name} rất thuận lợi và an toàn cho mọi hình thức di chuyển, du lịch hay tham quan ngoài trời. Nhiệt độ lý tưởng ${selectedProvince.temp}°C với độ ẩm dễ chịu.`)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.modalFooter}>
                <Link
                  to={`/map?lat=${selectedProvince.latitude}&lng=${selectedProvince.longitude}&province=${encodeURIComponent(selectedProvince.name)}`}
                  className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                  onClick={() => setSelectedProvince(null)}
                >
                  <MapPin size={16} />
                  <span>{isEn ? "View on Map" : "Xem trên bản đồ"}</span>
                </Link>

                <Link
                  to={`/route?dest=${encodeURIComponent(selectedProvince.name)}`}
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                  onClick={() => setSelectedProvince(null)}
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
