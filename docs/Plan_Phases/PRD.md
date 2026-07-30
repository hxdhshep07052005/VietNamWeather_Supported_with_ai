# Product Requirements Document

## 1. Document control

| Field | Value |
|---|---|
| Product | Intelligent Weather-Aware Travel Assistant for Vietnam |
| Version | 1.0 |
| Date | 2026-07-29 |
| Status | APPROVED — `PRODUCT-011` |
| Product Owner | Project owner — solo full-time developer |
| Related decisions | `PRODUCT-001..011`, `ARCH-001..003`, `DATA-001..003`, `SEC-001`, `OPS-001..004` |
| Target MVP | 2026-10-29 |

## 2. Product statement

Sản phẩm là web application thương mại public giúp khách du lịch tại Việt Nam hiểu thời tiết hiện tại, dự báo và rủi ro thời tiết tại địa điểm hoặc dọc tuyến đường. Hệ thống dùng dữ liệu provider thật, hiển thị nguồn và độ mới, đồng thời so sánh các route alternatives để hỗ trợ người dùng chọn tuyến nhanh nhất, ngắn nhất, ít rủi ro thời tiết hơn hoặc cân bằng.

Sản phẩm không phải dịch vụ khí tượng có thẩm quyền, không thay thế cảnh báo của cơ quan chức năng và không bảo đảm một tuyến đường an toàn tuyệt đối.

## 3. Problem and value proposition

### 3.1. Problems

- Dữ liệu thời tiết thường được xem tách rời khỏi kế hoạch di chuyển.
- Một dự báo tại điểm đến không phản ánh điều kiện tại các đoạn đường và thời điểm dự kiến đi qua.
- Khách du lịch khó hiểu ý nghĩa thực tế của mưa lớn, gió, tầm nhìn, nhiệt độ hoặc cảnh báo đối với chuyến đi.
- Các ứng dụng routing thông thường tối ưu thời gian/khoảng cách nhưng không xếp hạng route theo forecast tại ETA.

### 3.2. Value

- Một bản đồ thống nhất cho current weather, forecast, weather effects và travel advisory.
- Forecast/trend có source, `issued_at`, `valid_at`, `fetched_at` và freshness state.
- Route alternatives được phân tích theo weather tại ETA và giải thích yếu tố rủi ro.
- Free/Pro rõ ràng, enforcement ở backend, hỗ trợ thanh toán quốc tế và Việt Nam khi merchant capability hợp lệ.
- Việt–Anh từ MVP, ưu tiên mobile cho khách đang di chuyển.

## 4. Personas

### 4.1. Primary — Independent traveler

- Khách Việt Nam hoặc quốc tế đang ở hoặc chuẩn bị đi trong Việt Nam.
- Thường dùng điện thoại, có thể ở nơi mạng không ổn định.
- Cần quyết định đi lúc nào, đi tuyến nào và điều kiện nào cần chú ý.
- Không được giả định có kiến thức khí tượng chuyên sâu.

### 4.2. Support — Admin/operations

- Quản lý catalog địa điểm, bản dịch, advisory, risk rules, feature flags, plans/quotas và provider configuration trong Directus Admin Studio.
- Cần audit trail, draft/review/publish workflow và rollback.
- Không truy cập production bằng Super Admin cho công việc thường ngày.

## 5. Core user journeys

### Journey A — Discover current conditions

1. Anonymous visitor đọc landing/pricing/legal content.
2. Khi mở product feature, hệ thống yêu cầu đăng nhập.
3. User tìm địa điểm hoặc cho phép GPS.
4. Map hiển thị current weather, source, update time và current weather effects.
5. User mở location detail để xem forecast, trend và advisory.

### Journey B — Plan a trip

1. User chọn origin/destination hoặc dùng current GPS làm origin.
2. Backend lấy route alternatives từ routing provider.
3. Backend sample route, tính ETA và lấy weather phù hợp cho từng segment.
4. Risk engine áp dụng versioned rules và trả evidence/explanation.
5. UI so sánh Fastest, Shortest, Weather-safer và Balanced trong tập alternatives provider trả về.
6. User có thể lưu route nếu còn entitlement.

### Journey C — Follow while moving

1. User cấp browser geolocation permission và bật follow mode.
2. Marker cập nhật khi web/PWA còn hoạt động.
3. Khi lệch route vượt threshold cấu hình, backend có thể đề nghị/tạo reroute theo policy.
4. User có thể dừng tracking; GPS liên tục không được lưu mặc định.

### Journey D — Upgrade to Pro

1. User xem quota/paywall và chọn monthly hoặc yearly.
2. Backend trả các payment methods hợp lệ theo merchant/currency/market.
3. User hoàn tất hosted checkout/token flow của Stripe hoặc VNPay.
4. Webhook/IPN được xác thực và cập nhật subscription ledger idempotently.
5. Backend cấp entitlement; frontend chỉ render subscription state từ API.

