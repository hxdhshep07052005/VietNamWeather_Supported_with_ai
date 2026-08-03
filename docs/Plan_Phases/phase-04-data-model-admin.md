# Phase 4 — Data Model, Governance & Admin Panel

**Status:** IN_PROGRESS (`LOCAL_IMPLEMENTATION_VERIFIED / REMOTE_CI_PENDING`)
**Phụ thuộc:** Phase 3 VERIFIED — CI run `30852140331`
**Mục tiêu:** Xây data model chuẩn hóa, version hóa và Admin Studio đủ dùng cho business/operations mà không cần sửa code.

## Phạm vi công việc

### 1. Core collections

- `supported_locales`, `reference_sources`, `administrative_versions`, `administrative_units`, `locations`, `location_aliases` và `location_provider_mappings`.
- `weather_providers`, `provider_runs`, `weather_observations`, `weather_forecasts`.
- `risk_rule_sets`, `risk_rules`, `risk_assessments`, `risk_advisories`.
- `route_requests`, `route_options`, `route_samples`, `route_assessments`.
- `content_pages`, `translations`, `app_settings`, `feature_flags`.
- `retention_policies`, `product_plans`, `plan_prices`, `product_features`, `plan_entitlements`, `usage_policies`, `usage_events`, `usage_counters`.
- `billing_customers`, `subscriptions`, `payment_events`, `refund_references`, `entitlement_overrides`.
- User-owned: `user_favorites`, `saved_routes`, `search_history`.
- `chat_sessions` và `chat_messages` được defer sang optional Phase 11, không tạo bảng rỗng trước nhu cầu.

Tên bảng/field cuối cùng phải theo naming convention được duyệt; danh sách trên là domain, không phải schema đã chốt.

### 2. Data integrity

- Dùng timezone-aware timestamps và quy ước UTC ở storage.
- Định nghĩa unit normalization và không lưu số mà thiếu unit context.
- Unique key/idempotency key cho provider data.
- Index theo location, provider, issued_at, valid_at và expires_at.
- Foreign key, status transition và delete behavior rõ ràng.
- Không cascade-delete audit/provenance ngoài retention policy.
- Mỗi seedable reference record có stable external key/version để upsert idempotent.
- Demo/test records có environment marker và bị cấm trong production migration path.

### 3. Governance workflows

- Draft → Review → Approved → Published → Retired cho rule/advisory.
- Maker-checker: người soạn không tự publish rule rủi ro nếu policy yêu cầu.
- Revisions/activity cho thay đổi nghiệp vụ quan trọng.
- Effective date để rollback hoặc khôi phục rule version trước.

### 4. Directus Admin Studio

- Dashboard provider health, stale data, failed jobs và risk rule status.
- Form validation, field help text và units rõ ràng.
- Preset/filter phù hợp từng role.
- Không hiển thị secret trong collection quản trị.
- Hỗ trợ content translation theo quyết định i18n.

## Deliverables và evidence

- ERD và data dictionary: [`PHASE_4_ERD.md`](PHASE_4_ERD.md), [`PHASE_4_DATA_DICTIONARY.md`](PHASE_4_DATA_DICTIONARY.md).
- Directus schema snapshot/migration: `foundation.yaml`, `004-create-phase4-data-model.sql`.
- Admin Studio walkthrough: [`PHASE_4_ADMIN_WALKTHROUGH.md`](PHASE_4_ADMIN_WALKTHROUGH.md).
- Constraint/index/governance/permission/ownership tests: `pnpm run validate:stage4`.
- Permission và retention mapping: [`PHASE_4_PERMISSION_MATRIX.md`](PHASE_4_PERMISSION_MATRIX.md), [`PHASE_4_RETENTION_MATRIX.md`](PHASE_4_RETENTION_MATRIX.md).
- Evidence manifest: [`PHASE_4_EVIDENCE.md`](PHASE_4_EVIDENCE.md).

## Acceptance criteria

- Không có location/risk/provider business data viết cứng trong source.
- Có thể thêm một điểm du lịch và publish advisory từ Admin Studio mà không deploy code.
- Có thể tạo/chỉnh plan, feature, quota và translation từ Admin Studio theo quyền được cấp.
- Một forecast record truy được provider, issued time, valid time và parser version.
- Một risk assessment truy được rule version và weather evidence.
- Rule draft không xuất hiện trên public API trước khi được approve/publish.
- Product entitlement và usage policy được kiểm tra ở API, không chỉ trên frontend.
- Payment event và subscription projection có idempotency reference.
- Reference/config seed có manifest/checksum và không tạo duplicate khi chạy lại.

## Decision Gate — đã chốt

1. Catalog hỗ trợ cả administrative locations và curated product locations; province/municipality/city là core, district/lower levels optional theo nguồn thật (`DATA-007`).
2. Administrative hierarchy được version hóa; không hardcode số tỉnh/thành (`DATA-007`).
3. Favorites, saved routes và search history được lưu theo owner/quota/retention đã duyệt (`PRODUCT-003`, `PRODUCT-004`).
4. Business content hỗ trợ `vi` và `en` (`ARCH-009`).
5. Raw provider payload không được lưu; security/audit/billing retention theo `DATA-006`; provider/route TTL cụ thể chờ phase sở hữu và được quản lý bằng `retention_policies`.
6. Risk Analyst/Risk Approver tách maker-checker; content/product/billing role theo `SEC-008`.
7. Không import location trước khi có official/approved source, version, checksum và license (`DATA-005`, `DATA-007`).
8. Subscription/payment/usage dùng projection và immutable idempotent event references; billing reference giữ tối thiểu 24 tháng theo legal gate (`DATA-006`).
9. Translation được version theo locale key và release version; optional link tới content release.
