# Phase 5 — Weather Provider Integration

**Status:** BLOCKED  
**Phụ thuộc:** Phase 4 VERIFIED  
**Mục tiêu:** Thu thập, chuẩn hóa và phục vụ dữ liệu thời tiết thật với provenance, freshness và failure handling rõ ràng.

## Phạm vi công việc

### 1. Provider adapter

- Xây interface chung cho current weather, hourly forecast và daily forecast.
- Provider URL, credential, timeout, quota và feature support lấy từ protected configuration.
- Mapping location/provider ID lưu trong Directus.
- Không để frontend biết hoặc gọi credential/provider endpoint trực tiếp.
- Có khả năng thay provider mà không thay API contract public.

### 2. Ingestion and normalization

- Lưu metadata của request/run và raw response theo retention đã duyệt.
- Chuẩn hóa units, weather codes, timestamps và timezone.
- Phân biệt observation, nowcast và forecast.
- Lưu `issued_at`, `valid_at`, `fetched_at`, `expires_at`, provider và parser version.
- Dùng idempotency/upsert strategy để retry không tạo duplicate.

### 3. Scheduling, cache and resilience

- Scheduled jobs/Flows theo freshness requirement, không theo con số viết cứng trong code.
- Cache key có location, provider, forecast issue và unit/language khi cần.
- Timeout, exponential backoff, bounded retry, circuit breaker và quota protection.
- Dead-letter/retry queue cho job thất bại.
- Provider health dashboard và alert khi stale/failure vượt ngưỡng.

### 4. Public/internal API contract

- API trả data, source, issued time, fetched time, freshness status và attribution.
- Không expose raw provider payload hoặc internal error không cần thiết.
- Khi thiếu dữ liệu, trả trạng thái có cấu trúc; không sinh số fallback.
- Contract version hóa và có schema validation.

## Deliverables và evidence

- Provider comparison và quyết định chọn primary/fallback.
- Adapter implementation + contract tests bằng recorded fixtures test-only.
- Scheduled ingestion và provider run dashboard.
- Data quality report theo location/field/time.
- API documentation và error catalogue.

## Acceptance criteria

- Dữ liệu hiển thị truy ngược được về provider và thời điểm phát hành.
- Unit conversion có test biên và test regression.
- Retry cùng một request không tạo record trùng.
- Provider outage không làm hệ thống hiển thị dữ liệu giả hoặc lỗi trắng trang.
- Stale data được đánh dấu rõ và có quy tắc không dùng cho risk/route khi quá hạn.
- Credential không xuất hiện trong database business, frontend bundle hoặc log.

## Decision Gate — phải hỏi và chốt với bạn

1. Primary weather provider là dịch vụ nào sau khi so sánh coverage, quota, license và cost?
2. Có fallback provider không, và có cho phép trộn provider trong cùng một assessment không?
3. Forecast horizon và độ phân giải tối thiểu cho MVP là gì?
4. Data freshness tối đa chấp nhận được cho current weather và forecast là bao nhiêu?
5. Có lưu raw provider response không, và retention bao lâu?
6. Đơn vị hiển thị mặc định và timezone UX là gì?
7. Khi provider lỗi, UI được phép hiển thị dữ liệu stale tối đa bao lâu trước khi chuyển thành unavailable?

