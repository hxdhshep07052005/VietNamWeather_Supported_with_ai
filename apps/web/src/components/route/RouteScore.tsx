import styles from "./RouteScore.module.css";

type RiskLevel = "low" | "caution" | "high" | "unknown";

interface RouteScoreProps {
  readonly id?: string;
  readonly score: number | null;
  readonly level: RiskLevel;
  readonly provisional?: boolean;
  readonly coveragePercent?: number;
  readonly isEn: boolean;
}

const levels = {
  low: ["Thấp", "Low"],
  caution: ["Chú ý", "Caution"],
  high: ["Nguy hiểm", "Dangerous"],
  unknown: ["Chưa đủ dữ liệu", "Insufficient data"],
} as const;

export function routeScoreDescription({ score, level, provisional, coveragePercent, isEn }: RouteScoreProps): string {
  const available = score != null && Number.isFinite(score);
  const displayLevel = available ? level : "unknown";
  const status = levels[displayLevel][isEn ? 1 : 0];
  return [
    status,
    provisional && available ? (isEn ? "Provisional; risk from available weather" : "Tạm tính; rủi ro theo dữ liệu hiện có") : "",
    provisional && available && coveragePercent != null && Number.isFinite(coveragePercent)
      ? (isEn ? `Weather coverage: ${coveragePercent}%` : `Độ phủ thời tiết: ${coveragePercent}%`) : "",
    available ? (isEn ? "Lower score is better: 50% weather risk, 30% travel time, 20% distance. Time and distance are normalized against the longest candidate values; routes with the same weather risk can have different scores. Color shows weather risk." : "Điểm càng thấp càng tốt: 50% rủi ro thời tiết, 30% thời gian, 20% quãng đường. Thời gian và quãng đường được chuẩn hóa theo giá trị lớn nhất trong các tuyến; cùng mức rủi ro vẫn có thể khác điểm. Màu thể hiện rủi ro thời tiết.") : "",
    provisional && available ? (isEn ? "Missing spatial segments are conservatively penalized. Official alert and storm evidence remain incomplete; this is a conditional comparison, not a safety guarantee." : "Đoạn thiếu dữ liệu được cộng điểm rủi ro thận trọng. Dữ liệu cảnh báo chính thức và dông còn thiếu; đây là so sánh có điều kiện, không bảo đảm an toàn.") : "",
  ].filter(Boolean).join(" · ");
}

export function RouteScore(props: RouteScoreProps) {
  const { id, score, level, isEn } = props;
  const available = score != null && Number.isFinite(score);
  const displayLevel = available ? level : "unknown";
  const label = isEn ? "ETA score" : "Điểm ETA";
  const description = routeScoreDescription(props);

  return (
    <div id={id} className={styles.panel} data-risk-level={displayLevel} role="group" aria-label={label}>
      <span className={styles.label}>{label}</span>
      <span className={styles.badge} title={description}>{available ? `${Math.round(score)}/100` : "—"}</span>
      <span className="sr-only">{description}</span>
    </div>
  );
}
