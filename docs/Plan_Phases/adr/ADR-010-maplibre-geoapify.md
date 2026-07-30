# ADR-010 — MapLibre and Geoapify Free Map Stack

**Status:** Accepted  
**Date:** 2026-07-30  
**Decision:** `ARCH-012`

## Bối cảnh

Mapbox yêu cầu card billing trong account flow của Product Owner. Tích hợp Mapbox, Google và HERE cùng lúc làm tăng SDK, billing, attribution và test matrix. Tự host tiles/geocoder/router lại tăng đáng kể vận hành VPS.

## Quyết định

Dùng MapLibre GL JS để render map và Geoapify Free cho tile/style, geocoding và routing. Browser chỉ tải tile/style trực tiếp bằng dedicated browser key; mọi geocoding/routing/business request đi qua `/api/v1` bằng server-side key riêng.

## Phương án đã xem xét

- **Mapbox:** workflow hiện tại yêu cầu card billing; bị loại khỏi MVP theo tiêu chí không phát sinh billing tự động.
- **Google Maps/HERE:** capability tốt nhưng thêm account/billing/SDK complexity; defer sau MVP.
- **Public OSM/Nominatim/OSRM demo:** bị loại làm production infrastructure vì usage policy, quota và không có SLA phù hợp.
- **Self-host tiles/geocoding/routing:** kiểm soát tốt nhưng quá phức tạp cho solo MVP.
- **MapLibre + Geoapify Free:** được chọn vì một platform, không yêu cầu card theo public pricing hiện tại và vẫn giữ renderer open-source.

## Trade-off và hệ quả

- Giảm account/provider complexity và không có automatic charge.
- Free credits, rate limit và best-effort support có thể không đáp ứng traffic lớn.
- Geoapify attribution và provider terms phải hiển thị/tuân thủ.
- Provider-neutral API/geometry DTO vẫn bắt buộc để có đường migration.

## Security impact

Tile/style browser key là publishable và tách khỏi server key. Server key không đi tới browser. Browser network allowlist chỉ cho approved Geoapify tile/style origins; geocoding/routing direct calls bị contract test chặn.

## Chi phí và vận hành

Baseline provider cost là 0 VND khi nằm trong Free plan. Theo public pricing kiểm tra 2026-07-30, account có 3.000 credits/ngày, tối đa 5 request/giây và không yêu cầu card. Không tự nâng paid plan; hết quota phải degrade rõ ràng.

## Migration và rollback

MapLibre renderer giữ độc lập với provider business DTO. Nếu Geoapify không đủ quota/coverage/terms, backend adapter có thể đổi và frontend chỉ thay style/tile configuration. Rollback tắt live map loads nhưng không được fallback sang public tile service trái policy.

## Evidence cần có

Initial probe, 30-route/30-location fixtures, reverse geocoding and route-objective probes passed on 2026-07-31. Phase 8/9 implement unavailable behavior and browser attribution/key restrictions; Phase 13 verifies account-dashboard reconciliation before production.
