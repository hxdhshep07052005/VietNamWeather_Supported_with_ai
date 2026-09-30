/**
 * Vietnam Province & Regional Standard Configuration
 * Official 8 Administrative Regions of Vietnam (Tổng cục Thống kê)
 */

export type VietnamRegion =
  | "Northwest"
  | "Northeast"
  | "Red River Delta"
  | "North Central Coast"
  | "South Central Coast"
  | "Central Highlands"
  | "Southeast"
  | "Mekong Delta";

export interface RegionMeta {
  vi: string;
  en: string;
  color: string;
}

// Official 8 socio-economic regions of Vietnam & harmonic color palette
export const VIETNAM_REGIONS: Record<VietnamRegion, RegionMeta> = {
  "Northwest": { vi: "Tây Bắc Bộ", en: "Northwest", color: "#0EA5E9" },             // Sky Blue
  "Northeast": { vi: "Đông Bắc Bộ", en: "Northeast", color: "#3B82F6" },             // Royal Blue
  "Red River Delta": { vi: "Đồng bằng sông Hồng", en: "Red River Delta", color: "#10B981" }, // Emerald
  "North Central Coast": { vi: "Bắc Trung Bộ", en: "North Central", color: "#F59E0B" },    // Amber
  "South Central Coast": { vi: "Duyên hải Nam Trung Bộ", en: "South Central", color: "#EC4899" }, // Pink
  "Central Highlands": { vi: "Tây Nguyên", en: "Central Highlands", color: "#8B5CF6" },       // Purple
  "Southeast": { vi: "Đông Nam Bộ", en: "Southeast", color: "#6366F1" },            // Indigo
  "Mekong Delta": { vi: "Đồng bằng sông Cửu Long", en: "Mekong Delta", color: "#14B8A6" }, // Teal
};

