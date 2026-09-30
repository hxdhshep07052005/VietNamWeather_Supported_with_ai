import type { GeoCheckpoint } from "@/utils/routePathGenerator";
import { formatMeasurement } from "@/utils/reportRisk";
import styles from "./CheckpointMarker.module.css";

interface MarkerOptions {
  readonly boundary: HTMLElement;
  readonly tooltipId: string;
  readonly selected: boolean;
  readonly isEn: boolean;
  readonly onSelect: () => void;
}

export interface CheckpointMarker {
  readonly element: HTMLButtonElement;
  readonly dismiss: () => void;
  readonly reposition: () => void;
}

const riskLabels = {
  low: ["Rủi ro thấp", "Low risk"],
  caution: ["Cẩn trọng", "Caution"],
  high: ["Nguy hiểm", "Dangerous"],
  unknown: ["Chưa đủ dữ liệu", "Insufficient data"],
} as const;

export function createCheckpointMarker(point: GeoCheckpoint, options: MarkerOptions): CheckpointMarker {
  const { selected, isEn, tooltipId, onSelect } = options;
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = styles.marker;
  marker.dataset.risk = point.risk;
  marker.setAttribute("aria-label", point.name);
  marker.setAttribute("aria-pressed", String(selected));
  marker.setAttribute("aria-describedby", tooltipId);

  const dot = document.createElement("span");
  dot.className = styles.dot;
  dot.setAttribute("aria-hidden", "true");
  const detail = document.createElement("span");
  detail.className = styles.tooltip;
  detail.id = tooltipId;
  detail.setAttribute("role", "tooltip");
  detail.hidden = !selected;
  const heading = document.createElement("span");
  heading.className = styles.heading;
  const name = document.createElement("strong");
  name.className = styles.name;
  name.textContent = point.name;
  const temperature = document.createElement("strong");
  temperature.className = styles.temperature;
  const value = formatMeasurement(point.temp);
  temperature.textContent = `${value}${value === "—" ? "" : "°C"}`;
  heading.append(name, temperature);

  const arrival = document.createElement("span");
  arrival.className = styles.arrival;
  arrival.textContent = `${isEn ? "Arrive" : "Đến"} ${point.etaShort || point.eta || "—"}`;
  const status = document.createElement("span");
  status.className = styles.status;
  const risk = document.createElement("span");
  risk.className = styles.risk;
  risk.textContent = riskLabels[point.risk][isEn ? 1 : 0];
  status.append(risk);
  if (point.provisional) {
    const provisional = document.createElement("span");
    provisional.className = styles.provisional;
    provisional.textContent = isEn ? "Provisional" : "Tạm tính";
    status.append(provisional);
  }
  detail.append(heading, arrival, status);
  marker.append(dot, detail);

  let hovered = false;
  let focused = false;
  let dismissed = false;
  const reposition = () => {
    if (detail.hidden) return;
    const bounds = options.boundary.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const inset = 8;
    detail.style.maxInlineSize = `${Math.max(0, bounds.width - inset * 2)}px`;
    detail.style.maxBlockSize = `${Math.max(0, bounds.height - inset * 2)}px`;
    const anchor = marker.getBoundingClientRect();
    const card = detail.getBoundingClientRect();
    const centerX = anchor.left + anchor.width / 2;
    const centerY = anchor.top + anchor.height / 2;
    const left = Math.max(bounds.left + inset, Math.min(centerX - card.width / 2, bounds.right - inset - card.width));
    const above = centerY - 12 - card.height;
    const preferredTop = above < bounds.top + inset ? centerY + 12 : above;
    const top = Math.max(bounds.top + inset, Math.min(preferredTop, bounds.bottom - inset - card.height));
    detail.style.insetInlineStart = `${left - anchor.left}px`;
    detail.style.insetBlockStart = `${top - anchor.top}px`;
    detail.style.insetBlockEnd = "auto";
    detail.style.transform = "none";
  };
  const updateVisibility = () => {
    const visible = !dismissed && (selected || hovered || focused);
    detail.hidden = !visible;
    marker.dataset.popupOpen = String(visible);
    reposition();
  };
  const dismiss = () => { dismissed = true; updateVisibility(); };
  marker.addEventListener("mouseenter", () => { hovered = true; dismissed = false; updateVisibility(); });
  marker.addEventListener("mouseleave", () => { hovered = false; updateVisibility(); });
  marker.addEventListener("focus", () => { focused = true; dismissed = false; updateVisibility(); });
  marker.addEventListener("blur", () => { focused = false; updateVisibility(); });
  marker.addEventListener("keydown", event => {
    if (event.key === "Escape") dismiss();
  });
  marker.addEventListener("click", event => { event.stopPropagation(); onSelect(); });
  updateVisibility();
  return { element: marker, dismiss, reposition };
}
