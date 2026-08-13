# Intelligent Weather-Aware Travel Assistant for Vietnam

Web platform hỗ trợ người dùng đưa ra quyết định du lịch tại Việt Nam dựa trên weather data có nguồn, forecast, risk analysis và route evaluation theo ETA.

## Trạng thái kế hoạch

- Phase 0 — Discovery & Product Contract: `VERIFIED`.
- Phase 1 — Architecture & Non-Functional Requirements: `VERIFIED`.
- Phase 2 — Directus Foundation & Environments: `VERIFIED` (`PRODUCT-014`).
- Phase 3 — Identity, JWT, RBAC & Security: `VERIFIED` (`PRODUCT-016`, CI `30852140331`).
- Phase 4 — Data Model, Governance & Admin Panel: `VERIFIED` (`PRODUCT-016`).
- Phase 5 — Weather Integration: `VERIFIED` (`ARCH-016`, `DATA-008`).
- Phase 6 — Config-Driven Weather Risk Engine: `IN_PROGRESS` (`RISK-001..007`).
- Source of truth: [docs/Plan_Phases/index.md](docs/Plan_Phases/index.md).
- Trạng thái và blockers hiện tại: [docs/Plan_Phases/STATUS.md](docs/Plan_Phases/STATUS.md).
- Phase 1 evidence gate: [docs/Plan_Phases/PHASE_1_EVIDENCE.md](docs/Plan_Phases/PHASE_1_EVIDENCE.md).
- Phase 2 evidence gate: [docs/Plan_Phases/PHASE_2_EVIDENCE.md](docs/Plan_Phases/PHASE_2_EVIDENCE.md).
- Phase 3 evidence gate: [docs/Plan_Phases/PHASE_3_EVIDENCE.md](docs/Plan_Phases/PHASE_3_EVIDENCE.md).
- Phase 3 authorization validator: `pnpm run validate:stage3`.
- Phase 4 evidence gate: [docs/Plan_Phases/PHASE_4_EVIDENCE.md](docs/Plan_Phases/PHASE_4_EVIDENCE.md).
- Phase 4 data-model/admin validator: `pnpm run validate:stage4`.
- Directus runtime entitlement gate: [docs/Plan_Phases/DIRECTUS_ENTITLEMENT_REPORT.md](docs/Plan_Phases/DIRECTUS_ENTITLEMENT_REPORT.md).
- License inspection/gate: `pnpm run inspect:directus-license` / `pnpm run validate:directus-license`.

## Kiến trúc đã chốt

- Directus là primary backend, system of record và Admin Studio.
- Directus build baseline là `12.1.1`, pin bằng manifest digest; không dùng floating tag `latest` (`ARCH-011`).
- Map stack là MapLibre + Geoapify Free; browser chỉ tải tile/style, geocoding/routing vẫn qua backend (`ARCH-012`).
- Frontend Next.js + TypeScript + PWA chỉ gọi versioned `/api/v1`.
- PostgreSQL + PostGIS lưu durable/geospatial state; Redis dùng cho cache, queue, rate limit và coordination, không giữ business truth duy nhất.
- Integration worker riêng xử lý weather/routing provider, retry, scheduled jobs và payment reconciliation.
- Browser chỉ nhận opaque Secure HttpOnly session; không giữ Directus JWT/refresh token.
- Thin Application API lưu hash session và token Directus đã mã hóa trong PostgreSQL; Redis chỉ giữ rate-limit/coordination state.
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

## Kết quả Phase 2

- Monorepo pnpm, worker health endpoint và Docker Compose production-like đã được triển khai.
- Directus `12.1.1`, PostGIS, Redis, Mailpit và Node image đều pin bằng digest; database/Redis không publish port ra host.
- Admin bootstrap đã rotate và bị loại khỏi runtime; schema baseline/drift, security foundation và seed audit idempotent đã pass.
- Gitleaks không phát hiện secret; worker SBOM CycloneDX đã tạo; backup đã restore thành công trong database tạm.
- Clean rebuild từ volume sạch đã pass.
- GitHub Actions run `30577216479` pass cả hai job; source SBOM artifact đã upload và worker image immutable theo commit `3ac524579308e1f7365370643ed7257a22570acd` đã publish lên GHCR.

## Tiến độ Phase 3

- Directus least-privilege baseline có 13 role, 13 policy, 13 access link và đúng 7 self-TFA permission cho human staff; chưa role nào có business collection permission. Apply idempotent và negative test đã pass.
- Application API `/api/v1` đã có login, refresh rotation, logout/revoke, opaque `__Host-` cookie, signed CSRF, exact-origin CORS, secure headers, Redis rate limit và payload limit.
- Session store dùng DB identity riêng trên schema `app_security`; Directus token được AES-256-GCM encrypt, raw session handle không lưu DB, browser response/log scan không thấy backend token marker.
- Password, status, role, MFA-secret hoặc user deletion trong Directus tự revoke application session; retention preview/purge bị khóa khỏi API DB role và rollback drill đã pass.
- Password recovery native Directus đã được bọc bằng Application API bridge: token query chỉ tồn tại ở consume request đã redacted, token được mã hóa server-side, redirect sạch dùng opaque fragment handle, replay bị deny và reset revoke session cũ.
- Registration/email verification đi qua Application API: response generic không lộ account, Directus tạo user `unverified`, token chỉ lưu encrypted server-side, browser nhận opaque fragment handle và replay bị deny.
- Application API encryption key có transactional rotation tool; rollback drill và committed local rotation đã giữ nguyên active session sau API restart.
- Redis được coi là dependency bắt buộc cho rate limit: readiness trả `503/not_ready`, auth route fail với lỗi retryable và không chuyển sang authorization/rate-limit fallback khi Redis mất.
- Open Innovation Grant đã được Directus xác nhận `active`, bật production/custom permissions và được inject chỉ qua `.env.local` Git-ignore.
- Admin và managed staff TOTP enrollment, missing-OTP denial, OTP login, admin recovery và session revoke đã pass; direct generic TFA mutation, role mutation và cross-user TFA mutation đều bị chặn.
- Live tests dùng Directus/PostgreSQL/Redis thật đã pass và xóa/rollback temporary account/session/audit sau test.
- Phase 3 đã `VERIFIED`: CI run `30852140331` pass trên commit `f91f549`, closure được duyệt tại `PRODUCT-016`. WireGuard và production retention scheduler vẫn thuộc Phase 13 theo local-first contract.

