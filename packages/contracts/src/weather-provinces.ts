/**
 * Shared weather sampling points for the application's 63-province dataset.
 * Preserve these coordinates across scheduling and weather queries; map display
 * centroids are separate and must not replace existing sampling points.
 */

export interface VietnamProvince {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

// Original API sampling IDs, names and coordinates are retained unchanged.
export const VIETNAM_PROVINCES: readonly VietnamProvince[] = [
  // Northern Mountains
  { id: "lao-cai", name: "Lào Cai", latitude: 22.480, longitude: 103.970 },
  { id: "ha-giang", name: "Hà Giang", latitude: 22.803, longitude: 104.985 },
  { id: "cao-bang", name: "Cao Bằng", latitude: 22.656, longitude: 106.194 },
  { id: "bac-kan", name: "Bắc Kạn", latitude: 22.147, longitude: 105.830 },
  { id: "tuyen-quang", name: "Tuyên Quang", latitude: 21.779, longitude: 105.231 },
  { id: "yen-bai", name: "Yên Bái", latitude: 21.720, longitude: 104.911 },
  { id: "thai-nguyen", name: "Thái Nguyên", latitude: 21.594, longitude: 105.844 },
  { id: "lang-son", name: "Lạng Sơn", latitude: 21.854, longitude: 106.761 },
  { id: "quang-ninh", name: "Quảng Ninh", latitude: 21.394, longitude: 107.044 },
  { id: "bac-giang", name: "Bắc Giang", latitude: 21.277, longitude: 106.197 },
  { id: "phu-tho", name: "Phú Thọ", latitude: 21.374, longitude: 105.248 },
  { id: "vinh-phuc", name: "Vĩnh Phúc", latitude: 21.361, longitude: 105.597 },
  { id: "bac-ninh", name: "Bắc Ninh", latitude: 21.176, longitude: 106.076 },
  { id: "hung-yen", name: "Hưng Yên", latitude: 20.646, longitude: 106.054 },
  { id: "hai-duong", name: "Hải Dương", latitude: 20.938, longitude: 106.320 },

  // Red River Delta & Northern Central
  { id: "hoa-binh", name: "Hòa Bình", latitude: 20.813, longitude: 105.337 },
  { id: "ha-noi", name: "Hà Nội", latitude: 21.028, longitude: 105.854 },
  { id: "haiphong", name: "Hải Phòng", latitude: 20.865, longitude: 106.685 },
  { id: "thai-binh", name: "Thái Bình", latitude: 20.449, longitude: 106.337 },
  { id: "nam-dinh", name: "Nam Định", latitude: 20.254, longitude: 106.165 },
  { id: "ninh-binh", name: "Ninh Bình", latitude: 20.224, longitude: 105.972 },
  { id: "thanh-hoa", name: "Thanh Hóa", latitude: 19.963, longitude: 105.287 },
  { id: "nghe-an", name: "Nghệ An", latitude: 19.248, longitude: 104.920 },

  // North Central Coast
  { id: "ha-tinh", name: "Hà Tĩnh", latitude: 18.355, longitude: 105.580 },
  { id: "quang-binh", name: "Quảng Bình", latitude: 17.611, longitude: 106.348 },
  { id: "quang-tri", name: "Quảng Trị", latitude: 16.739, longitude: 107.086 },
  { id: "thua-thien-hue", name: "Thừa Thiên Huế", latitude: 16.450, longitude: 107.562 },
  { id: "da-nang", name: "Đà Nẵng", latitude: 16.054, longitude: 108.202 },
  { id: "quang-nam", name: "Quảng Nam", latitude: 15.578, longitude: 108.474 },

  // South Central Coast
  { id: "quang-ngai", name: "Quảng Ngãi", latitude: 15.121, longitude: 108.800 },
  { id: "binh-dinh", name: "Bình Định", latitude: 14.172, longitude: 109.017 },
  { id: "phu-yen", name: "Phú Yên", latitude: 13.089, longitude: 109.093 },
  { id: "khanh-hoa", name: "Khánh Hòa", latitude: 12.239, longitude: 109.033 },
  { id: "ninh-thuan", name: "Ninh Thuận", latitude: 11.564, longitude: 109.000 },
  { id: "binh-thuan", name: "Bình Thuận", latitude: 10.928, longitude: 108.105 },

  // Central Highlands
  { id: "kon-tum", name: "Kon Tum", latitude: 14.350, longitude: 108.000 },
  { id: "gia-lai", name: "Gia Lai", latitude: 13.808, longitude: 108.109 },
  { id: "dak-lak", name: "Đắk Lắk", latitude: 12.710, longitude: 108.238 },
  { id: "dak-nong", name: "Đắk Nông", latitude: 12.265, longitude: 107.610 },
  { id: "lam-dong", name: "Lâm Đồng", latitude: 11.575, longitude: 108.143 },

  // Southeast
  { id: "binh-phuoc", name: "Bình Phước", latitude: 11.496, longitude: 106.887 },
  { id: "tay-ninh", name: "Tây Ninh", latitude: 11.336, longitude: 106.120 },
  { id: "binh-duong", name: "Bình Dương", latitude: 11.068, longitude: 106.636 },
  { id: "dong-nai", name: "Đồng Nai", latitude: 11.069, longitude: 107.167 },
  { id: "ho-chi-minh", name: "TP. Hồ Chí Minh", latitude: 10.823, longitude: 106.630 },
  { id: "ba-ria-vung-tau", name: "Bà Rịa - Vũng Tàu", latitude: 10.542, longitude: 107.243 },
  { id: "dong-thap", name: "Đồng Tháp", latitude: 10.494, longitude: 105.689 },

  // Mekong Delta
  { id: "an-giang", name: "An Giang", latitude: 10.522, longitude: 105.114 },
  { id: "kien-giang", name: "Kiên Giang", latitude: 9.825, longitude: 105.130 },
  { id: "can-tho", name: "Cần Thơ", latitude: 10.045, longitude: 105.747 },
  { id: "hau-giang", name: "Hậu Giang", latitude: 9.758, longitude: 105.641 },
  { id: "tra-vinh", name: "Trà Vinh", latitude: 9.948, longitude: 106.338 },
  { id: "soc-trang", name: "Sóc Trăng", latitude: 9.602, longitude: 105.973 },
  { id: "bac-lieu", name: "Bạc Liêu", latitude: 9.294, longitude: 105.722 },
  { id: "ca-mau", name: "Cà Mau", latitude: 9.187, longitude: 105.130 },
  { id: "ben-tre", name: "Bến Tre", latitude: 10.106, longitude: 106.375 },
  { id: "vinh-long", name: "Vĩnh Long", latitude: 10.240, longitude: 105.972 },
  { id: "tien-giang", name: "Tiền Giang", latitude: 10.450, longitude: 106.343 },
  { id: "long-an", name: "Long An", latitude: 10.693, longitude: 106.155 },

  // Missing sampling points sourced verbatim from feature.properties in
  // apps/web/src/data/vietnam-wgs84-clean.json (vn-db, vn-li, vn-311, vn-hm).
  { id: "dien-bien", name: "Điện Biên", latitude: 21.745, longitude: 102.9287 },
  { id: "lai-chau", name: "Lai Châu", latitude: 22.2754, longitude: 103.2143 },
  { id: "son-la", name: "Sơn La", latitude: 21.2156, longitude: 104.066 },
  { id: "ha-nam", name: "Hà Nam", latitude: 20.5461, longitude: 105.9791 },
] as const;

// Create a Map for quick lookup by ID
export const VIETNAM_PROVINCES_BY_ID = new Map<string, VietnamProvince>(
  VIETNAM_PROVINCES.map(p => [p.id, p])
);

// Create a Map for quick lookup by coordinates (rounded to 2 decimal places)
export const VIETNAM_PROVINCES_BY_COORDS = new Map<string, VietnamProvince>(
  VIETNAM_PROVINCES.map(p => [`${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`, p])
);

/** Normalize Vietnamese names, including TP. Hồ Chí Minh / Ho Chi Minh aliases. */
export function normalizeProvinceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(?:tp|thanh pho|tinh)\s+/, "");
}

const VIETNAM_PROVINCES_BY_NAME = new Map<string, VietnamProvince>(
  VIETNAM_PROVINCES.map(p => [normalizeProvinceName(p.name), p])
);

/** Resolve a display name to its weather sampling point, without a fallback. */
export function findVietnamProvinceByName(name: string): VietnamProvince | undefined {
  return VIETNAM_PROVINCES_BY_NAME.get(normalizeProvinceName(name));
}
