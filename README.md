# Intelligent Weather-Aware Travel Assistant for Vietnam

Web platform hỗ trợ người dùng đưa ra quyết định du lịch tại Việt Nam dựa trên weather data có nguồn, forecast, risk analysis và route evaluation theo ETA.

## Trạng thái kế hoạch

- Phase 0 — Discovery & Product Contract: `VERIFIED`.
- Phase 1 — Architecture & Non-Functional Requirements: `VERIFIED`.
- Phase 2 — Directus Foundation & Environments: `IN_PROGRESS — LOCAL_VERIFIED / REMOTE_CI_PENDING` (`PRODUCT-013`).
- Source of truth: [docs/Plan_Phases/index.md](docs/Plan_Phases/index.md).
- Trạng thái và blockers hiện tại: [docs/Plan_Phases/STATUS.md](docs/Plan_Phases/STATUS.md).
- Phase 1 evidence gate: [docs/Plan_Phases/PHASE_1_EVIDENCE.md](docs/Plan_Phases/PHASE_1_EVIDENCE.md).
- Phase 2 evidence gate: [docs/Plan_Phases/PHASE_2_EVIDENCE.md](docs/Plan_Phases/PHASE_2_EVIDENCE.md).

## Kiến trúc đã chốt

- Directus là primary backend, system of record và Admin Studio.
- Directus build baseline là `12.1.1`, pin bằng manifest digest; không dùng floating tag `latest` (`ARCH-011`).
- Map stack là MapLibre + Geoapify Free; browser chỉ tải tile/style, geocoding/routing vẫn qua backend (`ARCH-012`).
- Frontend Next.js + TypeScript + PWA chỉ gọi versioned `/api/v1`.
- PostgreSQL + PostGIS lưu durable/geospatial state; Redis dùng cho cache, queue, rate limit và coordination, không giữ business truth duy nhất.
- Integration worker riêng xử lý weather/routing provider, retry, scheduled jobs và payment reconciliation.
- Browser chỉ nhận opaque Secure HttpOnly session; không giữ Directus JWT/refresh token.
- Production Admin Studio chỉ qua VPN/IP allowlist.

## Product baseline

- Hai gói `Free` và `Pro`; Free có 10 location searches/ngày.
- Stripe và VNPay dùng qua backend payment adapters, chỉ enable capability có evidence thật.
- UI hỗ trợ `vi` và `en`; business/legal/advisory content quản lý qua Directus.
- Route/risk actionable tối đa 72 giờ trong phạm vi provider coverage; ngày 4–7 chỉ hiển thị outlook khi capability thật tồn tại và không tạo weather-safer recommendation (`DATA-004`, `ARCH-013`).

## Nguyên tắc bắt buộc

- Không hardcode location, provider, risk threshold, route weight, quota, price, translation, feature flag hoặc secret trong product code.
- Không dùng fake weather/payment/provider data để chứng minh production readiness.
- Frontend chỉ nhận request/response DTO; không chứa backend rule, credential hoặc Directus internals.
- Mọi thay đổi architecture/product gate phải cập nhật Decision ID, phase document, evidence manifest, status và README nếu ảnh hưởng overview.
- Chỉ chuyển phase sang `VERIFIED` khi có evidence có thể tái hiện.

## Kết quả Phase 1

Phase 1 đã được phê duyệt bằng `PRODUCT-012`. WeatherAPI là capability-bounded baseline và hiện chỉ được công bố current + 3-day coverage (`ARCH-013`); MapLibre + Geoapify đã vượt 30-location/30-route fixture và route-objective probe (`ARCH-012`). Stripe/VNPay vẫn feature-disabled cho tới khi có merchant evidence (`ARCH-010`, `OPS-006`). Chi tiết nằm trong [WEATHER_BAKEOFF_REPORT.md](docs/Plan_Phases/WEATHER_BAKEOFF_REPORT.md), [MAP_BAKEOFF_REPORT.md](docs/Plan_Phases/MAP_BAKEOFF_REPORT.md), [VIETNAM_PROVIDER_FIXTURE_REPORT.md](docs/Plan_Phases/VIETNAM_PROVIDER_FIXTURE_REPORT.md) và [PAYMENT_CAPABILITY_REPORT.md](docs/Plan_Phases/PAYMENT_CAPABILITY_REPORT.md). Credential chỉ nằm trong file local khớp `.env.*`, không commit và server credential không đưa vào frontend.

## Kết quả Phase 2 local

- Monorepo pnpm, worker health endpoint và Docker Compose production-like đã được triển khai.
- Directus `12.1.1`, PostGIS, Redis, Mailpit và Node image đều pin bằng digest; database/Redis không publish port ra host.
- Admin bootstrap đã rotate và bị loại khỏi runtime; schema baseline/drift, security foundation và seed audit idempotent đã pass.
- Gitleaks không phát hiện secret; worker SBOM CycloneDX đã tạo; backup đã restore thành công trong database tạm.
- Clean rebuild từ volume sạch đã pass. Phase 2 chưa đóng vì GitHub Actions/GHCR chưa chạy trên remote repository; không có evidence giả cho bước này.

## Validation

Chạy kiểm tra Stage 1 có thể tái hiện bằng:

```powershell
powershell -ExecutionPolicy Bypass -File tools/validation/validate-stage1.ps1
```

Validator không in secret; mọi lỗi làm command trả exit code khác 0.

Chạy toàn bộ validator local Stage 2 bằng:

```powershell
powershell -ExecutionPolicy Bypass -File tools/validation/validate-stage2.ps1
```

Clean rebuild local là thao tác xóa volume và chỉ chạy sau khi backup đã verify:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/rebuild-local.ps1 -ConfirmLocalDataReset
```

Geoapify live probe dùng [`tools/provider-bakeoff/run-geoapify-capability-probe.ps1`](tools/provider-bakeoff/run-geoapify-capability-probe.ps1). Trước khi chạy, tạo hai API key riêng và đặt `GEOAPIFY_TILE_API_KEY`, `GEOAPIFY_SERVER_API_KEY` trong `.env.bakeoff.local`; không gửi key qua chat và không commit file này. Runner yêu cầu search text cùng tọa độ route thật qua tham số, chỉ xuất JSON đã rút gọn và không lưu raw response.