## Tiến độ Phase 4

- PostgreSQL/PostGIS và Directus đã có 40 business collections versioned cho location/admin hierarchy, weather provenance, risk, route, content/config, product/quota, billing và user-owned data.
- Administrative hierarchy hỗ trợ province/municipality/city và optional district/lower levels theo source version; không hardcode số tỉnh/thành và chưa import địa danh khi chưa có source/license/checksum được duyệt.
- Governance trigger chặn invalid workflow, risk self-approval, sửa rule sau submit và thay đổi/xóa identity của usage/payment event.
- Directus có dashboard 4 panel, 7 role presets và 149 business permissions; Stage 3 bootstrap chạy lại không xóa permission Stage 4.
- Approved config seed chỉ chứa `vi`/`en`, Free/Pro plan, feature, entitlement và usage policy đã có decision; không seed location, weather, payment, provider hay demo user.
- Positive/cross-user test dùng hai traveler ephemeral thật đã pass cho favorite và saved route; cleanup xác nhận còn 0 fixture.
- `pnpm run validate:stage4` đã pass local và remote CI đã verified.

## Tiến độ Phase 5

- WeatherAPI adapter với SSRF protection, error classification và circuit breaker.
- Response normalization: 80+ WeatherAPI condition codes mapped to canonical weather conditions.
- Worker durable runtime: lease-based heartbeat, exponential backoff with jitter, dead-letter handling.
- Weather service với Redis cache: contract-valid responses, TTL boundary, stale marking.
- Database schema: 4 tables (provider_runs, weather_observations, weather_hourly_forecasts, weather_daily_forecasts), 10 indexes, 8 constraints.
- Worker security: least privilege role `app_weather_worker`, SQL-only operations.
- Retention policy: 60 min (current), 24 hours (forecast), 30 days (metadata).
- `pnpm run validate:stage5` đã pass với 16 gates verified.

## Tiến độ Phase 6

- Decision Gate đã được chốt: `RISK-001..007`.
- Risk levels: Low (1), Caution (2), High (3), Unknown (4).
- Risk dimensions: Precipitation, Wind, Temperature, Visibility, Thunderstorm, Official Alert.
- Aggregation: Priority-based max severity.
- Baseline thresholds đã được định nghĩa.
- Đang implement: Database schema, Directus schema, Risk Engine core.

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

Xác minh evidence GitHub Actions/GHCR của Stage 2 bằng:

```powershell
powershell -ExecutionPolicy Bypass -File tools/validation/validate-stage2-remote.ps1
```

Chạy Phase 3 security/runtime baseline bằng:

```powershell
pnpm run validate:stage3
```

Validator này build lại Application API image, chạy Directus role-policy/default-deny tests, unit/security tests, live auth/session/password-recovery/email-verification/identity-revoke, encryption-key rollback, retention và MFA drills; temporary fixtures được cleanup/rollback và secret/token không được in.

Chạy Phase 4 data-model/governance/Admin Studio baseline bằng:

```powershell
pnpm run validate:stage4
```

Validator này apply migration/permission/seed idempotently, restart Directus để làm mới schema metadata, kiểm tra schema drift, constraint/index/trigger/dashboard/preset, API DB denial, governance và traveler ownership/cross-user denial. Mọi fixture được rollback/xóa và kiểm tra còn 0 row.

Chạy Phase 5 weather integration baseline bằng:

```powershell
pnpm run validate:stage5
```

Validator này verify WeatherAPI adapter, normalization, worker runtime, weather service, cache, database schema, security, contracts, OpenAPI, seed, retention policy, tests passed, no raw payload và no fake weather.

Clean rebuild local là thao tác xóa volume và chỉ chạy sau khi backup đã verify:

```powershell
powershell -ExecutionPolicy Bypass -File tools/environment/rebuild-local.ps1 -ConfirmLocalDataReset
```

Geoapify live probe dùng [`tools/provider-bakeoff/run-geoapify-capability-probe.ps1`](tools/provider-bakeoff/run-geoapify-capability-probe.ps1). Trước khi chạy, tạo hai API key riêng và đặt `GEOAPIFY_TILE_API_KEY`, `GEOAPIFY_SERVER_API_KEY` trong `.env.bakeoff.local`; không gửi key qua chat và không commit file này. Runner yêu cầu search text cùng tọa độ route thật qua tham số, chỉ xuất JSON đã rút gọn và không lưu raw response.
