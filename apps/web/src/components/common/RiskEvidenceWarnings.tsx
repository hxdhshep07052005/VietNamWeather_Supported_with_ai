import { CloudRain, Eye, Radio, Thermometer, Wind, Zap } from "lucide-react";
import type { ReportAssessment } from "@vietnam-weather/contracts";
import { formatEvidenceValue } from "@/utils/reportRisk";
import styles from "./RiskEvidenceWarnings.module.css";

const dimensions = {
  rain: { label: ["Mưa", "Rain"], unit: "mm/h", icon: CloudRain },
  wind: { label: ["Gió giật", "Wind gust"], unit: "km/h", icon: Wind },
  temperature: { label: ["Nhiệt độ", "Temperature"], unit: "°C", icon: Thermometer },
  visibility: { label: ["Tầm nhìn", "Visibility"], unit: "m", icon: Eye },
  storm: { label: ["Dông", "Storm"], unit: "", icon: Zap },
  alert: { label: ["Cảnh báo chính thức", "Official alert"], unit: "", icon: Radio },
} as const;

interface RiskEvidenceWarningsProps {
  evidence: ReportAssessment["evidence"] | undefined;
  isEn?: boolean;
}

export function RiskEvidenceWarnings({ evidence, isEn = false }: RiskEvidenceWarningsProps) {
  const warnings = evidence?.filter(item => item.severity >= 2) ?? [];
  if (warnings.length === 0) return null;

  return (
    <ul className={styles.list} aria-label={isEn ? "Weather warnings" : "Cảnh báo thời tiết"}>
      {warnings.map(item => {
        const meta = dimensions[item.dimension];
        const Icon = meta.icon;
        const label = item.dimension === "rain" && item.source_kind === "hourly_forecast"
          ? (isEn ? "Rain forecast" : "Mưa dự báo")
          : meta.label[isEn ? 1 : 0];
        const hasMeasurement = typeof item.value === "number" && Number.isFinite(item.value);
        const high = item.severity === 3;

        return (
          <li key={item.dimension} className={styles.item} data-severity={high ? "high" : "caution"}>
            <Icon className={styles.icon} aria-hidden="true" />
            <div className={styles.metric}>
              <span className={styles.label}>{label}</span>
              <p className={styles.measurement} data-numeric={hasMeasurement}>
                <strong className={styles.value}>{formatEvidenceValue(item, isEn)}</strong>
                {hasMeasurement && meta.unit && <span className={styles.unit}> {meta.unit}</span>}
              </p>
            </div>
            <span className={styles.badge}>
              {isEn ? (high ? "High risk" : "Caution") : (high ? "Nguy cơ cao" : "Chú ý")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
