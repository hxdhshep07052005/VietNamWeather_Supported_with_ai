# Phase 1 — Architecture & Non-Functional Requirements

**Status:** VERIFIED
**Phụ thuộc:** Phase 0 VERIFIED  
**Mục tiêu:** Chốt kiến trúc production, ranh giới trách nhiệm và các yêu cầu phi chức năng trước khi dựng hệ thống.

## Phạm vi công việc

### 1. Architecture decisions — baseline đã chốt

- Directus là primary backend, API gateway nghiệp vụ và system of record.
- Dùng Directus self-hosted trên môi trường do Product Owner quản lý theo `OPS-003`; Phase 1 chốt container topology, backup, upgrade và rollback.
- Ranh giới giữa Directus Flows, custom endpoint/hook và integration worker đã được ghi trong `ARCH-004`.
- PostgreSQL + PostGIS đã được chọn trong `ARCH-005`.
- Redis/cache/queue/lock strategy đã được chọn trong `ARCH-007`; object storage chỉ được thêm khi có use case và evidence chi phí.
- Payment integration boundary và entitlement projection đã được ghi trong `ARCH-008` và `ARCH-010`.
- Next.js + TypeScript + PWA và versioned Application API đã được ghi trong `ARCH-006` và `ARCH-003`.
- Quy định frontend không gọi trực tiếp weather/geocoding/routing/payment/LLM API; ngoại lệ duy nhất là Geoapify tile/style theo `ARCH-012`.
- Hybrid i18n boundary đã được ghi trong `ARCH-009`: UI catalog ở frontend, business/legal/advisory content ở Directus.
- Versioned Application API facade là ranh giới bắt buộc; frontend không gọi generic Directus REST/GraphQL hoặc collection endpoints.
- Public DTO, OpenAPI/schema, error contract, pagination, versioning và deprecation policy là artifact bắt buộc của Phase 2 trước khi frontend implementation.

### 2. Non-functional requirements — baseline cần đo

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

- [ARCHITECTURE.md](ARCHITECTURE.md) — complete draft, baseline topology và ownership.
- [DATA_FLOW.md](DATA_FLOW.md) — complete draft, trust boundary và các flow quan trọng.
- [adr/README.md](adr/README.md) — complete draft, ADR-001 đến ADR-008.
- [NFR_SLO.md](NFR_SLO.md) — accepted measurable baseline; load evidence belongs to Phase 12/13.
- [THREAT_MODEL.md](THREAT_MODEL.md) — accepted initial model; mitigation tests belong to implementation/release phases.
- [COST_ENVELOPE.md](COST_ENVELOPE.md) — approved ceiling and no-auto-spend contract under `OPS-006`.
- [PROVIDER_BAKEOFF.md](PROVIDER_BAKEOFF.md) — reproducible benchmark specification and accepted execution reports.
- [PHASE_1_EVIDENCE.md](PHASE_1_EVIDENCE.md) — verified evidence manifest.

## Acceptance criteria

- Không còn service “ẩn” hoặc luồng frontend gọi thẳng provider.
- Frontend build không chứa Directus collection/internal field names hoặc third-party provider endpoints.
- Mọi thành phần stateful có backup/restore owner.
- Directus vẫn là backend chính trong phương án được chọn.
- NFR có giá trị đo được, không dùng từ “nhanh”, “ổn định”, “an toàn” chung chung.
- Có phương án degraded mode khi weather/routing provider lỗi.
- Có phương án degraded mode khi payment provider hoặc webhook chậm; không cấp Pro vô hạn.

## Decision Gate — completed

**Đã chốt:** Local-first/self-hosted (`OPS-003`), budget ceiling (`OPS-002`), Directus + worker (`ARCH-004`), PostgreSQL + PostGIS (`ARCH-005`), Next.js/TypeScript/PWA (`ARCH-006`), Redis (`ARCH-007`), private Admin Studio (`SEC-002`), payment webhook ingress + worker (`ARCH-008`), hybrid i18n (`ARCH-009`), NFR/load baseline (`OPS-005`) và conditional payment capability (`ARCH-010`).

1. **PASS:** WeatherAPI selected under `ARCH-013`; 30/30 live locations passed and the 3-day account limit is explicit.
2. **PASS:** Geoapify 30-location/30-route fixtures, reverse geocoding and route objectives passed under `ARCH-012`.
3. **PASS:** Stripe remains feature-disabled without eligible merchant evidence under `ARCH-010`.
4. **PASS:** VNPay remains disabled until onboarding, then prepaid/manual renewal unless recurring is proven.
5. **PASS:** Cost ceiling, zero automatic spend, request ledger and fail-closed policy approved under `OPS-006`.

**Vừa chốt:** Operational forecast horizon `72 giờ`; ngày 4–7 chỉ là outlook và không tham gia route/risk recommendation (`DATA-004`).

**Đã kiểm chứng:** Directus `12.1.1`, manifest digest và license `MSCL-1.0-GPL` đã được pin trong `ARCH-011`, `ADR-009` và [DIRECTUS_BASELINE.md](DIRECTUS_BASELINE.md).

**Đã kiểm chứng:** MapLibre + Geoapify Free, full live fixtures and route objectives (`ARCH-012`, `ADR-010`). WeatherAPI capability-bounded baseline (`ARCH-013`, `ADR-011`).

VPS inventory và staging/production topology cụ thể được defer tới Phase 13. Phase 1 phải giữ deployment portable bằng container và externalized configuration.

Phase 1 được Product Owner phê duyệt tại `PRODUCT-012`. Phase 2 được mở ở trạng thái `AWAITING_DECISION`; VPS inventory chi tiết vẫn thuộc Phase 13.
