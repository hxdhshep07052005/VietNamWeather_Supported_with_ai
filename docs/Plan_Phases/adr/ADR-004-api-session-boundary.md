# ADR-004 — Application API và Server-Side Session Boundary

**Status:** Accepted  
**Date:** 2026-07-29  
**Decisions:** `ARCH-003`, `SEC-001`

## Bối cảnh

Frontend không được phụ thuộc Directus collections/internal fields hoặc giữ reusable backend/provider credentials. Directus vẫn là identity authority, nhưng chuyển JWT/refresh token cho browser làm tăng hậu quả của XSS và tạo coupling với auth implementation.

## Quyết định

- Chỉ expose same-origin `/api/v1` cho sản phẩm.
- Browser nhận opaque random session handle qua cookie `Secure`, `HttpOnly`, `SameSite`; không nhận Directus refresh/static token.
- Server-side session record ánh xạ tới Directus identity/token metadata, có encryption, expiry, rotation và revoke family.
- Mỗi request kiểm tra session, user state, role/policy, ownership và entitlement ở backend.

## Phương án đã xem xét

- **JWT/refresh token trong localStorage:** đơn giản nhưng blast radius XSS cao và trái yêu cầu cô lập backend.
- **Frontend gọi Directus SDK trực tiếp:** nhanh lúc đầu nhưng expose schema/generic API và khó giữ stable business contract.
- **Opaque server-side session:** được chọn để cô lập token và duy trì facade ổn định.

## Trade-off và hệ quả

- Cần session store, CSRF/origin validation, cleanup, rotation và revoke logic.
- Tăng một lần lookup/coordination cho authenticated request.
- Cho phép thay đổi Directus/auth internals mà không buộc frontend đổi.

## Security impact

Không lưu JWT/refresh token trong localStorage/sessionStorage. State-changing request kiểm tra `Origin`/`Host` và CSRF token khi cần. Cookie/session ID được rotate sau login/privilege change; password reset/account disable phải revoke session family.

## Chi phí và vận hành

Tăng Redis/database storage và operational metrics cho session. TTL, cleanup và encryption key rotation phải được đo; không dùng sticky session như điều kiện correctness.

## Migration và rollback

Session implementation có thể đổi phía server sau cùng `/api/v1`; migration phải hỗ trợ invalidate an toàn thay vì cố giải mã mọi session cũ. Rollback release không được phục hồi session đã revoke.

## Evidence cần có

Phase 3 phải có auth/session integration test, CSRF/XSS review, revoke test, session fixation test và bằng chứng frontend build không chứa Directus token/schema.
