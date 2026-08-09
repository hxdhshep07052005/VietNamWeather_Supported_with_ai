# Phase 4 Data Dictionary

**Schema source:** `infra/postgres/init/004-create-phase4-data-model.sql`
**Directus snapshot:** `apps/directus/schema/foundation.yaml`

## Quy ước chung

- Primary key dùng UUID; timestamp nghiệp vụ dùng `timestamptz` và lưu theo UTC.
- `external_key` là stable key; record có lifecycle/version dùng thêm `version` và effective dates.
- Geometry dùng PostGIS SRID 4326; đơn vị đo nằm trong field hoặc field unit riêng.
- `user_created`, `date_created`, `user_updated`, `date_updated` phục vụ accountability của Directus.
- Credential thật chỉ nằm trong secret manager/environment. `credential_reference` chỉ là tên tham chiếu, không phải secret value.

## Collections

| Collection | Mục đích | Khóa/integrity quan trọng |
|---|---|---|
| `supported_locales` | Locale nội dung nghiệp vụ | `external_key` unique; chỉ một default locale |
| `reference_sources` | Provenance, license, version và checksum nguồn | approved record cần actor/timestamp |
| `administrative_versions` | Phiên bản bộ địa giới | source FK, checksum, effective dates |
| `administrative_units` | Cây tỉnh/thành/quận/huyện/phường/xã optional | `(version, external_key)` unique; parent cùng version |
| `locations` | Điểm canonical cho search/weather/route | geometry Point; governed publish workflow |
| `location_aliases` | Tên chính thức, phổ biến, lịch sử, provider | unique theo location/locale/normalized alias |
| `location_provider_mappings` | Mapping canonical location sang provider ID | provider domain/key/id unique |
| `weather_providers` | Cấu hình provider không chứa secret | stable key; credential reference; status |
| `provider_runs` | Job ingestion có audit/idempotency | provider + idempotency unique; parser version |
| `weather_observations` | Weather quan trắc đã normalize | provider/idempotency unique; coordinate target; normalized checksum; explicit units/expiry |
| `weather_forecasts` | Forecast interval đã normalize | nullable provider-issued time; coordinate target; normalized checksum; valid/fetched/expiry; parser provenance |
| `risk_rule_sets` | Release rule-set versioned | maker-checker workflow; key/version unique |
| `risk_rules` | Rule deterministic trong rule-set | chỉ sửa khi parent còn draft |
| `risk_assessments` | Kết quả risk có idempotency | rule-set FK, score/confidence/status |
| `risk_assessment_evidence` | Evidence observation/forecast của assessment | đúng một nguồn weather; sequence unique |
| `risk_advisories` | Advisory versioned theo location/admin unit | maker-checker workflow; source bắt buộc |
| `route_requests` | Request route theo owner và thời điểm khởi hành | owner/idempotency unique; expiry |
| `route_options` | Phương án route từ provider | geometry, duration, distance, provider reference |
| `route_samples` | Sample dọc route theo ETA | sequence unique; optional forecast evidence |
| `route_assessments` | Risk/rank của từng route option | option/objective unique |
| `content_pages` | Release content marketing/legal/help/pricing | slug/version và key/version unique |
| `translations` | Nội dung vi/en versioned | namespace/key/locale/release unique |
| `app_settings` | Cấu hình app không chứa secret | typed JSON value; governed lifecycle |
| `feature_flags` | Feature enable/rollout/targeting | stable key/version; governed lifecycle |
| `retention_policies` | Policy retention versioned | category/version unique; strategy/effective dates |
| `product_plans` | Free/Pro và plan tương lai | key/version unique; governed lifecycle |
| `plan_prices` | Price versioned theo plan/interval/currency | provider key/reference phải cùng có hoặc cùng null |
| `product_features` | Capability và value type | stable key unique; unit bắt buộc cho count/duration |
| `plan_entitlements` | Giá trị feature của plan | plan/feature/version unique |
| `usage_policies` | Quota backend theo period | plan/feature/version unique; daily cần timezone/reset |
| `usage_events` | Ledger usage idempotent | identity immutable; delete chỉ qua retention được duyệt |
| `usage_counters` | Projection atomic theo user/policy/period | unique user/policy/period; lock version |
| `billing_customers` | Provider customer reference tối thiểu | provider reference unique; không lưu card data |
| `subscriptions` | Projection subscription auditable | provider reference unique; projection version |
| `payment_events` | Webhook/payment ledger idempotent | provider event + idempotency unique; checksum; immutable |
| `refund_references` | Refund reference không chứa credential | provider refund reference unique |
| `entitlement_overrides` | Override có lý do, hạn và revoke audit | revoked state cần actor/timestamp |
| `user_favorites` | Location do traveler lưu | owner/location unique; owner filter |
| `saved_routes` | Route endpoint do traveler lưu | owner filter; PostGIS origin/destination |
| `search_history` | Lịch sử tìm kiếm có expiry | owner filter; expires_at > occurred_at |

## Dữ liệu được seed

`apps/directus/seeds/phase4-approved-config.json` chỉ upsert locale, plan, feature, entitlement và usage policy đã có decision. Không seed location, administrative unit, provider, weather, risk result, route, user, subscription hay payment event.
