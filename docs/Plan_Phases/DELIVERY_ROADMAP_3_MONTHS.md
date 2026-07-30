# Delivery Roadmap — 3-Month Production MVP

**Status:** PHASE_0_VERIFIED / PHASE_1_IN_PROGRESS
**Baseline kickoff:** 2026-07-30  
**Target go-live:** 2026-10-29  
**Decision:** `OPS-001`, `OPS-002`, `OPS-003`, `OPS-004`

## 1. Mục tiêu và cách hiểu deadline

Ba tháng là deadline cho production MVP, không chỉ là demo UI. Go-live chỉ được chấp nhận khi core flow dùng dữ liệu provider thật, backend enforcement hoạt động, payment webhook được xác minh, security gate đạt và có rollback/monitoring.

Timeline này dành cho một solo developer full-time. Budget ceiling ban đầu là 15 triệu VND/tháng, không gồm transaction fee. VPS inventory được defer tới Phase 13; provider terms và merchant onboarding vẫn phải được kiểm chứng trước khi tích hợp production.

## 2. Giả định bắt buộc để giữ deadline

- Có Product Owner phản hồi Decision Gate trong tối đa một ngày làm việc.
- Product Owner là solo developer full-time, dùng automation/evidence để bù cho việc không có independent reviewer mặc định.
- Development chạy local trước; staging/production được deploy reproducibly lên VPS do Product Owner quản lý, với HTTPS, firewall, off-site backup, monitoring và rollback.
- Weather, map/tile, geocoding và routing provider được chọn trong tuần 1; terms cho production được xác minh.
- Stripe/VNPay merchant onboarding bắt đầu ngay tuần 1. Không giả lập recurring hoặc production webhook capability.
- Chatbot không nằm trên critical path. Advanced animation chỉ đi sau current-weather map, forecast, risk và route flow ổn định.
- Frontend và backend phát triển contract-first; frontend dùng `/api/v1` DTO, ngoại trừ Geoapify tile/style allowlist theo `ARCH-012`. Mock chỉ được phép trong test/dev theo contract, không dùng làm production fallback.

## 3. Lịch thực thi 13 tuần

| Tuần | Phạm vi chính | Exit criteria bắt buộc |
|---|---|---|
| 1 — 30/07–05/08 | Phase 0–1: PRD, persona, provider/merchant feasibility, architecture, NFR, privacy inventory | Phase 0 VERIFIED; architecture/NFR decisions có owner và evidence |
| 2 — 06/08–12/08 | Phase 2–3: environments, Directus baseline, roles/policies, auth/session, audit, secrets | Dev/staging reproducible; auth/RBAC negative tests pass |
| 3 — 13/08–19/08 | Phase 4 + API contracts: data model, Admin Studio, seed/migration, `/api/v1`, i18n skeleton | Schema/seed idempotent; OpenAPI/DTO contracts approved |
| 4 — 20/08–26/08 | Phase 5 vertical slice: current weather ingestion/cache + authenticated current-weather map | Release Slice 1 demo bằng provider data thật, có source/freshness/error state |
| 5 — 27/08–02/09 | Phase 7: forecast, trend chart, timeline data contract | Forecast/trend flow pass contract, freshness và timezone tests |
| 6 — 03/09–09/09 | Phase 6: config-driven risk engine + advisory/admin workflow | Release Slice 2; rule version/evidence/explanation được audit |
| 7 — 10/09–16/09 | Phase 8A: routing alternatives, route sampling, ETA weather | Fastest/Shortest provider alternatives và segment weather verified |
| 8 — 17/09–23/09 | Phase 8B: Weather-safer/Balanced, GPS current location, active follow/reroute | Release Slice 3; route scoring, permission denial và reroute tests pass |
| 9 — 24/09–30/09 | Phase 9: frontend integration, responsive UX, i18n QA, current/future map effects | Core Free/Pro UI complete; mobile/accessibility/performance baseline pass |
| 10 — 01/10–07/10 | Phase 10A: entitlement/quota ledger, Stripe checkout/webhooks/refund/cancel | Stripe sandbox end-to-end and idempotency/reconciliation tests pass |
| 11 — 08/10–14/10 | Phase 10B: VNPay capability, checkout/webhooks/manual renewal if contract requires | Release Slice 4; VNPay behavior matches merchant capability, no fake auto-renew |
| 12 — 15/10–21/10 | Phase 12–13: security, load/resilience, backup/restore, observability, release candidate | No open critical/high security issue; RPO/RTO and rollback drill evidenced |
| 13 — 22/10–29/10 | Phase 14: UAT, legal/business QA, production deploy, smoke test, handover | Release Slice 5; Product Owner accepts, monitoring/support/rollback ready |

## 4. Vertical release slices

1. **Slice 1 — Auth + Current Weather Map:** login, protected product routes, GPS current location, current weather and source/freshness.
2. **Slice 2 — Forecast + Risk:** charts/timeline, versioned risk rules, bilingual advisory and unknown/stale states.
3. **Slice 3 — Route + GPS:** Fastest/Shortest/Weather-safer/Balanced, ETA weather, active follow and controlled reroute.
4. **Slice 4 — Pro + Payments:** backend quotas/entitlements, monthly/yearly Pro, Stripe/VNPay, webhook reconciliation and billing states.
5. **Slice 5 — Production Release:** security/performance/resilience evidence, UAT, deployment, monitoring, support and rollback.

## 5. Critical path và stop-the-line conditions

Critical path: Phase 0 decisions → provider/merchant feasibility → architecture/API contract → Directus security/data foundation → current weather → risk/forecast → routing → entitlement/payment → hardening → release.

Phải dừng release nếu có một trong các điều kiện sau:

- Không xác minh được license/terms hoặc production capability của provider.
- Có cách bypass authentication, role/policy, quota, entitlement hoặc payment state.
- Dữ liệu weather/risk không có source, valid time, freshness hoặc unknown state đúng contract.
- Webhook có thể tạo duplicate entitlement/charge state hoặc reconciliation chưa tái hiện được.
- Backup chưa restore thử, rollback chưa thử hoặc còn critical/high security finding.

## 6. Scope protection khi có nguy cơ trễ

Thứ tự cắt giảm hợp lệ: chatbot → push/offline → advanced overlay không thiết yếu → animation polish → analytics nâng cao. Không được cắt authentication/authorization, data provenance, payment correctness, i18n core, accessibility tối thiểu, monitoring, backup hoặc security gate.

Mỗi thay đổi deadline/scope phải ghi Decision ID, nguyên nhân, ảnh hưởng người dùng, ảnh hưởng chi phí và acceptance criteria mới.

## 7. Discovery evidence còn phải hoàn tất

PRD, provider comparison, privacy inventory và measurable acceptance metrics đã được Product Owner duyệt (`PRODUCT-011`). Provider/merchant feasibility và NFR tiếp tục được xác minh trong Phase 1. VPS hardware/region không chặn công việc local và chỉ cần chốt trước production deployment.
