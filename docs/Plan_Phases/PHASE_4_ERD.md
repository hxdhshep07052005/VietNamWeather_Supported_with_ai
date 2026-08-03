# Phase 4 ERD - Data Model & Governance

**Status:** IMPLEMENTED_LOCAL
**Decision baseline:** `DATA-005`, `DATA-006`, `DATA-007`, `SEC-008`, `ARCH-009`, `ARCH-015`, `PRODUCT-004`, `PRODUCT-005`, `PRODUCT-016`

ERD này mô tả schema nghiệp vụ thật trong `infra/postgres/init/004-create-phase4-data-model.sql`. Nó không chứa danh sách tỉnh/thành, quận/huyện, điểm du lịch, provider, weather hay payment giả.

## Location và địa giới hành chính

```mermaid
erDiagram
    REFERENCE_SOURCES ||--o{ ADMINISTRATIVE_VERSIONS : publishes
    ADMINISTRATIVE_VERSIONS ||--o{ ADMINISTRATIVE_UNITS : contains
    ADMINISTRATIVE_UNITS ||--o{ ADMINISTRATIVE_UNITS : parent_of
    ADMINISTRATIVE_UNITS ||--o{ LOCATIONS : classifies
    REFERENCE_SOURCES ||--o{ LOCATIONS : proves
    LOCATIONS ||--o{ LOCATION_ALIASES : has
    SUPPORTED_LOCALES ||--o{ LOCATION_ALIASES : localizes
    LOCATIONS ||--o{ LOCATION_PROVIDER_MAPPINGS : maps
    REFERENCE_SOURCES ||--o{ LOCATION_PROVIDER_MAPPINGS : proves
```

- `administrative_versions` tách từng lần công bố dữ liệu hành chính; không hardcode số tỉnh/thành.
- `administrative_units.parent_id` tạo cây country -> province/municipality -> district -> ward/commune. District và cấp thấp hơn là optional, nhưng schema hỗ trợ đầy đủ.
- Parent và child bắt buộc thuộc cùng một `administrative_version`.
- `locations` là điểm canonical dùng bởi sản phẩm; một location có thể gắn đơn vị hành chính, nguồn, alias và mapping provider.
- Chỉ import địa danh khi có `reference_sources`, version, checksum và quyền sử dụng được duyệt.

## Weather, risk và route

```mermaid
erDiagram
    WEATHER_PROVIDERS ||--o{ PROVIDER_RUNS : executes
    WEATHER_PROVIDERS ||--o{ WEATHER_OBSERVATIONS : supplies
    WEATHER_PROVIDERS ||--o{ WEATHER_FORECASTS : supplies
    LOCATIONS ||--o{ WEATHER_OBSERVATIONS : observed_at
    LOCATIONS ||--o{ WEATHER_FORECASTS : forecast_for
    PROVIDER_RUNS ||--o{ WEATHER_OBSERVATIONS : writes
    PROVIDER_RUNS ||--o{ WEATHER_FORECASTS : writes

    REFERENCE_SOURCES ||--o{ RISK_RULE_SETS : supports
    RISK_RULE_SETS ||--o{ RISK_RULES : contains
    RISK_RULE_SETS ||--o{ RISK_ASSESSMENTS : evaluates
    RISK_ASSESSMENTS ||--o{ RISK_ASSESSMENT_EVIDENCE : cites
    WEATHER_OBSERVATIONS ||--o{ RISK_ASSESSMENT_EVIDENCE : evidence
    WEATHER_FORECASTS ||--o{ RISK_ASSESSMENT_EVIDENCE : evidence
    RISK_RULE_SETS ||--o{ RISK_ADVISORIES : governs

    ROUTE_REQUESTS ||--o{ ROUTE_OPTIONS : returns
    ROUTE_OPTIONS ||--o{ ROUTE_SAMPLES : samples
    ROUTE_OPTIONS ||--o{ ROUTE_ASSESSMENTS : ranks
    WEATHER_FORECASTS ||--o{ ROUTE_SAMPLES : evidence
    RISK_ASSESSMENTS ||--o{ ROUTE_ASSESSMENTS : explains
```

- Forecast truy vết được provider, provider run, parser version, issued time, valid interval, fetched time và expiry.
- Risk assessment truy vết được rule-set version và từng weather evidence record.
- Route chỉ lưu hình học do provider/trình xử lý thật tạo; migration và seed không tạo route giả.

## Content, product và billing

```mermaid
erDiagram
    SUPPORTED_LOCALES ||--o{ TRANSLATIONS : contains
    CONTENT_PAGES ||--o{ TRANSLATIONS : releases

    PRODUCT_PLANS ||--o{ PLAN_PRICES : prices
    PRODUCT_PLANS ||--o{ PLAN_ENTITLEMENTS : grants
    PRODUCT_FEATURES ||--o{ PLAN_ENTITLEMENTS : capability
    PRODUCT_PLANS ||--o{ USAGE_POLICIES : limits
    PRODUCT_FEATURES ||--o{ USAGE_POLICIES : meters
    USAGE_POLICIES ||--o{ USAGE_EVENTS : records
    USAGE_POLICIES ||--o{ USAGE_COUNTERS : projects

    BILLING_CUSTOMERS ||--o{ SUBSCRIPTIONS : owns
    PRODUCT_PLANS ||--o{ SUBSCRIPTIONS : selects
    BILLING_CUSTOMERS ||--o{ PAYMENT_EVENTS : references
    SUBSCRIPTIONS ||--o{ PAYMENT_EVENTS : changes
    PAYMENT_EVENTS ||--o{ REFUND_REFERENCES : refunds
    PRODUCT_FEATURES ||--o{ ENTITLEMENT_OVERRIDES : overrides
```

- Price chỉ là versioned provider reference; không có card number, CVV hay payment credential.
- `payment_events` và `usage_events` là ledger idempotent; identity fields và delete bị governance trigger bảo vệ.
- Entitlement/quota là backend truth, không dựa vào frontend claim.

## User-owned data

```mermaid
erDiagram
    DIRECTUS_USERS ||--o{ USER_FAVORITES : owns
    DIRECTUS_USERS ||--o{ SAVED_ROUTES : owns
    DIRECTUS_USERS ||--o{ SEARCH_HISTORY : owns
    LOCATIONS ||--o{ USER_FAVORITES : targets
    LOCATIONS ||--o{ SAVED_ROUTES : endpoint
    LOCATIONS ||--o{ SEARCH_HISTORY : selected
```

Mọi create/read/update/delete của traveler trên các collection này dùng `$CURRENT_USER`. Positive path và cross-user denial được test bằng hai user ephemeral thật; cleanup xác nhận còn 0 fixture.
