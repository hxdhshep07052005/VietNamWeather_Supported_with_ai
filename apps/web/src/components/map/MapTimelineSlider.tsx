import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, Crown, Clock } from "lucide-react";
import styles from "./MapTimelineSlider.module.css";

export interface MapTimelineSliderProps {
  currentOffsetHours: number;
  onChangeOffsetHours: (offsetHours: number) => void;
  isPro: boolean;
  onRequireUpgrade: () => void;
}

const TIMELINE_STEPS = [0, 1, 3, 6, 12, 18, 24, 36, 48, 72];

export function MapTimelineSlider({
  currentOffsetHours,
  onChangeOffsetHours,
  isPro,
  onRequireUpgrade,
}: MapTimelineSliderProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);

  // Find nearest index
  const currentIndex = useMemo(() => {
    const idx = TIMELINE_STEPS.indexOf(currentOffsetHours);
    return idx !== -1 ? idx : 0;
  }, [currentOffsetHours]);

  // Formatted display time
  const displayTime = useMemo(() => {
    const targetDate = new Date(Date.now() + currentOffsetHours * 3600 * 1000);
    const hours = String(targetDate.getHours()).padStart(2, "0");
    const minutes = String(targetDate.getMinutes()).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");

    if (currentOffsetHours === 0) {
      return `${hours}:${minutes} - ${t("map.timelineCurrent", "Hiện tại")}`;
    }
    return `+${currentOffsetHours}h (${hours}:${minutes}, ${day}/${month})`;
  }, [currentOffsetHours, t]);

  // Handle Play/Pause
  const handleTogglePlay = useCallback(() => {
    if (!isPro) {
      onRequireUpgrade();
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [isPro, onRequireUpgrade]);

  // Handle Slider Change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stepIdx = parseInt(e.target.value, 10);
    const targetHours = TIMELINE_STEPS[stepIdx] ?? 0;

    if (!isPro && targetHours > 1) {
      onChangeOffsetHours(1);
      onRequireUpgrade();
      return;
    }

    onChangeOffsetHours(targetHours);
  };

  // Handle clicking a specific tick
  const handleTickClick = (stepHours: number) => {
    if (!isPro && stepHours > 1) {
      onChangeOffsetHours(1);
      onRequireUpgrade();
      return;
    }
    onChangeOffsetHours(stepHours);
  };

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      const nextIdx = (currentIndex + 1) % TIMELINE_STEPS.length;
      const nextHours = TIMELINE_STEPS[nextIdx] ?? 0;

      if (!isPro && nextHours > 1) {
        setIsPlaying(false);
        onRequireUpgrade();
        return;
      }

      onChangeOffsetHours(nextHours);
    }, 1800);

    return () => clearInterval(timer);
  }, [isPlaying, currentIndex, isPro, onChangeOffsetHours, onRequireUpgrade]);

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.topRow}>
        <div className={styles.timeInfo}>
          <Clock size={16} color="#38BDF8" />
          <span className={styles.timeLabel}>{t("map.timelineLabel", "Dự báo theo giờ")}:</span>
          <span className={styles.currentDateBadge}>{displayTime}</span>
        </div>

        <div className={styles.controlsGroup}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={handleTogglePlay}
            title={isPlaying ? "Tạm dừng" : "Tự động phát chuỗi dự báo"}
            aria-label={isPlaying ? "Pause forecast animation" : "Play forecast animation"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: "2px" }} />}
          </button>
        </div>
      </div>

      <div className={styles.sliderTrackWrapper}>
        <input
          type="range"
          min={0}
          max={TIMELINE_STEPS.length - 1}
          step={1}
          value={currentIndex}
          onChange={handleSliderChange}
          className={styles.slider}
          aria-label="Timeline forecast scrub slider"
        />

        <div className={styles.ticksRow}>
          {TIMELINE_STEPS.map((hours, idx) => {
            const isStepPro = hours > 1;
            const isActive = idx === currentIndex;

            return (
              <div
                key={hours}
                className={`${styles.tickItem} ${isActive ? styles.tickActive : ""}`}
                onClick={() => handleTickClick(hours)}
              >
                <span>{hours === 0 ? "0h" : `+${hours}h`}</span>
                {isStepPro && !isPro && (
                  <span className={styles.proBadge} title="Tính năng gói Pro">
                    <Crown size={8} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!isPro && (
        <div className={styles.paywallPrompt}>
          <Crown size={14} />
          <span>
            {t("map.proTimelineNotice", "Gói Free xem dự báo 0h–1h.")}{" "}
            <span className={styles.upgradeLink} onClick={onRequireUpgrade}>
              {t("map.upgradeProPrompt", "Nâng cấp Pro để xem trọn vẹn 72h")}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