## 6. Access and entitlement matrix

| Capability | Anonymous | Free | Pro | Admin/operations |
|---|---:|---:|---:|---:|
| Landing, pricing, legal, login/register | Yes | Yes | Yes | Yes |
| Product map/current weather | No | Yes | Yes | By role |
| Location search | No | 10/day | 200/day | Configurable |
| Forecast | No | Backend-published Free horizon, capped by provider coverage; currently 3 days | Full provider-approved horizon subject to confidence policy | Manage content/config |
| Route evaluations | No | 3/day | 30/day | Operational access only |
| Route alternatives shown | No | 1 | Up to 3 | N/A |
| Saved locations | No | 3 | 50 | Moderation/admin only |
| Saved routes | No | 1 | 20 | Operational access only |
| Search/route history | No | 7 days | 90 days | Audit access by policy |
| Current weather effects | No | Yes | Yes | Configure availability |
| Future animation/advanced overlays | No | No | Yes | Configure availability |
| Optional chatbot | No | 3 messages/day | 30 messages/day | Configure/observe safely |

Quota reset: 00:00 `Asia/Ho_Chi_Minh`; timestamps stored UTC. Limits are Directus-managed configuration, not frontend constants.

## 7. Functional requirements

### 7.1. Identity and account

- `FR-AUTH-001`: Directus/backend owns account, authentication, session refresh/revoke and authorization.
- `FR-AUTH-002`: Anonymous access is denied at API level for every product endpoint.
- `FR-AUTH-003`: Browser session design prioritizes same-origin Secure, HttpOnly cookie transport; refresh/static tokens are not stored in frontend storage.
- `FR-AUTH-004`: User can view profile, locale, plan, quota reset time and subscription status.
- `FR-AUTH-005`: Account deletion/export requests are supported through auditable backend workflows.

### 7.2. Application API boundary

- `FR-API-001`: Frontend calls versioned Application API such as `/api/v1`; `ARCH-012` permits only Geoapify tile/style loading directly for MapLibre rendering.
- `FR-API-002`: Frontend never calls generic Directus collections/GraphQL, database, worker, geocoding/routing/weather/payment/AI provider directly. The tile/style exception cannot execute business operations.
- `FR-API-003`: API responses use public DTOs, structured error codes, request correlation IDs and documented schemas.
- `FR-API-004`: Provider payload, internal collection/field names, secrets and stack traces never appear in public responses.

### 7.3. Search, map and current weather

- `FR-MAP-001`: Search supports valid coordinates/locations throughout Vietnam subject to provider coverage.
- `FR-MAP-002`: Directus maintains a curated catalog of highlighted destinations independently from provider search.
- `FR-MAP-003`: Every weather response includes provider/source, location reference, `issued_at` when available, `valid_at`, `fetched_at` and freshness state.
- `FR-MAP-004`: Current map effects may show rain, cloud, sun/day-night and wind only when supported by real current data/layers.
- `FR-MAP-005`: Unknown, stale, rate-limited and unavailable states are explicit; no fake fallback weather.
- `FR-MAP-006`: Provider attribution remains visible according to contract.

### 7.4. Forecast and trends

- `FR-FCST-001`: Forecast shows hourly/daily values within the entitlement and provider contract.
- `FR-FCST-002`: Charts display units, timezone, source and currently viewed `valid_at`.
- `FR-FCST-003`: Pro may use future timeline and advanced overlays when provider data supports the selected time.
- `FR-FCST-004`: Theo `DATA-004`, route/risk dùng operational horizon tối đa 72 giờ; ngày 4–7 là outlook/low-confidence và không được silently drive travel-safety recommendations.
- `FR-FCST-005`: Animation has play/pause, layer toggle, reduced-motion behavior and static fallback.

### 7.5. Risk engine

- `FR-RISK-001`: Thresholds, priorities, weights, advisory copy and validity dates are versioned Directus configuration.
- `FR-RISK-002`: Output contains level, score if used, triggered rules, evidence, explanation and rule version.
- `FR-RISK-003`: Missing input produces `unknown` or reduced-confidence state, not a safe result.
- `FR-RISK-004`: Rules cannot publish without source/reference and approval evidence.
- `FR-RISK-005`: UI always shows disclaimer and official emergency/advisory links configured by locale.

### 7.6. Route planner and GPS

- `FR-ROUTE-001`: Backend geocodes origin/destination and requests provider route alternatives.
- `FR-ROUTE-002`: Fastest/Shortest are rankings within returned alternatives; Weather-safer/Balanced add versioned weather-risk scoring.
- `FR-ROUTE-003`: Route sampling and ETA calculation are deterministic and record provider/reference versions.
- `FR-ROUTE-004`: Each risk segment references weather valid for its ETA or explicitly reports temporal mismatch/unknown.
- `FR-ROUTE-005`: GPS current location and `watchPosition` follow require explicit permission and an active browser/PWA.
- `FR-ROUTE-006`: GPS updates do not consume route quota; backend route/reroute requests do.
- `FR-ROUTE-007`: Background turn-by-turn with a closed/suspended browser is outside MVP.

