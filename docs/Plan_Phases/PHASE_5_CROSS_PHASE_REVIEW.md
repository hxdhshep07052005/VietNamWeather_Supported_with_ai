# Phase 5 Cross-Phase Review

**Date:** 2026-08-09  
**Status:** REVIEW_COMPLETE / DECISION_PENDING  
**Scope:** Phase 5 đối chiếu Phase 0-14, PRD, architecture, ADR, NFR, privacy, retention và provider evidence.

## 1. Kết luận

Phase 5 không được triển khai chính thức cho tới khi:

1. Phase 4 có commit cuối và remote CI xanh theo `PRODUCT-016`.
2. Product Owner đóng Decision Gate Phase 5 và ghi Decision ID trước khi code.
3. WeatherAPI credential từng xuất hiện trong chat được rotate/revoke và replacement key chỉ nằm trong protected runtime secret.
4. Account/plan/capability hiện tại được xác nhận lại bằng live probe không ghi raw response hoặc secret.

## 2. Baseline không mở lại

- Primary point-weather provider là WeatherAPI theo `ARCH-013` và ADR-011.
- Không có silent fallback; OpenWeather Current 2.5 không thay thế One Call 4.0.
- Không mix provider trong cùng response hoặc assessment.
- Trần operational cho risk/route là 72 giờ, nhưng effective coverage luôn là phần nhỏ hơn giữa entitlement, configured maximum và coverage provider thực trả.
- Day 4-7, alert completeness và spatial weather layer giữ capability-disabled cho tới khi có live evidence.
- Không lưu raw provider payload trong production path. Recorded fixture chỉ dùng cho test, phải sanitize và không chứa credential/user data.

## 3. Ràng buộc provider hiện tại

Terms/pricing công khai được kiểm tra ngày 2026-08-09:

- Commercial use được phép; Free plan yêu cầu ghi WeatherAPI.com là nguồn.
- Cache current conditions tối đa 60 phút và forecast tối đa 24 giờ.
- Không được lưu dữ liệu quá thời hạn subscription.
- Current conditions có update target khoảng 15 phút; forecast update theo model run nhiều giờ một lần.
- Dữ liệu weather không được là nguồn duy nhất cho quyết định safety-critical.
- Sản phẩm phải hiển thị disclaimer rõ cho end user và hướng người dùng tới nguồn khí tượng/cơ quan chính thức khi quyết định liên quan an toàn.

Nguồn truy cập: `https://www.weatherapi.com/terms.aspx`, `https://www.weatherapi.com/pricing.aspx`, `https://www.weatherapi.com/docs/`.

## 4. Xung đột và cách xử lý

| Mức | Xung đột/phụ thuộc | Quyết định xử lý đề xuất |
|---|---|---|
| BLOCKER | Phase 5 phụ thuộc Phase 4 `VERIFIED`, nhưng remote CI chưa có | Commit/push Phase 4, ghi CI run và closure trước khi đổi Phase 5 sang `IN_PROGRESS` |
| BLOCKER | Credential cũ phải rotate; capability account có thể đã đổi | Xác nhận rotation và chạy lại capability probe bằng replacement key |
| HIGH | Phase 5 line 19 nhắc raw response nhưng Phase 4 đã chốt không lưu raw | Giữ no-raw production; chỉ lưu normalized fields, checksum, parser version và sanitized run metadata |
| HIGH | OpenAPI là source of truth nhưng repo chưa có weather OpenAPI | Phase 5 phải tạo versioned OpenAPI/DTO/error catalogue trước consumer Phase 6-10 |
| HIGH | Worker mới có health server, chưa có durable ingestion/retry/DLQ | Worker sở hữu provider call/normalize/retry; PostgreSQL/Directus giữ durable truth; Redis chỉ cache/coordination |
| HIGH | Admin-configured provider URL có SSRF risk | Runtime chỉ gọi provider key/origin nằm trong deployment allowlist; không fetch URL tùy ý |
| HIGH | Roadmap yêu cầu map UI ở Slice 1 nhưng Phase 9 sở hữu frontend | Phase 5 chứng minh API/degraded contract; browser/map/white-page/bundle evidence thuộc Phase 9 |
| MEDIUM | Roadmap đặt Phase 7 trước Phase 6 dù Phase 7 yêu cầu Phase 6 API ổn định | Chốt risk API skeleton trước Phase 7 hoặc đảo thứ tự thực thi; không hardcode risk shape trong forecast UI |
| MEDIUM | Timezone/unit UX xuất hiện ở Phase 5, 7 và 9 | Phase 5 chốt UTC storage + metric DTO; display timezone/unit UX thuộc Phase 7/9 |

