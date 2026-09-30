/** Timeline labels only. Weather and hazard values must come from the backend. */
export interface TimelineMilestone {
  value: number;
  shortLabel: string;
  subLabel: string;
  dayLabel: string;
}
export const TIMELINE_MILESTONES: TimelineMilestone[] = [
  { value: 0, shortLabel: "Hiện tại", subLabel: "Bây giờ", dayLabel: "Hôm nay" },
  { value: 3, shortLabel: "+3h", subLabel: "3 giờ tới", dayLabel: "Hôm nay" },
  { value: 6, shortLabel: "+6h", subLabel: "6 giờ tới", dayLabel: "Hôm nay" },
  { value: 12, shortLabel: "+12h", subLabel: "12 giờ tới", dayLabel: "Hôm nay" },
  { value: 24, shortLabel: "+24h", subLabel: "1 ngày sau", dayLabel: "Ngày mai" },
  { value: 48, shortLabel: "+48h", subLabel: "2 ngày sau", dayLabel: "Ngày kia" },
  { value: 72, shortLabel: "+72h", subLabel: "3 ngày sau", dayLabel: "3 ngày tới" },
];
