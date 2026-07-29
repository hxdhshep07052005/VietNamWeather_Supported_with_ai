# Phase 4 — Data Model, Governance & Admin Panel

**Status:** BLOCKED  
**Phụ thuộc:** Phase 3 VERIFIED  
**Mục tiêu:** Xây data model chuẩn hóa, version hóa và Admin Studio đủ dùng cho business/operations mà không cần sửa code.

## Phạm vi công việc

### 1. Core collections

- `locations`, `location_aliases`, `administrative_versions` và `location_provider_mappings`.
- `weather_providers`, `provider_runs`, `weather_observations`, `weather_forecasts`.
- `risk_rule_sets`, `risk_rules`, `risk_assessments`, `risk_advisories`.
- `route_requests`, `route_options`, `route_samples`, `route_assessments`.
- `content_pages`, `translations`, `app_settings`, `feature_flags`.
- `product_plans`, `product_features`, `plan_entitlements`, `usage_policies`, `usage_events`, `usage_counters`.
- `billing_customers`, `subscriptions`, `payment_events`, `refund_references`, `entitlement_overrides`.
- Optional: `user_favorites`, `saved_routes`, `chat_sessions`, `chat_messages`.

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

- ERD và data dictionary.
- Directus schema snapshot/migration.
- Admin Studio walkthrough theo từng role.
- Constraint/index test và permission test.
- Data retention/deletion matrix.

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

## Decision Gate — phải hỏi và chốt với bạn

1. Catalog location ban đầu gồm điểm hành chính, điểm du lịch hay cả hai?
2. Có cần theo dõi thay đổi đơn vị hành chính theo thời gian không? Khuyến nghị: có `administrative_version`, không hardcode “63 tỉnh”.
3. Có lưu favorites, saved routes và lịch sử tra cứu của user không?
4. Cần hỗ trợ những ngôn ngữ nào trong content/advisory?
5. Retention cho raw provider response, normalized forecast, route request, usage event, billing event và audit log là bao lâu?
6. Ai là maker, reviewer và publisher cho risk rule/advisory, pricing và translation?
7. Có cần import dữ liệu location ban đầu từ nguồn chính thức nào?
8. Subscription state và entitlement projection cần lưu lịch sử tới mức nào để hỗ trợ refund/dispute?
9. Có cần version translation theo content release hay chỉ theo locale key?