## 5. Contract phải ổn định cho phase sau

Phase 5 phải cung cấp provider-neutral contract cho:

- Current, hourly và daily data với explicit normalized units.
- Observation/forecast distinction, missing fields và quality state; không dùng zero thay missing.
- Provider/source, attribution, parser version, nullable provider-issued time, valid interval, fetched time và expiry.
- Freshness state `fresh`, `stale`, `expired`, `unavailable` cùng display/risk/route eligibility.
- Capability response tách account capability, provider-valid coverage, operational horizon và entitlement.
- Structured error có stable code, correlation ID và retryable flag; không lộ provider URL/key/raw message.
- Idempotency dựa trên provider, normalized target, granularity, logical snapshot và valid interval.

## 6. Phân chia owner

| Phase | Phase 5 cung cấp | Defer đúng owner |
|---|---|---|
| 6 | Normalized evidence, freshness/eligibility, valid time | Risk level, threshold, aggregation, advisory |
| 7 | Hourly/daily series, gaps, timezone metadata, capability horizon | Chart/trend definition và display timezone UX |
| 8 | Point/time-window weather lookup và actual coverage | Route sampling, interpolation, ETA tolerance và scoring |
| 9 | Typed DTO, errors, attribution và degraded states | Browser rendering, map, GPS, i18n và bundle evidence |
| 10 | Capability ceiling | Entitlement/quota/billing enforcement |
| 11 | Bounded weather tool DTO | LLM/provider/prompt/chat retention |
| 12 | Contract fixtures và failure hooks | Full load, chaos, DAST và release security evidence |
| 13 | Worker commands, metrics, retry/DLQ và purge interface | Production scheduler, alerts, deployment và retention execution |
| 14 | Stable API/runbook/limitations | UAT, legal review và handover |

## 7. Baseline khuyến nghị để duyệt

1. WeatherAPI primary; fallback `none`; provider mixing `false`; automatic provider spend `0 VND`.
2. MVP expose current, hourly 1 giờ và daily 1 ngày trong coverage account thực trả, tối đa 72 giờ operational; day 4-7 disabled.
3. UTC storage, metric SI public DTO, canonical timezone `Asia/Ho_Chi_Minh`; UX chọn timezone/unit defer Phase 7/9.
4. Current fresh tối đa 15 phút; forecast fresh tối đa 6 giờ.
5. Stale display tối đa 60 phút cho current và 24 giờ cho forecast, đúng trần cache terms; stale không đủ điều kiện cho risk/route.
6. Raw payload không lưu; normalized current retention tối đa 60 phút; normalized forecast retention tối đa 24 giờ; sanitized provider-run metadata đề xuất 30 ngày và không chứa raw coordinate/token/request URL.
7. API timeout/degraded response không quá 3 giây; retry bounded trong worker; không retry lỗi auth/schema/quota cứng.
8. Free plan attribution và end-user safety disclaimer là contract bắt buộc cho Phase 9/14.

Các giá trị trên chỉ trở thành approved baseline sau khi Product Owner xác nhận và được ghi vào `DECISIONS.md`.

## 8. Gate triển khai

Phase 5 có thể đổi sang `IN_PROGRESS` khi Phase 4 remote closure, credential rotation, account revalidation và Decision Gate đều hoàn tất. Production scheduler/alert, browser UI, risk logic, routing, payment và AI là deferred scope hợp lệ, không chặn implementation local/offline của Phase 5 sau khi các gate trên đóng.