// Authoritative mapping for all 63 Vietnam administrative units
export const PROVINCE_MAP: Record<string, { name: string; region: VietnamRegion; code: string }> = {
  // 1. Tây Bắc Bộ (6)
  "vn-db": { name: "Điện Biên", region: "Northwest", code: "DB" },
  "vn-ho": { name: "Hòa Bình", region: "Northwest", code: "HO" },
  "vn-li": { name: "Lai Châu", region: "Northwest", code: "LI" },
  "vn-lo": { name: "Lào Cai", region: "Northwest", code: "LO" },
  "vn-311": { name: "Sơn La", region: "Northwest", code: "SL" },
  "vn-yb": { name: "Yên Bái", region: "Northwest", code: "YB" },

  // 2. Đông Bắc Bộ (9)
  "vn-bg": { name: "Bắc Giang", region: "Northeast", code: "BG" },
  "vn-307": { name: "Bắc Kạn", region: "Northeast", code: "BK" },
  "vn-cb": { name: "Cao Bằng", region: "Northeast", code: "CB" },
  "vn-hg": { name: "Hà Giang", region: "Northeast", code: "HG" },
  "vn-ls": { name: "Lạng Sơn", region: "Northeast", code: "LS" },
  "vn-pt": { name: "Phú Thọ", region: "Northeast", code: "PT" },
  "vn-qn": { name: "Quảng Ninh", region: "Northeast", code: "QN" },
  "vn-ty": { name: "Thái Nguyên", region: "Northeast", code: "TY" },
  "vn-tq": { name: "Tuyên Quang", region: "Northeast", code: "TQ" },

  // 3. Đồng bằng sông Hồng (10)
  "vn-bn": { name: "Bắc Ninh", region: "Red River Delta", code: "BN" },
  "vn-hm": { name: "Hà Nam", region: "Red River Delta", code: "HM" },
  "vn-318": { name: "Hà Nội", region: "Red River Delta", code: "HN" },
  "vn-hd": { name: "Hải Dương", region: "Red River Delta", code: "HD" },
  "vn-3623": { name: "Hải Phòng", region: "Red River Delta", code: "HP" },
  "vn-317": { name: "Hưng Yên", region: "Red River Delta", code: "HY" },
  "vn-nd": { name: "Nam Định", region: "Red River Delta", code: "ND" },
  "vn-nb": { name: "Ninh Bình", region: "Red River Delta", code: "NB" },
  "vn-tb": { name: "Thái Bình", region: "Red River Delta", code: "TB" },
  "vn-vc": { name: "Vĩnh Phúc", region: "Red River Delta", code: "VC" },

  // 4. Bắc Trung Bộ (6)
  "vn-328": { name: "Hà Tĩnh", region: "North Central Coast", code: "HT" },
  "vn-na": { name: "Nghệ An", region: "North Central Coast", code: "NA" },
  "vn-qb": { name: "Quảng Bình", region: "North Central Coast", code: "QB" },
  "vn-qt": { name: "Quảng Trị", region: "North Central Coast", code: "QT" },
  "vn-th": { name: "Thanh Hóa", region: "North Central Coast", code: "TH" },
  "vn-tt": { name: "Thừa Thiên Huế", region: "North Central Coast", code: "TT" },

  // 5. Duyên hải Nam Trung Bộ (8)
  "vn-bd": { name: "Bình Định", region: "South Central Coast", code: "BD" },
  "vn-bu": { name: "Bình Thuận", region: "South Central Coast", code: "BU" },
  "vn-da": { name: "Đà Nẵng", region: "South Central Coast", code: "DA" },
  "vn-kh": { name: "Khánh Hòa", region: "South Central Coast", code: "KH" },
  "vn-nt": { name: "Ninh Thuận", region: "South Central Coast", code: "NT" },
  "vn-py": { name: "Phú Yên", region: "South Central Coast", code: "PY" },
  "vn-300": { name: "Quảng Nam", region: "South Central Coast", code: "QM" },
  "vn-qg": { name: "Quảng Ngãi", region: "South Central Coast", code: "QG" },

  // 6. Tây Nguyên (5)
  "vn-723": { name: "Đắk Lắk", region: "Central Highlands", code: "DL" },
  "vn-6365": { name: "Đắk Nông", region: "Central Highlands", code: "ĐN" },
  "vn-724": { name: "Gia Lai", region: "Central Highlands", code: "GL" },
  "vn-299": { name: "Kon Tum", region: "Central Highlands", code: "KT" },
  "vn-ld": { name: "Lâm Đồng", region: "Central Highlands", code: "LD" },

  // 7. Đông Nam Bộ (6)
  "vn-bv": { name: "Bà Rịa - Vũng Tàu", region: "Southeast", code: "BV" },
  "vn-bi": { name: "Bình Dương", region: "Southeast", code: "BI" },
  "vn-bp": { name: "Bình Phước", region: "Southeast", code: "BP" },
  "vn-331": { name: "Đồng Nai", region: "Southeast", code: "DN" },
  "vn-hc": { name: "TP. Hồ Chí Minh", region: "Southeast", code: "HC" },
  "vn-tn": { name: "Tây Ninh", region: "Southeast", code: "TN" },

  // 8. Đồng bằng sông Cửu Long (13)
  "vn-ag": { name: "An Giang", region: "Mekong Delta", code: "AG" },
  "vn-bl": { name: "Bạc Liêu", region: "Mekong Delta", code: "BL" },
  "vn-br": { name: "Bến Tre", region: "Mekong Delta", code: "BR" },
  "vn-cm": { name: "Cà Mau", region: "Mekong Delta", code: "CM" },
  "vn-333": { name: "Cần Thơ", region: "Mekong Delta", code: "CT" },
  "vn-dt": { name: "Đồng Tháp", region: "Mekong Delta", code: "DT" },
  "vn-337": { name: "Hậu Giang", region: "Mekong Delta", code: "HG" },
  "vn-kg": { name: "Kiên Giang", region: "Mekong Delta", code: "KG" },
  "vn-la": { name: "Long An", region: "Mekong Delta", code: "LA" },
  "vn-st": { name: "Sóc Trăng", region: "Mekong Delta", code: "ST" },
  "vn-tg": { name: "Tiền Giang", region: "Mekong Delta", code: "TG" },
  "vn-tv": { name: "Trà Vinh", region: "Mekong Delta", code: "TV" },
  "vn-vl": { name: "Vĩnh Long", region: "Mekong Delta", code: "VL" },
};

