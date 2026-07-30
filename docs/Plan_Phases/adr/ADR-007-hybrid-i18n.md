# ADR-007 — Hybrid i18n Ownership

**Status:** Accepted  
**Date:** 2026-07-29  
**Decision:** `ARCH-009`

## Bối cảnh

UI/system label phát hành cùng frontend code, trong khi advisory, legal, pricing summary, risk explanation và business content cần chỉnh sửa/publish qua Admin Studio. Đặt toàn bộ ở một phía gây coupling hoặc cho phép business copy thay đổi ngoài kiểm soát release.

## Quyết định

Frontend source package giữ UI/system locale catalog cho `vi` và `en`. Directus giữ translated business/advisory/legal content có workflow/version. API trả stable code và structured interpolation data, không hardcode câu chữ nghiệp vụ vào DTO.

## Phương án đã xem xét

- **Toàn bộ translation trong frontend:** version rõ nhưng admin không thể quản lý business/legal content.
- **Toàn bộ translation trong Directus:** linh hoạt nhưng tăng runtime dependency và khó đảm bảo UI key theo release.
- **Hybrid ownership:** được chọn vì phù hợp owner/publish lifecycle của từng loại nội dung.

## Trade-off và hệ quả

- Cần completeness check ở hai nguồn, cache invalidation và translation QA hai locale.
- Safety/legal content thiếu bản dịch phải fail publication; không silently fallback sang nội dung sai locale.
- Message code phải ổn định qua API version.

## Security impact

Rich text/translation được sanitize bằng allowlist; không cho executable HTML/script hoặc unsafe URL. Placeholder/interpolation không được render như raw HTML. Publish action cần role/policy và audit.

## Chi phí và vận hành

Tăng translation workflow và QA effort nhưng giảm deploy chỉ để sửa business copy. Không mua dịch vụ translation tự động hoặc gọi LLM production nếu chưa có decision, privacy review và budget cap.

## Migration và rollback

Directus content rollback theo content version/publish history; frontend locale rollback theo application release. Key rename cần alias/deprecation window để tránh content đang publish tham chiếu key mất.

## Evidence cần có

Phase 4/9 phải có missing-key check, publish validation, XSS test, locale switch test và review legal/billing copy ở cả `vi` và `en`.
