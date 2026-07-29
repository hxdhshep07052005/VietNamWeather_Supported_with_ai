# Phase 1 — Architecture & Non-Functional Requirements

**Status:** BLOCKED  
**Phụ thuộc:** Phase 0 VERIFIED  
**Mục tiêu:** Chốt kiến trúc production, ranh giới trách nhiệm và các yêu cầu phi chức năng trước khi dựng hệ thống.

## Phạm vi công việc

### 1. Architecture decisions

- Directus là primary backend, API gateway nghiệp vụ và system of record.
- Chọn Directus Cloud hoặc self-hosted sau khi đánh giá license, chi phí, extension và vận hành.
- Chọn ranh giới giữa Directus Flows, custom endpoint/hook và integration worker.
- Chọn PostgreSQL hay PostgreSQL + PostGIS.
- Chọn Redis/cache/queue strategy và object storage.
- Chọn payment integration boundary: Directus extension/worker và provider webhook ingress.
- Chọn subscription/entitlement projection strategy; billing provider không bị coi là authorization engine.
- Chọn frontend framework và phương thức giao tiếp với versioned Application API; không expose generic Directus API.
- Quy định frontend không gọi trực tiếp weather/routing/LLM provider.
- Chọn i18n storage boundary: frontend UI locale catalog, Directus translated content và message fallback.
- Theo `ARCH-003`, thiết kế versioned Application API facade; frontend không gọi generic Directus REST/GraphQL hoặc collection endpoints.
- Chốt public DTO, OpenAPI/schema, error contract, pagination, versioning và deprecation policy.

### 2. Non-functional requirements

- Định nghĩa SLO availability, API latency và data freshness.
- Định nghĩa RPO/RTO, backup, restore drill và disaster recovery.
- Xác định tải dự kiến: user đồng thời, request/phút, số route evaluation và số location refresh.
- Xác định performance budget cho mobile và bản đồ.
- Xác định browser support, accessibility target và localization.
- Xác định latency/freshness cho entitlement và thời gian tối đa để đồng bộ payment webhook.

### 3. Threat modeling

- Lập data-flow diagram và trust boundaries.
- Phân tích token theft, privilege escalation, API abuse, SSRF qua provider URL, injection, IDOR và secret leakage.
- Phân loại dữ liệu và xác định nơi mã hóa/in transit/at rest.
- Chốt network exposure cho Directus, database, Redis, worker và Admin Studio.

### 4. Architecture records

- Viết ADR cho deployment model, extension/worker, database geospatial, auth transport và frontend stack.
- Mỗi ADR phải có trade-off, security impact, cost và rollback/migration path.

## Deliverables và evidence

- Architecture diagram và data-flow diagram.
- Bộ ADR được duyệt.
- NFR/SLO sheet có con số và cách đo.
- Threat model ban đầu với owner cho từng mitigation.
- Cost envelope cho development, staging và production.

## Acceptance criteria

- Không còn service “ẩn” hoặc luồng frontend gọi thẳng provider.
- Frontend build không chứa Directus collection/internal field names hoặc third-party provider endpoints.
- Mọi thành phần stateful có backup/restore owner.
- Directus vẫn là backend chính trong phương án được chọn.
- NFR có giá trị đo được, không dùng từ “nhanh”, “ổn định”, “an toàn” chung chung.
- Có phương án degraded mode khi weather/routing provider lỗi.
- Có phương án degraded mode khi payment provider hoặc webhook chậm; không cấp Pro vô hạn.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** Local-first, production self-hosted trên VPS của Product Owner và không khóa cloud vendor (`OPS-003`). Budget ceiling ban đầu là 15 triệu VND/tháng, không gồm transaction fee (`OPS-002`).

1. Chọn extension-only hay Directus + worker riêng? Khuyến nghị: worker riêng cho ingestion/route job dài; extension cho API nghiệp vụ ngắn.
2. Chọn PostgreSQL thuần hay thêm PostGIS? Khuyến nghị: PostGIS nếu lưu route geometry và spatial query.
3. Frontend dùng framework nào và có SSR/PWA không?
4. Mục tiêu availability, latency, data freshness, entitlement sync, RPO và RTO là bao nhiêu?
5. Tải dự kiến gồm user đồng thời, request/phút, route/ngày và weather lookup/ngày là bao nhiêu?
6. Có cho phép Directus Admin Studio truy cập public internet hay chỉ VPN/IP allowlist?
7. Payment webhook đi qua Directus endpoint, worker riêng hay gateway riêng?
8. Dùng locale catalog trong frontend, translated content trong Directus hay kết hợp cả hai?

VPS inventory và staging/production topology cụ thể được defer tới Phase 13. Phase 1 phải giữ deployment portable bằng container và externalized configuration.

Không triển khai hạ tầng cho tới khi ADR tương ứng được approve.