export interface HotspotLocation {
  id: string;
  name: string;
  provinceCode: string;
  latitude: number;
  longitude: number;
  temp: number;
  condition: "sunny" | "partly_cloudy" | "cloudy" | "rainy" | "thunderstorm";
  conditionText: string;
  riskLevel: "low" | "caution" | "high";
  tag?: string;
}

export const VIETNAM_HOTSPOTS: HotspotLocation[] = [
  { id: "hanoi", name: "Hà Nội", provinceCode: "HN", latitude: 21.0285, longitude: 105.8542, temp: 28, condition: "sunny", conditionText: "Nắng nhẹ, trời quang", riskLevel: "low", tag: "Thủ đô" },
  { id: "sapa", name: "Sa Pa", provinceCode: "LC", latitude: 22.3364, longitude: 103.8438, temp: 19, condition: "cloudy", conditionText: "Nhiều mây, se lạnh", riskLevel: "low", tag: "Nghỉ dưỡng" },
  { id: "halong", name: "Hạ Long", provinceCode: "QN", latitude: 20.9505, longitude: 107.0734, temp: 27, condition: "sunny", conditionText: "Trời quang, gió nhẹ", riskLevel: "low", tag: "Kỳ quan" },
  { id: "hue", name: "Huế", provinceCode: "TT", latitude: 16.4637, longitude: 107.5909, temp: 29, condition: "partly_cloudy", conditionText: "Mây thay đổi", riskLevel: "low", tag: "Cố đô" },
  { id: "danang", name: "Đà Nẵng", provinceCode: "DA", latitude: 16.0544, longitude: 108.2022, temp: 31, condition: "sunny", conditionText: "Nắng đẹp, sóng êm", riskLevel: "low", tag: "Biển đẹp" },
  { id: "nhatrang", name: "Nha Trang", provinceCode: "KH", latitude: 12.2388, longitude: 109.1967, temp: 31, condition: "sunny", conditionText: "Nắng ráo, biển êm", riskLevel: "low", tag: "Du lịch biển" },
  { id: "dalat", name: "Đà Lạt", provinceCode: "LD", latitude: 11.9404, longitude: 108.4583, temp: 21, condition: "cloudy", conditionText: "Mát mẻ, sương mù", riskLevel: "caution", tag: "Sương mù" },
  { id: "hcmc", name: "TP. Hồ Chí Minh", provinceCode: "HC", latitude: 10.8231, longitude: 106.6297, temp: 33, condition: "partly_cloudy", conditionText: "Nắng ráo, mưa rào chiều", riskLevel: "caution", tag: "Kinh tế" },
  { id: "cantho", name: "Cần Thơ", provinceCode: "CT", latitude: 10.0452, longitude: 105.7469, temp: 32, condition: "sunny", conditionText: "Nắng ấm miền Tây", riskLevel: "low", tag: "Sông nước" },
  { id: "phuquoc", name: "Phú Quốc", provinceCode: "KG", latitude: 10.2899, longitude: 103.9840, temp: 30, condition: "sunny", conditionText: "Trời quang, sóng êm", riskLevel: "low", tag: "Đảo ngọc" },
];

export interface ProvinceData {
  id: string;
  name: string;
  code: string;
  path: string;
  centerX: number;
  centerY: number;
  latitude: number;
  longitude: number;
  region: VietnamRegion;
  regionVi: string;
  color: string;
  riskLevel: "low" | "caution" | "high" | "unknown";
  estimatedTemp: number | string;
}
