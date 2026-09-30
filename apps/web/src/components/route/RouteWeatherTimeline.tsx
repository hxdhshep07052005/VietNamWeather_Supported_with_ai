import { formatMeasurement } from "@/utils/reportRisk";
import styles from "./RouteJourneyDetails.module.css";

export interface RouteCheckpoint {
  readonly name: string;
  readonly distanceKm: number;
  readonly eta: string;
  readonly etaShort: string;
  readonly temp: number | null;
  readonly condition: string;
  readonly rainProb: number | null;
  readonly windKmh: number | null;
  readonly risk: "low" | "caution" | "high" | "unknown";
  readonly riskScore?: number;
  readonly coordinates?: [number, number];
  readonly note?: string;
  readonly provisional?: boolean;
  readonly coveragePercent?: number;
}

interface RouteWeatherTimelineProps {
  readonly checkpoints: readonly RouteCheckpoint[];
  readonly selectedIndex: number | null;
  readonly onSelect: (index: number | null) => void;
  readonly isEn: boolean;
}

const riskLabels = {
  low: ["Rủi ro thấp", "Low risk"],
  caution: ["Cẩn trọng", "Caution"],
  high: ["Nguy hiểm", "Dangerous"],
  unknown: ["Chưa đủ dữ liệu", "Insufficient data"],
} as const;

export function RouteWeatherTimeline({ checkpoints, selectedIndex, onSelect, isEn }: RouteWeatherTimelineProps) {
  return (
    <section className={styles.points} aria-label={isEn ? "Weather checkpoints" : "Các điểm thời tiết"}>
      <ol className={styles.weatherList}>
        {checkpoints.map((point, index) => {
          const selected = selectedIndex === index;
          const temperature = formatMeasurement(point.temp);
          const rain = formatMeasurement(point.rainProb);
          const wind = formatMeasurement(point.windKmh);
          const risk = `${riskLabels[point.risk][isEn ? 1 : 0]}${point.provisional ? (isEn ? " · provisional" : " · tạm tính") : ""}`;
          return (
            <li key={index} className={styles.weatherPoint} data-selected={selected}>
              <button
                type="button"
                className={styles.pointButton}
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : index)}
              >
                <span className="sr-only">{isEn ? "Show on map:" : "Xem trên bản đồ:"}</span>
                <span className={styles.location}>
                  <strong>{point.name}</strong>
                  <span className={styles.meta}>
                    <span>{formatMeasurement(point.distanceKm)} km</span>
                    <span aria-hidden="true">·</span>
                    <span>{isEn ? "Arrive" : "Đến"} <span>{point.etaShort}</span></span>
                  </span>
                </span>
                <span className={styles.weatherSummary}>
                  <strong className={styles.temperature}>{temperature}{temperature === "—" ? "" : "°C"}</strong>
                  <span className={styles.risk} data-risk={point.risk}>{risk}</span>
                </span>
              </button>
              <details className={styles.weatherDetails}>
                <summary>{isEn ? "Weather details" : "Chi tiết thời tiết"}</summary>
                <div className={styles.detailBody}>
                  <p>{point.condition}</p>
                  <dl className={styles.measurements}>
                    <div><dt>{isEn ? "Arrival (UTC+7)" : "Giờ đến (UTC+7)"}</dt><dd>{point.eta}</dd></div>
                    <div><dt>{isEn ? "Rain chance" : "Khả năng mưa"}</dt><dd>{rain}{rain === "—" ? "" : "%"}</dd></div>
                    <div><dt>{isEn ? "Wind" : "Gió"}</dt><dd>{wind}{wind === "—" ? "" : " km/h"}</dd></div>
                    {point.riskScore != null && <div><dt>{isEn ? "Weather risk score" : "Điểm rủi ro thời tiết"}</dt><dd>{point.riskScore}/100</dd></div>}
                    {point.provisional && point.coveragePercent != null && <div><dt>{isEn ? "Route weather coverage" : "Độ phủ thời tiết toàn tuyến"}</dt><dd>{point.coveragePercent}%</dd></div>}
                  </dl>
                  {point.provisional && <p>{isEn ? "Based on available weather. Storm and official alert data may be incomplete." : "Dựa trên thời tiết hiện có. Dữ liệu dông và cảnh báo chính thức có thể chưa đầy đủ."}</p>}
                  {point.note && <p className={styles.sourceNote}>{point.note}</p>}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