### 7.7. Subscription and payment

- `FR-PAY-001`: Only Free and Pro exist in MVP; Pro supports monthly/yearly, with yearly price equal to ten monthly periods.
- `FR-PAY-002`: Exact prices, currencies and enabled payment methods are Directus configuration and backend-validated.
- `FR-PAY-003`: Stripe is enabled only for a legally eligible merchant entity; Vietnam is not assumed eligible for direct account registration.
- `FR-PAY-004`: VNPay auto-renew is enabled only if merchant contract/API supports the required token/off-session behavior. Otherwise VNPay sells prepaid periods with manual renewal.
- `FR-PAY-005`: Webhook/IPN signature/checksum, replay protection, idempotency, ordering and reconciliation are mandatory.
- `FR-PAY-006`: Billing provider state is not the authorization engine; backend entitlement projection is authoritative after validation.
- `FR-PAY-007`: Refund, cancellation, failed payment, expiration and grace states are explicit and auditable.

### 7.8. i18n and admin

- `FR-I18N-001`: Core UI, API user messages, advisory, billing and legal content support `vi` and `en` from MVP.
- `FR-I18N-002`: Locale keys/copy are not scattered hardcoded business content.
- `FR-ADMIN-001`: Admin Studio manages reference data, rules, translations, plans, quotas, feature flags and operational content by role/policy.
- `FR-ADMIN-002`: Draft/review/publish and audit apply to safety/billing content.

### 7.9. Optional AI

- `FR-AI-001`: Chatbot is outside the core delivery critical path.
- `FR-AI-002`: AI runs only on backend and uses allowlisted tools with independent authorization.
- `FR-AI-003`: Model never receives JWT, refresh token, credentials, unrestricted database access or raw user collections.
- `FR-AI-004`: Weather answers cite source and data time; unsupported questions return a bounded response.

## 8. Data and configuration principles

- No hardcoded locations, risk thresholds, route weights, quotas, prices, translations, provider endpoints, feature flags or secrets in product code.
- Production never seeds fake weather, fake payments, demo users, passwords or static tokens.
- Reference/config seeds are versioned, environment-specific and idempotent.
- All timestamps are stored UTC; quota day uses `Asia/Ho_Chi_Minh`.
- Precise GPS is ephemeral by default. Search history is optional and user-controllable.

## 9. MVP and non-goals

### Core MVP

- Protected responsive web application and Directus Admin Studio.
- Current weather map, forecast/trends, risk engine, route planner and active GPS follow.
- Free/Pro quotas and entitlement enforcement.
- Stripe conditional integration and VNPay merchant-capability integration.
- Việt–Anh, security hardening, monitoring, backup/restore and production handover.

### Non-goals

- Native mobile background navigation, offline maps and guaranteed turn-by-turn while the browser is closed.
- Hotel/ticket booking or travel marketplace.
- Training a meteorological forecast model.
- Guaranteeing safety or replacing government alerts.
- Storing card number/CVV.
- Multi-tenant SaaS.
- Chatbot if it threatens the core release.

## 10. Release slices

1. Auth + current weather map.
2. Forecast + risk.
3. Route + GPS.
4. Pro + payments.
5. Production release and handover.

Detailed dates and exit criteria are in [DELIVERY_ROADMAP_3_MONTHS.md](DELIVERY_ROADMAP_3_MONTHS.md).

## 11. Dependencies and unresolved decisions

- Geoapify Free is selected for map/geocoding/routing under `ARCH-012` with full live fixture evidence. WeatherAPI is selected as a capability-bounded point-weather baseline under `ARCH-013`; current account output is current + 3 days, and day 4–7 stays disabled until real capability exists.
- Exact Pro monthly price and currency display are selected in Phase 10.
- Stripe requires an eligible merchant entity; otherwise it remains disabled without changing the adapter contract.
- VNPay tokenized unattended renewal requires written merchant confirmation.
- Risk thresholds được chọn ở Phase 6 với nguồn dẫn; operational forecast horizon đã được chốt ở Phase 1 theo `DATA-004` và phải review lại bằng provider evidence.
- VPS inventory is deferred to Phase 13.

## 12. Product acceptance

Release acceptance uses [ACCEPTANCE_METRICS.md](ACCEPTANCE_METRICS.md). Privacy and retention requirements use [PRIVACY_INVENTORY.md](PRIVACY_INVENTORY.md). This PRD is approved only when Product Owner explicitly accepts the Phase 0 evidence manifest.
