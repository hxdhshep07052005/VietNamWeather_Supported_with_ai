# Phase 3 — Identity, JWT, RBAC & Security

**Status:** IN_PROGRESS — LOCAL_IMPLEMENTATION_VERIFIED / CLOSURE_APPROVAL_PENDING
**Phụ thuộc:** Phase 2 VERIFIED  
**Mục tiêu:** Xây authentication và authorization theo least privilege, phù hợp browser production và Admin Studio.

## Phạm vi công việc

### 1. Authentication flow

- Cấu hình Directus login, access token/JWT, refresh, logout và revoke.
- Access token sống ngắn; thời lượng phải cấu hình qua environment và được duyệt.
- Chọn cookie/session hoặc access token in-memory + refresh cookie an toàn cho browser.
- Không lưu refresh token hoặc static admin token trong `localStorage`.
- Thiết kế forgot password, email verification và account lock/throttling nếu có registered user.
- Bật MFA/2FA cho vai trò quản trị khi deployment option hỗ trợ.

### 2. Roles and policies

- Tạo role/policy matrix theo `PLAN_MASTER.md`.
- Public role mặc định deny; chỉ mở đúng collection, item và field cần thiết.
- Theo `PRODUCT-006`, public role chỉ đọc landing/pricing/legal/locale content; weather/map/search/route endpoints yêu cầu authenticated accountability.
- Tách quyền create/update/publish risk rule.
- Tách service account theo weather ingestion, routing và chatbot.
- Tạo policy riêng cho Product/Billing Admin và payment webhook service.
- Thiết lập item-level ownership cho dữ liệu cá nhân nếu có.
- Kiểm tra quyền của custom endpoint/hook; không dùng admin accountability mặc định.
- Entitlement phải được kiểm tra server-side; JWT claim chỉ là cache hint nếu được dùng, không phải nguồn sự thật duy nhất.
- Account, role, policy và service identity nằm trong Directus/backend; frontend không chứa credential hoặc static service token.
- Frontend chỉ gửi request qua Application API; API tự xác minh session/accountability và không tin role/plan/user ID do client tự khai báo.

### 3. Platform security

- TLS, HSTS, CSP, secure headers, CORS allowlist và CSRF mitigation phù hợp auth mode.
- Rate limit theo IP/user/endpoint; giới hạn payload, query depth và file upload.
- Admin Studio qua VPN/IP allowlist hoặc control đã duyệt.
- Secret scanning, dependency scanning và container scanning.
- Redact token, cookie, secret và PII khỏi log.

### 4. Audit and incident readiness

- Log login success/failure, permission changes, rule publish và service-account activity.
- Alert khi có brute-force, bất thường quyền hoặc provider credential failure.
- Viết token compromise playbook và access review schedule.
- Payment webhook signature, replay protection và idempotency phải được kiểm tra trước khi cập nhật subscription.
- Billing/admin support không được xem card data hoặc payment secret.
- AI endpoint yêu cầu authenticated user và không expose system prompt, LLM key, Directus service token hoặc raw internal error.

## Deliverables và evidence

