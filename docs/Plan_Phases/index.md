# Intelligent Weather-Aware Travel Assistant for Vietnam

Đây là bộ kế hoạch chính thức cho sản phẩm trợ lý du lịch theo thời tiết tại Việt Nam.

## Cách sử dụng bộ kế hoạch

1. Đọc [PLAN_MASTER.md](PLAN_MASTER.md) để hiểu phạm vi, kiến trúc và nguyên tắc chung.
2. Đọc [DELIVERY_ROADMAP_3_MONTHS.md](DELIVERY_ROADMAP_3_MONTHS.md) để biết milestone, critical path và điều kiện giữ deadline.
3. Đọc [PRD.md](PRD.md), [PROVIDER_COMPARISON.md](PROVIDER_COMPARISON.md), [PRIVACY_INVENTORY.md](PRIVACY_INVENTORY.md) và [ACCEPTANCE_METRICS.md](ACCEPTANCE_METRICS.md) để hiểu product contract Phase 0.
4. Với Stage 1, đọc [ARCHITECTURE.md](ARCHITECTURE.md), [DIRECTUS_BASELINE.md](DIRECTUS_BASELINE.md), [DATA_FLOW.md](DATA_FLOW.md), [NFR_SLO.md](NFR_SLO.md), [THREAT_MODEL.md](THREAT_MODEL.md), [COST_ENVELOPE.md](COST_ENVELOPE.md), [PROVIDER_BAKEOFF.md](PROVIDER_BAKEOFF.md), [WEATHER_BAKEOFF_REPORT.md](WEATHER_BAKEOFF_REPORT.md), [MAP_BAKEOFF_REPORT.md](MAP_BAKEOFF_REPORT.md), [VIETNAM_PROVIDER_FIXTURE_REPORT.md](VIETNAM_PROVIDER_FIXTURE_REPORT.md), [PAYMENT_CAPABILITY_REPORT.md](PAYMENT_CAPABILITY_REPORT.md) và [PHASE_1_EVIDENCE.md](PHASE_1_EVIDENCE.md).
5. Với Phase 3, đọc [PHASE_3_AUTH_SESSION_CONTRACT.md](PHASE_3_AUTH_SESSION_CONTRACT.md), [PHASE_3_ROLE_POLICY_MATRIX.md](PHASE_3_ROLE_POLICY_MATRIX.md), [PHASE_3_RUNTIME_SECURITY.md](PHASE_3_RUNTIME_SECURITY.md), [PHASE_3_SECURITY_OPERATIONS.md](PHASE_3_SECURITY_OPERATIONS.md), [DIRECTUS_ENTITLEMENT_REPORT.md](DIRECTUS_ENTITLEMENT_REPORT.md) và [PHASE_3_EVIDENCE.md](PHASE_3_EVIDENCE.md).
6. Với Phase 4, đọc [PHASE_4_ERD.md](PHASE_4_ERD.md), [PHASE_4_DATA_DICTIONARY.md](PHASE_4_DATA_DICTIONARY.md), [PHASE_4_PERMISSION_MATRIX.md](PHASE_4_PERMISSION_MATRIX.md), [PHASE_4_RETENTION_MATRIX.md](PHASE_4_RETENTION_MATRIX.md), [PHASE_4_ADMIN_WALKTHROUGH.md](PHASE_4_ADMIN_WALKTHROUGH.md) và [PHASE_4_EVIDENCE.md](PHASE_4_EVIDENCE.md).
7. Kiểm tra [STATUS.md](STATUS.md) để biết phase nào đang được phép triển khai.
8. Trước mỗi phase, trả lời toàn bộ câu hỏi trong mục **Decision Gate** của phase đó.
9. Ghi phương án đã chốt vào [DECISIONS.md](DECISIONS.md) trước khi code.
10. Chỉ chuyển phase sang `VERIFIED` khi có đủ artifact và evidence theo Definition of Done.

## Quy tắc bắt buộc

- Directus là backend trung tâm của sản phẩm: authentication, authorization, Admin Studio, dữ liệu nghiệp vụ, API, audit và workflow.
- Không hardcode địa điểm, ngưỡng rủi ro, trọng số tuyến, provider, nội dung cảnh báo, product plan/quota, locale copy, feature flag hoặc secret.
- Không sử dụng dữ liệu giả trong production và không hiển thị fallback như dữ liệu thật.
- Không đánh dấu hoàn thành nếu chưa có code, test, tài liệu và evidence tái hiện được.
- Không bắt đầu phase kế tiếp nếu Decision Gate hoặc acceptance criteria của phase hiện tại chưa được duyệt.

## Danh sách phase

| Phase | Nội dung | Trạng thái hiện tại |
|---|---|---|
| 0 | [Discovery & Product Contract](phase-00-discovery.md) | VERIFIED |
| 1 | [Architecture & Non-Functional Requirements](phase-01-architecture.md) | VERIFIED |
| 2 | [Directus Foundation & Environments](phase-02-directus-foundation.md) | VERIFIED |
| 3 | [Identity, JWT, RBAC & Security](phase-03-security-identity.md) | VERIFIED |
| 4 | [Data Model, Governance & Admin Panel](phase-04-data-model-admin.md) | IN_PROGRESS (`LOCAL_IMPLEMENTATION_VERIFIED / REMOTE_CI_PENDING`) |
| 5 | [Weather Provider Integration](phase-05-weather-integration.md) | BLOCKED |
| 6 | [Config-Driven Weather Risk Engine](phase-06-risk-engine.md) | BLOCKED |
| 7 | [Forecast & Trend Experience](phase-07-forecast-trends.md) | BLOCKED |
| 8 | [Weather-Aware Route Planner](phase-08-route-planner.md) | BLOCKED |
| 9 | [Frontend Web Application](phase-09-frontend.md) | BLOCKED |
| 10 | [Monetization, Subscription & Entitlements](phase-10-monetization.md) | BLOCKED |
| 11 | [Optional AI Chatbot](phase-11-ai-chatbot.md) | BLOCKED/OPTIONAL |
| 12 | [Quality, Security Hardening & Observability](phase-12-quality-security.md) | BLOCKED |
| 13 | [Deployment, Release & Operations](phase-13-deployment-operations.md) | BLOCKED |
| 14 | [Business Readiness & Handover](phase-14-business-handover.md) | BLOCKED |

## Trạng thái hợp lệ

`DRAFT` → `AWAITING_DECISION` → `APPROVED` → `IN_PROGRESS` → `VERIFIED` → `RELEASED`

`BLOCKED` phải ghi rõ dependency hoặc quyết định đang thiếu. Không dùng phần trăm cảm tính để thay cho evidence.
