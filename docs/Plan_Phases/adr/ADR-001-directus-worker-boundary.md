# ADR-001 — Ranh giới Directus và Integration Worker

**Status:** Accepted  
**Date:** 2026-07-29  
**Decision:** `ARCH-004`

## Bối cảnh

Directus phải giữ vai trò backend chính, system of record và Admin Studio. Tuy nhiên weather ingestion, route sampling, retry, payment reconciliation và scheduled jobs có thời gian chạy hoặc failure mode không phù hợp với request đồng bộ hay Directus Flow kéo dài.

## Quyết định

- Directus custom endpoint xử lý `/api/v1`, authorization orchestration và nghiệp vụ ngắn, có timeout hữu hạn.
- Integration worker riêng xử lý scheduled, long-running, retry-heavy và provider-facing jobs.
- Critical job phải có durable database record/outbox trước khi đưa reference vào Redis queue.
- Directus Flow chỉ dùng cho admin workflow hữu hạn; không làm cơ chế delivery duy nhất cho payment hoặc ingestion quan trọng.

## Phương án đã xem xét

- **Directus-only:** ít service hơn nhưng tăng blast radius, khó kiểm soát retry/timeout và có thể chặn API/Admin Studio.
- **Microservice riêng cho từng domain:** cách ly tốt nhưng quá nhiều vận hành cho một solo developer ở MVP.
- **Directus + một worker chung:** được chọn vì giữ Directus là backend chính nhưng vẫn tách failure domain hợp lý.

## Trade-off và hệ quả

- Có thêm worker lifecycle, queue monitoring, dead-letter handling và deployment artifact.
- API contract ổn định hơn vì provider-specific logic nằm sau adapter/worker.
- Scale API và background workload độc lập khi tải tăng.

## Security impact

Worker không public, dùng service identity least privilege, egress allowlist và không có Super Admin credential. Job payload chỉ chứa ID/reference tối thiểu; secret và dữ liệu GPS không được ghi vào queue/log.

## Chi phí và vận hành

Tăng CPU/RAM, monitoring và backup metadata so với Directus-only. Chi phí thực tế phải đo trong production-like load test; không tách thêm worker theo domain nếu chưa có bottleneck/evidence.

## Migration và rollback

Có thể tạm ngừng worker và để job ở trạng thái pending mà không mất record. Chỉ job nhỏ, bounded mới được chuyển về custom endpoint. Thay queue/worker không được làm đổi public DTO hoặc xóa outbox/history.

## Evidence cần có

Phase 2 phải chứng minh crash/retry/idempotency/dead-letter, queue loss không làm mất business state và worker không truy cập được ngoài quyền cần thiết.