- Auth sequence diagram và session contract: [`PHASE_3_AUTH_SESSION_CONTRACT.md`](PHASE_3_AUTH_SESSION_CONTRACT.md).
- Role-policy-permission matrix: [`PHASE_3_ROLE_POLICY_MATRIX.md`](PHASE_3_ROLE_POLICY_MATRIX.md).
- Versioned Directus role/policy manifest: [`../../apps/directus/security/phase3-default-deny.json`](../../apps/directus/security/phase3-default-deny.json).
- Apply/validation/negative permission tools: [`../../tools/directus/apply-phase3-security.ps1`](../../tools/directus/apply-phase3-security.ps1), [`../../tools/directus/validate-phase3-security.ps1`](../../tools/directus/validate-phase3-security.ps1), [`../../tools/directus/test-phase3-negative-permissions.ps1`](../../tools/directus/test-phase3-negative-permissions.ps1).
- Application API runtime boundary and controls: [`PHASE_3_RUNTIME_SECURITY.md`](PHASE_3_RUNTIME_SECURITY.md), [`../../apps/api`](../../apps/api), [`../../infra/postgres/init/003-create-api-security.sh`](../../infra/postgres/init/003-create-api-security.sh).
- Auth/session unit and live integration tests: [`../../apps/api/test/security.test.mjs`](../../apps/api/test/security.test.mjs), [`../../tools/api/test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1).
- Identity-change revoke, retention, MFA, password recovery, email verification and encryption-key rotation drills: [`../../tools/database/test-phase3-security-retention.ps1`](../../tools/database/test-phase3-security-retention.ps1), [`../../tools/database/run-security-retention.ps1`](../../tools/database/run-security-retention.ps1), [`../../tools/directus/test-phase3-mfa.ps1`](../../tools/directus/test-phase3-mfa.ps1), [`../../tools/api/test-phase3-password-recovery.ps1`](../../tools/api/test-phase3-password-recovery.ps1), [`../../tools/api/test-phase3-email-verification.ps1`](../../tools/api/test-phase3-email-verification.ps1), [`../../tools/api/test-phase3-encryption-key-rotation.ps1`](../../tools/api/test-phase3-encryption-key-rotation.ps1).
- Automated permission tests cho từng role.
- Security configuration checklist, incident/access-review runbook và threat-model update: [`PHASE_3_SECURITY_OPERATIONS.md`](PHASE_3_SECURITY_OPERATIONS.md), [`THREAT_MODEL.md`](THREAT_MODEL.md).
- Token revoke/rotation drill evidence.

## Acceptance criteria

- Public user không đọc được field nội bộ hoặc collection admin.
- Public user không gọi được weather, search, forecast, risk, route, saved-item hoặc chatbot API.
- Phase 3 không cấp broad business collection access; User A không truy cập được dữ liệu riêng của User B là acceptance gate của Phase 4 sau khi schema/ownership rule thật tồn tại.
- Service account không thể quản lý user, role hoặc policy.
- Logout/revoke làm refresh credential mất hiệu lực theo thiết kế.
- Không có static token trong frontend bundle, source map hoặc log.
- Thay đổi JavaScript/client request không thể mở rộng quyền Directus, entitlement hoặc AI tool access.
- Frontend không thể bypass facade để gọi Directus generic collection API trong production network/policy.
- Mọi admin action quan trọng để lại audit evidence.

Runtime baseline đã được triển khai và kiểm chứng ở local stack. Open Innovation Grant entitlement, least-privilege self-TFA permission cho 7 human staff policy, staff/admin TOTP, password/status/role/MFA session revoke, retention rollback drill, hardened password recovery, registration/email verification, Redis fail-closed và encryption-key rotation đều đã pass. Phase 3 đang chờ Product Owner closure approval và CI evidence trên commit cuối; Admin Studio VPN cùng production retention scheduler thuộc Phase 13 theo `OPS-003`, còn business ownership/cross-user permission thuộc Phase 4 sau khi schema thật tồn tại.

## Decision Gate — completed

**Đã chốt:** User phải đăng nhập để dùng mọi product feature; anonymous chỉ xem landing page (`PRODUCT-006`).

Phase 3 Decision Gate được mở bởi `PRODUCT-014` và được Product Owner phê duyệt tại `PRODUCT-015`.

1. Browser dùng opaque server-side application session qua same-origin API và secure cookie; frontend không giữ Directus token (`SEC-004`).
2. MVP chỉ có email/password, chưa có social login hoặc enterprise SSO (`SEC-004`).
3. Production Admin Studio dùng WireGuard VPN; IP allowlist chỉ là emergency/fallback (`SEC-005`).
4. Directus access token phía server 10 phút; session/refresh tối đa 14 ngày; user tối đa 5 session, staff/admin tối đa 2 (`SEC-004`).
5. MFA bắt buộc cho toàn bộ human staff/admin; user thông thường chưa bắt buộc trong MVP (`SEC-005`).
6. Security/session log giữ 90 ngày, admin/security audit 12 tháng, billing/payment reference tối thiểu 24 tháng và phải legal review trước production (`DATA-006`).
7. Database entitlement projection là nguồn sự thật; cache read-only tối đa 60 giây; Pro mutation/quota/payment action deny khi entitlement stale (`SEC-006`).

## Implementation order đã duyệt

1. Auth sequence, trust boundary và session contract.
2. Role-policy-permission matrix và ownership rules.
3. CSRF, CORS, rate limit, secure headers và log redaction.
4. MFA, email verification, password reset và recovery controls.
5. Automated negative permission tests, token/session revoke-rotation drill và evidence closure.

Mọi TTL, concurrency limit, retention, allowlist và policy phải đi qua cấu hình versioned hoặc Directus-managed configuration phù hợp; frontend không được hardcode hay tự enforcement.
