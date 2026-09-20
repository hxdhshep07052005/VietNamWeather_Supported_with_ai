/**
 * Phase 9 Map Page — Complete Overhaul
 * Full real interactive road map (MapLibre GL) + Right Sidebar with Search,
 * Region & Risk Filters, 63 Provinces Scrollable List, and Full Status Detail Dashboard
 */

import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Crown,
  Sparkles,
  Search,
  X,
  Bookmark,
  Info,
  SlidersHorizontal,
  CloudRain,
  Wind,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuthStore";
import { RealInteractiveMap } from "@/components/map/RealInteractiveMap";
import { ProvinceStatusDetail } from "@/components/province/ProvinceStatusDetail";
import { ForecastTimelineSlider } from "@/components/common/ForecastTimelineSlider";
import { getEnrichedProvinceWeather } from "@/utils/weatherSimulation";
import {
  getAllProvincesData,
  type ProvinceGeoFeatureProperties,
} from "@/data/vietnamGeoJsonWGS84";
import { VIETNAM_REGIONS } from "@/data/provinces";
import styles from "./MapPage.module.css";

export function MapPage() {
  const { t, i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");
  const { user, saveLocation, removeSavedLocation } = useAuthStore();
  const isPro = user?.plan === "pro";
  const savedLocations = user?.savedLocations || [];
  const maxSavedLocations = isPro ? 50 : 3;

  // Timeline Offset State
  const [timelineOffsetHours, setTimelineOffsetHours] = useState(0);

  // Province dataset enriched with timeline simulation
  const rawProvinces = useMemo(() => getAllProvincesData(), []);
  const allProvinces = useMemo(() => {
    return rawProvinces.map((p) => getEnrichedProvinceWeather(p, timelineOffsetHours));
  }, [rawProvinces, timelineOffsetHours]);

  // State
  const [selectedProvince, setSelectedProvince] = useState<ProvinceGeoFeatureProperties | null>(null);
  const [activeView, setActiveView] = useState<"list" | "detail">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<"all" | "North" | "Central" | "South">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "caution" | "high" | "saved">("all");
  const [sortBy, setSortBy] = useState<"name" | "risk" | "temp_desc" | "temp_asc">("name");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pro Layers
  const [radarEnabled, setRadarEnabled] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Handle Pro Layer Toggle
  const handleToggleProLayer = (type: "radar" | "heatmap") => {
    if (!isPro) {
      showToast(
        type === "radar"
          ? "Lớp Radar mây dông thời gian thực là tính năng độc quyền của Gói PRO. Hãy nâng cấp để mở khóa!"
          : "Bản đồ nhiệt rủi ro cao cấp là tính năng độc quyền của Gói PRO. Hãy nâng cấp để mở khóa!"
      );
      return;
    }
    if (type === "radar") setRadarEnabled((v) => !v);
    if (type === "heatmap") setHeatmapEnabled((v) => !v);
  };

  // Check if a province is saved
  const isProvinceSaved = useCallback(
    (provinceName: string) => {
      return savedLocations.some((l) => l.name.toLowerCase() === provinceName.toLowerCase());
    },
    [savedLocations]
  );

  // Toggle Save Province
  const handleToggleSaveLocation = useCallback(
    (province: ProvinceGeoFeatureProperties) => {
      const existing = savedLocations.find(
        (l) => l.name.toLowerCase() === province.name.toLowerCase()
      );

      if (existing) {
        removeSavedLocation(existing.id);
        showToast(`Đã xóa "${province.name}" khỏi danh sách yêu thích.`);
      } else {
        if (savedLocations.length >= maxSavedLocations) {
          showToast(
            isPro
              ? `Bạn đã lưu tối đa ${maxSavedLocations} địa điểm.`
              : `Tài khoản Free chỉ lưu tối đa ${maxSavedLocations} địa điểm. Hãy nâng cấp Pro để lưu tới 50 địa điểm!`
          );
          return;
        }

        const res = saveLocation({
          name: province.name,
          provinceCode: province.code,
        });
        if (res.success) {
          showToast(`Đã lưu "${province.name}" vào danh sách yêu thích.`);
        } else {
          showToast(res.message || `Không thể lưu "${province.name}".`);
        }
      }
    },
    [savedLocations, maxSavedLocations, isPro, removeSavedLocation, saveLocation, showToast]
  );

  // Select Province from List or Map
  const handleSelectProvince = useCallback((province: ProvinceGeoFeatureProperties) => {
    setSelectedProvince(province);
    setActiveView("detail");
  }, []);

  // Region Mapping Filter
  const isProvinceInRegion = (region: string, filter: "all" | "North" | "Central" | "South") => {
    if (filter === "all") return true;
    if (filter === "North") {
      return region === "Northwest" || region === "Northeast" || region === "Red River Delta";
    }
    if (filter === "Central") {
      return (
        region === "North Central Coast" ||
        region === "South Central Coast" ||
        region === "Central Highlands"
      );
    }
    if (filter === "South") {
      return region === "Southeast" || region === "Mekong Delta";
    }
    return true;
  };

  // Filtered & Sorted Provinces
  const filteredProvinces = useMemo(() => {
    return allProvinces
      .filter((p) => {
        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(q);
          const matchCode = p.code.toLowerCase().includes(q);
          const matchRegion = p.regionVi.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchRegion) return false;
        }

        // Region Filter
        if (!isProvinceInRegion(p.region, regionFilter)) return false;

        // Risk / Saved Filter
        if (riskFilter === "saved") {
          if (!isProvinceSaved(p.name)) return false;
        } else if (riskFilter !== "all") {
          if (p.riskLevel !== riskFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "risk") {
          return b.riskScore - a.riskScore;
        }
        if (sortBy === "temp_desc") {
          return b.temp - a.temp;
        }
        if (sortBy === "temp_asc") {
          return a.temp - b.temp;
        }
        // default: name A-Z
        return a.name.localeCompare(b.name, "vi");
      });
  }, [allProvinces, searchQuery, regionFilter, riskFilter, sortBy, isProvinceSaved]);

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

      {/* Header Bar */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <span>{isEn ? "Vietnam Interactive Weather Map" : (t("map.title") || "Bản Đồ Thời Tiết Quốc Gia")}</span>
            </h1>

            {isPro ? (
              <span className={styles.proBadge}>
                <Crown size={12} strokeWidth={2.5} />
                <span>PRO GOLD</span>
              </span>
            ) : (
              <div className={styles.freeBadgeGroup}>
                <span className={styles.freeBadge}>{isEn ? "FREE TIER" : "GÓI MIỄN PHÍ"}</span>
                <Link to="/upgrade" className={styles.upgradeLink}>
                  <Sparkles size={12} />
                  <span>{isEn ? "Upgrade to Pro" : "Nâng cấp Pro"}</span>
                </Link>
              </div>
            )}
          </div>
          <p className={styles.subtitle}>
            {isEn
              ? "Real-time meteorological monitoring and 6-dimensional risk assessment across Vietnam's 63 provinces"
              : "Quan sát thời gian thực mạng lưới khí tượng và đánh giá rủi ro 6 chiều trên 63 tỉnh thành Việt Nam"}
          </p>
        </div>
      </div>

      {/* Main Map Card: Modern rounded container matching other pages */}
      <div className={styles.mapCard}>
        {/* Left: Real Interactive Map */}
        <div className={styles.mapPane}>
          <RealInteractiveMap
            selectedProvinceCode={selectedProvince?.code}
            onSelectProvince={handleSelectProvince}
            radarEnabled={radarEnabled}
            heatmapEnabled={heatmapEnabled}
            onToggleProLayer={handleToggleProLayer}
            isPro={isPro}
          />
        </div>

        {/* Right: Sidebar Pane */}
        <div className={styles.sidebarPane}>
          {activeView === "detail" && selectedProvince ? (
            /* Status Detail View */
            <ProvinceStatusDetail
              province={selectedProvince}
              isSaved={isProvinceSaved(selectedProvince.name)}
              onBack={() => {
                setActiveView("list");
                setSelectedProvince(null);
              }}
              onToggleSave={() => handleToggleSaveLocation(selectedProvince)}
            />
          ) : (
            /* List View with Filters & Search */
            <>
              <div className={styles.sidebarHeader}>
                <div className={styles.sidebarTitleRow}>
                  <h2 className={styles.sidebarTitle}>
                    <span>{isEn ? "Vietnam 63 Provinces Weather" : "Thời tiết 63 Tỉnh Thành"}</span>
                  </h2>
                  <span className={styles.countPill}>
                    {filteredProvinces.length} / {isEn ? "63 provinces" : "63 tỉnh"}
                  </span>
                </div>

                {/* Search Box */}
                <div className={styles.searchBox}>
                  <Search size={15} className={styles.searchIcon} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isEn ? "Search province name, code (HN, SG, DN)..." : "Tìm theo tên tỉnh, mã tỉnh (HN, SG, ĐN)..."}
                    className={styles.searchInput}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className={styles.clearBtn}
                      title={isEn ? "Clear search" : "Xóa tìm kiếm"}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Row 1: Regions */}
                <div className={styles.filterRow}>
                  <button
                    type="button"
                    className={`${styles.chip} ${regionFilter === "all" ? styles.chipActive : ""}`}
                    onClick={() => setRegionFilter("all")}
                  >
                    {isEn ? "All regions" : "Tất cả miền"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${regionFilter === "North" ? styles.chipActive : ""}`}
                    onClick={() => setRegionFilter("North")}
                  >
                    {isEn ? "Northern" : "Bắc Bộ"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${regionFilter === "Central" ? styles.chipActive : ""}`}
                    onClick={() => setRegionFilter("Central")}
                  >
                    {isEn ? "Central" : "Trung Bộ"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${regionFilter === "South" ? styles.chipActive : ""}`}
                    onClick={() => setRegionFilter("South")}
                  >
                    {isEn ? "Southern" : "Nam Bộ"}
                  </button>
                </div>

                {/* Filter Row 2: Risk Levels & Saved */}
                <div className={styles.filterRow}>
                  <button
                    type="button"
                    className={`${styles.chip} ${riskFilter === "all" ? styles.chipActive : ""}`}
                    onClick={() => setRiskFilter("all")}
                  >
                    {isEn ? "All tiers" : "Tất cả cấp độ"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${riskFilter === "low" ? styles.chipActive : ""}`}
                    onClick={() => setRiskFilter("low")}
                    style={riskFilter === "low" ? { background: "#22C55E", borderColor: "#22C55E" } : {}}
                  >
                    {isEn ? "Safe" : "An toàn"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${riskFilter === "caution" ? styles.chipActive : ""}`}
                    onClick={() => setRiskFilter("caution")}
                    style={riskFilter === "caution" ? { background: "#EAB308", borderColor: "#EAB308", color: "#0F172A" } : {}}
                  >
                    {isEn ? "Caution" : "Chú ý"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${riskFilter === "high" ? styles.chipActive : ""}`}
                    onClick={() => setRiskFilter("high")}
                    style={riskFilter === "high" ? { background: "#EF4444", borderColor: "#EF4444" } : {}}
                  >
                    {isEn ? "Hazard" : "Nguy hiểm"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${riskFilter === "saved" ? styles.chipActive : ""}`}
                    onClick={() => setRiskFilter("saved")}
                  >
                    <Bookmark size={11} fill={riskFilter === "saved" ? "currentColor" : "none"} />
                    <span>{isEn ? `Saved (${savedLocations.length})` : `Đã lưu (${savedLocations.length})`}</span>
                  </button>
                </div>

                {/* Filter Row 3: Interactive Timeline Slider with draggable points */}
                <div style={{ marginBottom: "16px" }}>
                  <ForecastTimelineSlider
                    value={timelineOffsetHours}
                    onChange={(val) => {
                      setTimelineOffsetHours(val);
                      if (val > 0) {
                        showToast(isEn ? `Showing forecast simulation +${val}h` : `Đang hiển thị mô phỏng dự báo +${val}h`);
                      }
                    }}
                    isCompact
                  />
                </div>

                {/* Sort Bar */}
                <div className={styles.sortRow}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <SlidersHorizontal size={12} />
                    <span>{isEn ? "Sort:" : "Sắp xếp:"}</span>
                  </span>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className={styles.sortSelect}
                  >
                    <option value="name">{isEn ? "Province name (A - Z)" : "Tên tỉnh (A - Z)"}</option>
                    <option value="risk">{isEn ? "Highest risk score" : "Mức rủi ro cao nhất"}</option>
                    <option value="temp_desc">{isEn ? "Highest temperature" : "Nhiệt độ cao nhất"}</option>
                    <option value="temp_asc">{isEn ? "Lowest temperature" : "Nhiệt độ thấp nhất"}</option>
                  </select>
                </div>
              </div>

              {/* Scrollable Province List */}
              <div className={styles.provinceList}>
                {filteredProvinces.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>{isEn ? "No provinces matched the selected filters." : "Không tìm thấy tỉnh thành nào phù hợp với bộ lọc."}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setRegionFilter("all");
                        setRiskFilter("all");
                      }}
                      className={styles.chip}
                    >
                      {isEn ? "Reset filters" : "Đặt lại bộ lọc"}
                    </button>
                  </div>
                ) : (
                  filteredProvinces.map((p) => {
                    const isSelected = selectedProvince?.code === p.code;
                    const isSaved = isProvinceSaved(p.name);
                    const cardRiskDisplay = isEn
                      ? (p.riskLevel === "high" ? "Hazard" : p.riskLevel === "caution" ? "Caution" : "Safe")
                      : p.riskText;
                    const cardRegionDisplay = isEn
                      ? (VIETNAM_REGIONS[p.region]?.en || p.region)
                      : p.regionVi;

                    return (
                      <div
                        key={p.id}
                        className={`${styles.provinceCard} ${isSelected ? styles.provinceCardActive : ""}`}
                        onClick={() => handleSelectProvince(p)}
                      >
                        <div className={styles.cardLeft}>
                          <div className={styles.cardNameRow}>
                            <span className={styles.cardName}>{p.name}</span>
                            <span className={styles.cardRegion}>{cardRegionDisplay}</span>
                          </div>

                          <div className={styles.cardWeatherRow}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <CloudRain size={12} color="#0EA5E9" />
                              <span>{p.humidity}% {isEn ? "hum" : "ẩm"}</span>
                            </span>
                            <span>•</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Wind size={12} />
                              <span>{p.windSpeedKmh} km/h</span>
                            </span>
                          </div>
                        </div>

                        <div className={styles.cardRight}>
                          <div className={styles.tempBox}>
                            <span className={styles.tempVal}>{p.temp}°C</span>
                            <span
                              className={styles.riskTag}
                              style={{
                                color: p.riskColor,
                                borderColor: `${p.riskColor}60`,
                                backgroundColor: `${p.riskColor}15`,
                              }}
                            >
                              {cardRiskDisplay}
                            </span>
                          </div>

                          <button
                            type="button"
                            className={`${styles.bookmarkBtn} ${isSaved ? styles.bookmarkBtnSaved : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSaveLocation(p);
                            }}
                            title={isSaved ? (isEn ? "Remove from saved" : "Bỏ lưu địa điểm") : (isEn ? "Save location" : "Lưu địa điểm")}
                          >
                            <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
