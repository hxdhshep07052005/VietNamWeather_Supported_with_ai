/** Report main_vi.pdf Table 3.1. Units and inclusive temperature bounds are explicit. */
export const REPORT_RULES_V1 = {
  version: "report-table-3.1-v1",
  generalVersion: "general-weather-v1",
  // General outdoor exposure uses the existing conservative numeric thresholds.
  general: { rain: [10, 25], gust: [25, 40], visibility: [2000, 1000], temperature: [10, 13, 36, 38] },
  vehicles: {
    motorcycle: { rain: [10, 25], gust: [25, 40], visibility: [2000, 1000], temperature: [10, 13, 36, 38] },
    car: { rain: [15, 35], gust: [45, 60], visibility: [1000, 500], temperature: [5, 8, 38, 40] },
  },
  storm: { none: 1, distant: 2, cumulonimbus: 2, direct: 3, hail: 3 },
  alert: { caution: 1, high: 3 },
} as const;
