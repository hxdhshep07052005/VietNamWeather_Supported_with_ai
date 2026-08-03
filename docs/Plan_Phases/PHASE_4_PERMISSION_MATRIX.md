# Phase 4 Permission Matrix

**Manifest:** `apps/directus/security/phase4-business-permissions.json`
**Contract gốc:** `SEC-008`

Directus vẫn là defense-in-depth. Browser sản phẩm chỉ gọi Application API; service identity dùng token riêng theo workload. Permission compiler coi `fields` bị bỏ qua là `*` cho create/read/update và không cần field cho delete; các view nhạy cảm dùng allowlist field rõ ràng.

| Role | Allow chính | Boundary bắt buộc |
|---|---|---|
| `platform_admin` | Source, administrative version/unit, location, provider config/reference, dashboard metrics, retention policy, app setting, feature flag | Không có Super Admin; không lưu secret; workflow vẫn áp dụng |
| `weather_operations` | Đọc location/provider/run/weather; tạo run/observation/forecast; cập nhật trạng thái | Không có billing/risk/content/user data |
| `risk_analyst` | Đọc source/weather/risk evidence; tạo rule-set/rule/advisory; sửa draft của mình | Không approve/publish; rule chỉ sửa khi parent draft |
| `risk_approver` | Đọc rule/advisory/evidence; approve/publish record do người khác tạo | `$CURRENT_USER` không được bằng maker |
| `content_editor` | Locale, page và translation lifecycle | Không có billing, weather ingestion hay user-owned data |
| `product_billing_admin` | Plan, price, feature, entitlement, usage policy, billing projection/reference, override | Payment payload chỉ sanitized fields; không payment credential |
| `support_auditor` | Read-only operational projection có field allowlist | Không create/update/delete; không credential/raw payload |
| `registered_traveler` | Đọc published catalog/content/plan; CRUD favorite/saved route; create/read/delete search history | `owner_id = $CURRENT_USER` cho mọi user-owned action |
| `weather_ingestion_service` | Đọc published location/weather mapping; ghi run/observation/forecast | Không Studio; không billing/user/content |
| `route_evaluation_service` | Đọc location/forecast/published rule; xử lý route option/sample/assessment | Không sửa rule, weather source hay billing |
| `payment_webhook_ingress` | Chỉ create `payment_events` | Append-only ingress; không read/update/reconcile |
| `payment_reconciliation_service` | Read/update event; projection customer/subscription/refund/override | Không public/Studio; event identity bị DB trigger khóa |
| `ai_tool_service` | Không có permission | Disabled/unprovisioned trong Phase 4 |

## Test bắt buộc

- Manifest apply hai lần phải cho `updated=0`, `created=0`, `deleted=0` ở lần sau.
- Phase 3 bootstrap chạy lại không được xóa permission Phase 4.
- Traveler A đọc/sửa/xóa được favorite và saved route của A.
- Traveler B không enumerate/read/update/delete record của A.
- Public permission bằng 0; AI permission bằng 0.
- Application API database role có 0 CRUD privilege trên 40 business tables.
