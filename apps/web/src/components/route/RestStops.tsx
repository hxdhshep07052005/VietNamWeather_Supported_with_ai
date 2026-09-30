import { Coffee, ArrowUpRight } from "lucide-react";
import type { RouteResponse } from "@vietnam-weather/contracts";
import { formatMeasurement } from "@/utils/reportRisk";
import styles from "./RouteJourneyDetails.module.css";

interface RestStopsProps {
  readonly stops: RouteResponse["rest_stops"];
  readonly isEn: boolean;
}

export function RestStops({ stops, isEn }: RestStopsProps) {
  const available = stops?.status === "available";
  const items = available ? stops.items : [];
  const renderStops = (entries: typeof items) => (
    <ul className={styles.stopsList}>
      {entries.map(stop => (
        <li key={stop.id}>
          <a className={styles.stopLink} href={stop.source_url} target="_blank" rel="noopener noreferrer">
            <span className={styles.location}>
              <strong>{stop.name}</strong>
              <span className={styles.meta}>
                {isEn ? "From departure:" : "Từ điểm xuất phát:"} {formatMeasurement(stop.distance_from_start_meters / 1000)} km
              </span>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
            <span className="sr-only">{isEn ? "Open map in a new tab" : "Mở bản đồ trong thẻ mới"}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={styles.restStops} aria-label={isEn ? "Rest stops near the fastest route" : "Trạm dừng gần tuyến nhanh nhất"}>
      <header className={styles.header}>
        <Coffee size={20} aria-hidden="true" />
        <div>
          <h3>{isEn ? "Rest stops" : "Trạm dừng chân"}</h3>
          <p>{isEn ? "Near the fastest route" : "Gần tuyến nhanh nhất"}</p>
        </div>
      </header>
      {items.length === 0 ? (
        <p className={styles.empty}>
          {available
            ? (isEn ? "No rest stops found near this route." : "Chưa tìm thấy trạm dừng gần tuyến này.")
            : (isEn ? "Rest-stop locations are unavailable right now." : "Hiện chưa tải được vị trí trạm dừng.")}
        </p>
      ) : (
        <>
          {renderStops(items.slice(0, 3))}
          {items.length > 3 && (
            <details className={styles.moreStops}>
              <summary>{isEn ? `Show ${items.length - 3} more ${items.length === 4 ? "stop" : "stops"}` : `Xem thêm ${items.length - 3} trạm`}</summary>
              {renderStops(items.slice(3))}
            </details>
          )}
          <p className={styles.footnote}>
            {isEn ? "OpenStreetMap · Check the entrance before stopping." : "OpenStreetMap · Kiểm tra lối vào trước khi dừng."}
          </p>
        </>
      )}
    </section>
  );
}
