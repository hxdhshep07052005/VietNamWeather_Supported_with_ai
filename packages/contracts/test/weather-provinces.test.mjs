import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  VIETNAM_PROVINCES,
  VIETNAM_PROVINCES_BY_ID,
  VIETNAM_PROVINCES_BY_COORDS,
  normalizeProvinceName,
  findVietnamProvinceByName,
} from "../dist/index.js";

// Baseline from the original API scheduler registry: IDs and sampling points
// must stay stable even when the map's geometry or centroids change.
const originalPoints = [
  ["lao-cai", "Lào Cai", 22.480, 103.970],
  ["ha-giang", "Hà Giang", 22.803, 104.985],
  ["cao-bang", "Cao Bằng", 22.656, 106.194],
  ["bac-kan", "Bắc Kạn", 22.147, 105.830],
  ["tuyen-quang", "Tuyên Quang", 21.779, 105.231],
  ["yen-bai", "Yên Bái", 21.720, 104.911],
  ["thai-nguyen", "Thái Nguyên", 21.594, 105.844],
  ["lang-son", "Lạng Sơn", 21.854, 106.761],
  ["quang-ninh", "Quảng Ninh", 21.394, 107.044],
  ["bac-giang", "Bắc Giang", 21.277, 106.197],
  ["phu-tho", "Phú Thọ", 21.374, 105.248],
  ["vinh-phuc", "Vĩnh Phúc", 21.361, 105.597],
  ["bac-ninh", "Bắc Ninh", 21.176, 106.076],
  ["hung-yen", "Hưng Yên", 20.646, 106.054],
  ["hai-duong", "Hải Dương", 20.938, 106.320],
  ["hoa-binh", "Hòa Bình", 20.813, 105.337],
  ["ha-noi", "Hà Nội", 21.028, 105.854],
  ["haiphong", "Hải Phòng", 20.865, 106.685],
  ["thai-binh", "Thái Bình", 20.449, 106.337],
  ["nam-dinh", "Nam Định", 20.254, 106.165],
  ["ninh-binh", "Ninh Bình", 20.224, 105.972],
  ["thanh-hoa", "Thanh Hóa", 19.963, 105.287],
  ["nghe-an", "Nghệ An", 19.248, 104.920],
  ["ha-tinh", "Hà Tĩnh", 18.355, 105.580],
  ["quang-binh", "Quảng Bình", 17.611, 106.348],
  ["quang-tri", "Quảng Trị", 16.739, 107.086],
  ["thua-thien-hue", "Thừa Thiên Huế", 16.450, 107.562],
  ["da-nang", "Đà Nẵng", 16.054, 108.202],
  ["quang-nam", "Quảng Nam", 15.578, 108.474],
  ["quang-ngai", "Quảng Ngãi", 15.121, 108.800],
  ["binh-dinh", "Bình Định", 14.172, 109.017],
  ["phu-yen", "Phú Yên", 13.089, 109.093],
  ["khanh-hoa", "Khánh Hòa", 12.239, 109.033],
  ["ninh-thuan", "Ninh Thuận", 11.564, 109.000],
  ["binh-thuan", "Bình Thuận", 10.928, 108.105],
  ["kon-tum", "Kon Tum", 14.350, 108.000],
  ["gia-lai", "Gia Lai", 13.808, 108.109],
  ["dak-lak", "Đắk Lắk", 12.710, 108.238],
  ["dak-nong", "Đắk Nông", 12.265, 107.610],
  ["lam-dong", "Lâm Đồng", 11.575, 108.143],
  ["binh-phuoc", "Bình Phước", 11.496, 106.887],
  ["tay-ninh", "Tây Ninh", 11.336, 106.120],
  ["binh-duong", "Bình Dương", 11.068, 106.636],
  ["dong-nai", "Đồng Nai", 11.069, 107.167],
  ["ho-chi-minh", "TP. Hồ Chí Minh", 10.823, 106.630],
  ["ba-ria-vung-tau", "Bà Rịa - Vũng Tàu", 10.542, 107.243],
  ["dong-thap", "Đồng Tháp", 10.494, 105.689],
  ["an-giang", "An Giang", 10.522, 105.114],
  ["kien-giang", "Kiên Giang", 9.825, 105.130],
  ["can-tho", "Cần Thơ", 10.045, 105.747],
  ["hau-giang", "Hậu Giang", 9.758, 105.641],
  ["tra-vinh", "Trà Vinh", 9.948, 106.338],
  ["soc-trang", "Sóc Trăng", 9.602, 105.973],
  ["bac-lieu", "Bạc Liêu", 9.294, 105.722],
  ["ca-mau", "Cà Mau", 9.187, 105.130],
  ["ben-tre", "Bến Tre", 10.106, 106.375],
  ["vinh-long", "Vĩnh Long", 10.240, 105.972],
  ["tien-giang", "Tiền Giang", 10.450, 106.343],
  ["long-an", "Long An", 10.693, 106.155],
];

