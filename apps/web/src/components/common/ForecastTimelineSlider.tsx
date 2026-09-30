/**
 * ForecastTimelineSlider.tsx
 * Interactive milestone timeline with draggable points for hourly & multi-day forecast simulation.
 * Highlights "Hiện tại", "+24h (1 ngày sau)", "+48h (2 ngày sau)", "+72h (3 ngày sau)".
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Play, Pause, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { TIMELINE_MILESTONES, type TimelineMilestone } from "@/utils/weatherSimulation";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useRequireLoginModal } from "@/hooks/useRequireLoginModal";
import styles from "./ForecastTimelineSlider.module.css";

interface ForecastTimelineSliderProps {
  value: number; // offset hours (e.g. 0, 3, 6, 12, 24, 48, 72)
  onChange: (offsetHours: number) => void;
  className?: string;
  isCompact?: boolean;
}

export function ForecastTimelineSlider({
  value,
  onChange,
  className = "",
  isCompact = false,
}: ForecastTimelineSliderProps) {
  const { i18n } = useTranslation();
  const isEn = i18n?.language === "en" || (typeof window !== "undefined" && localStorage.getItem("vietnam-weather-language") === "en");
  const { isAuthenticated } = useAuthStore();
  const { openModal } = useRequireLoginModal();
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const requireLoginForForecast = () => {
    openModal(
      isEn ? "Hourly & Multi-Day Forecast Simulation" : "Mô phỏng dự báo theo giờ & nhiều ngày",
      isEn
        ? "Guests can only view current real-time weather data. Please sign in to simulate future hourly weather (+3h to +72h)!"
        : "Chế độ khách chỉ xem được thời tiết hiện tại. Vui lòng đăng nhập để tua mốc thời gian và xem dự báo tương lai (+3h đến +72h)!"
    );
  };

  // Helper for English sublabels
  const getSubLabel = (m: TimelineMilestone) => {
    if (!isEn) return m.subLabel;
    switch (m.value) {
      case 0: return "Now";
      case 3: return "+3 hrs";
      case 6: return "+6 hrs";
      case 12: return "+12 hrs";
      case 24: return "+1 day";
      case 48: return "+2 days";
      case 72: return "+3 days";
      default: return m.subLabel;
    }
  };

  const getShortLabel = (m: TimelineMilestone) => {
    if (m.value === 0 && isEn) return "Current";
    return m.shortLabel;
  };

  // Find nearest milestone index
  const currentIndex = useMemo(() => {
    let closestIdx = 0;
    let minDiff = Infinity;
    TIMELINE_MILESTONES.forEach((m, idx) => {
      const diff = Math.abs(m.value - value);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }, [value]);

  const currentMilestone: TimelineMilestone =
    TIMELINE_MILESTONES[currentIndex] ?? TIMELINE_MILESTONES[0]!;

  // Percentage progress across milestones for line fill
  const progressPercent = useMemo(() => {
    return (currentIndex / (TIMELINE_MILESTONES.length - 1)) * 100;
  }, [currentIndex]);

  // Handle Play/Pause Auto-Scrubber
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      const next = TIMELINE_MILESTONES[(currentIndex + 1) % TIMELINE_MILESTONES.length];
      if (next) onChange(next.value);
    }, 1800);
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, onChange]);

  // Navigation handlers
  const handlePrev = () => {
    if (!isAuthenticated) {
      requireLoginForForecast();
      return;
    }
    if (currentIndex > 0) {
      const prev = TIMELINE_MILESTONES[currentIndex - 1];
      if (prev) onChange(prev.value);
    }
  };

  const handleNext = () => {
    if (!isAuthenticated) {
      requireLoginForForecast();
      return;
    }
    if (currentIndex < TIMELINE_MILESTONES.length - 1) {
      const next = TIMELINE_MILESTONES[currentIndex + 1];
      if (next) onChange(next.value);
    }
  };

  const handleSelectMilestone = (m: TimelineMilestone) => {
    if (!isAuthenticated && m.value > 0) {
      requireLoginForForecast();
      return;
    }
    setIsPlaying(false);
    onChange(m.value);
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx) && TIMELINE_MILESTONES[idx]) {
      if (!isAuthenticated && TIMELINE_MILESTONES[idx]!.value > 0) {
        requireLoginForForecast();
        return;
      }
      setIsPlaying(false);
      onChange(TIMELINE_MILESTONES[idx].value);
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Header Info & Controls */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <Clock size={15} className={styles.clockIcon} />
          <span>{isEn ? "Hourly & Multi-Day Forecast:" : "Dự báo theo giờ & ngày:"}</span>
          {!isAuthenticated && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "10.5px",
                fontWeight: 700,
                color: "var(--color-primary, #0066cc)",
                backgroundColor: "rgba(0, 102, 204, 0.1)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
              title={isEn ? "Sign in to unlock future forecast hours" : "Đăng nhập để mở khóa các mốc dự báo tương lai"}
            >
              <Lock size={10} />
              <span>{isEn ? "Guest" : "Chế độ Khách"}</span>
            </span>
          )}
          <span className={styles.activeBadge}>
            {currentMilestone.value === 0
              ? (isEn ? "Current (Real-time)" : "Hiện tại (Bây giờ)")
              : `${getShortLabel(currentMilestone)} (${getSubLabel(currentMilestone)})`}
          </span>
        </div>

        <div className={styles.playbackControls}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={handlePrev}
            disabled={currentIndex === 0}
            title={isEn ? "Step backward" : "Lùi thời gian"}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            className={`${styles.controlBtn} ${isPlaying ? styles.controlBtnActive : ""}`}
            onClick={() => {
              if (!isAuthenticated) {
                requireLoginForForecast();
                return;
              }
              setIsPlaying((p) => !p);
            }}
            title={isPlaying ? (isEn ? "Pause auto simulation" : "Tạm dừng mô phỏng") : (isEn ? "Play auto simulation" : "Phát mô phỏng tự động")}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <button
            type="button"
            className={styles.controlBtn}
            onClick={handleNext}
            disabled={currentIndex === TIMELINE_MILESTONES.length - 1}
            title={isEn ? "Step forward" : "Tiến thời gian"}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Interactive Track Line with Points */}
      <div className={styles.trackWrapper} ref={containerRef}>
        {/* Track Line Background */}
        <div className={styles.trackLineBackground} />

        {/* Track Line Active Fill */}
        <div
          className={styles.trackLineFill}
          style={{ width: `calc(${progressPercent}% * (100% - 24px) / 100)` }}
        />

        {/* Milestone Dots */}
        <div className={styles.milestonesContainer}>
          {TIMELINE_MILESTONES.map((m, idx) => {
            const isActive = idx === currentIndex;
            const isPassed = idx < currentIndex;
            const shortLbl = getShortLabel(m);
            const subLbl = getSubLabel(m);

            return (
              <button
                key={m.value}
                type="button"
                className={styles.milestonePoint}
                onClick={() => handleSelectMilestone(m)}
                title={isEn ? `Select ${shortLbl} (${subLbl})` : `Chọn mốc ${m.shortLabel} (${m.subLabel})`}
              >
                <div
                  className={`${styles.pointDot} ${
                    isActive
                      ? styles.pointDotActive
                      : isPassed
                      ? styles.pointDotPassed
                      : ""
                  }`}
                />

                <span
                  className={`${styles.pointLabel} ${
                    isActive ? styles.pointLabelActive : ""
                  }`}
                >
                  {shortLbl}
                  {!isCompact && (
                    <span className={styles.pointSubLabel}>
                      {m.value === 0 ? (isEn ? "Base" : "Gốc") : subLbl}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Accessible Range Input Overlaid for dragging */}
        <input
          type="range"
          min={0}
          max={TIMELINE_MILESTONES.length - 1}
          step={1}
          value={currentIndex}
          onChange={handleRangeChange}
          className={styles.nativeRangeInput}
          aria-label="Kéo thanh dự báo thời gian"
        />
      </div>
    </div>
  );
}