const addedPoints = [
  ["dien-bien", "vn-db"],
  ["lai-chau", "vn-li"],
  ["son-la", "vn-311"],
  ["ha-nam", "vn-hm"],
];

const geoJson = JSON.parse(readFileSync(
  new URL("../../../apps/web/src/data/vietnam-wgs84-clean.json", import.meta.url),
  "utf8",
));

test("registry contains exactly 63 unique province IDs, names and sampling keys", () => {
  assert.equal(VIETNAM_PROVINCES.length, 63);
  assert.equal(new Set(VIETNAM_PROVINCES.map(p => p.id)).size, 63);
  assert.equal(new Set(VIETNAM_PROVINCES.map(p => normalizeProvinceName(p.name))).size, 63);
  assert.equal(VIETNAM_PROVINCES_BY_ID.size, 63);
  assert.equal(VIETNAM_PROVINCES_BY_COORDS.size, 63);
  for (const province of VIETNAM_PROVINCES) {
    assert.ok(Number.isFinite(province.latitude));
    assert.ok(Number.isFinite(province.longitude));
    assert.strictEqual(VIETNAM_PROVINCES_BY_ID.get(province.id), province);
    assert.strictEqual(VIETNAM_PROVINCES_BY_COORDS.get(
      `${province.latitude.toFixed(2)},${province.longitude.toFixed(2)}`,
    ), province);
  }
});

test("original 59 entries retain IDs, names, coordinates and order", () => {
  assert.equal(originalPoints.length, 59);
  assert.deepEqual(VIETNAM_PROVINCES.slice(0, 59), originalPoints.map(
    ([id, name, latitude, longitude]) => ({ id, name, latitude, longitude }),
  ));
  assert.deepEqual(VIETNAM_PROVINCES.slice(59).map(p => p.id), addedPoints.map(([id]) => id));
});

test("the four additions use exact existing GeoJSON property coordinates", () => {
  for (const [id, featureId] of addedPoints) {
    const feature = geoJson.features.find(f => f.properties.id === featureId);
    assert.ok(feature, featureId);
    const { name, latitude, longitude } = feature.properties;
    assert.deepEqual(VIETNAM_PROVINCES_BY_ID.get(id), { id, name, latitude, longitude });
  }
});

test("every frontend province name resolves to a unique shared weather sampling point", () => {
  assert.equal(geoJson.features.length, 63);
  const ids = geoJson.features.map(({ properties }) => {
    const province = findVietnamProvinceByName(properties.name);
    assert.ok(province, properties.name);
    return province.id;
  });
  assert.equal(new Set(ids).size, 63);
});

test("name lookup normalizes accents, case, whitespace, punctuation and city prefixes", () => {
  for (const name of ["TP. Hồ Chí Minh", "Hồ Chí Minh", "Ho Chi Minh", "  HO   CHI MINH  ",
    "Thành phố Hồ Chí Minh", "TP Ho Chi Minh", "ho-chi-minh"]) {
    assert.equal(normalizeProvinceName(name), "ho chi minh");
    assert.strictEqual(findVietnamProvinceByName(name), VIETNAM_PROVINCES_BY_ID.get("ho-chi-minh"));
  }
  for (const province of VIETNAM_PROVINCES) {
    assert.strictEqual(findVietnamProvinceByName(province.name.normalize("NFD")), province);
    assert.strictEqual(findVietnamProvinceByName(normalizeProvinceName(province.name)), province);
  }
  assert.equal(findVietnamProvinceByName("Tinh Dien Bien")?.id, "dien-bien");
  assert.equal(findVietnamProvinceByName("DA NANG")?.id, "da-nang");
  assert.equal(findVietnamProvinceByName("Ba Ria Vung Tau")?.id, "ba-ria-vung-tau");
  for (const name of ["", "   ", "Unknown", "Ho Chi", "Hanoi suburb"]) {
    assert.equal(findVietnamProvinceByName(name), undefined);
  }
});
