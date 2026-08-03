# Phase 3 Security Operations

**Status:** VERSIONED_RUNBOOK / LOCAL_DRILLS_VERIFIED / PRODUCTION_EVIDENCE_PENDING  
**Phase:** 3 — Identity, JWT, RBAC & Security  
**Decisions:** `SEC-003..010`, `DATA-006`, `ARCH-015`

Tài liệu này là checklist vận hành và incident playbook cho security baseline. Nó không thay thế evidence WireGuard, scheduler hoặc credential production thật.

## 1. Security configuration checklist

- Directus không public trực tiếp cho browser product; frontend chỉ gọi Application API `/api/v1`.
- Application session dùng cookie `__Host-`, `Secure`, `HttpOnly`, `Path=/`, không có `Domain`; mutation phải qua exact Origin/Host và signed CSRF.
- Directus access/refresh token, password-reset token và email-verification token chỉ tồn tại server-side, được mã hóa bằng khóa runtime riêng.
- Directus role/policy giữ default-deny; mọi allow permission mới phải có schema thật, manifest versioned và positive/negative test.
- Human staff/admin phải có MFA; service identity không được vào Admin Studio và không dùng Super Admin.
- Secret, token, cookie, URL auth consume và PII nhạy cảm phải bị redact khỏi application, proxy, analytics và backup evidence.
- `LICENSE_KEY` và `LICENSE_TOKEN` không được cùng tồn tại; licensed capability phải pass `validate-license.ps1 -RequireLicensed` trước custom permission.
- Security retention chỉ chạy bằng DB owner/maintenance identity; Application API không có quyền execute purge function hoặc delete audit row.
- Redis là dependency bắt buộc cho rate limiting; khi Redis mất, readiness phải fail closed và API không được bỏ qua rate limit để tiếp tục mutation.

## 2. Application API encryption-key rotation

Khóa `API_SESSION_ENCRYPTION_KEY` bảo vệ Directus access/refresh token, password-recovery token và email-verification token trong `app_security`. Không đổi khóa bằng cách chỉ sửa environment vì ciphertext cũ sẽ không thể giải mã.

Kiểm tra transaction và rollback an toàn:

```powershell
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-encryption-key-rotation.ps1
```

Local committed drill có maintenance stop, re-encrypt transaction, cập nhật `.env.local`, recreate API và xác minh session cũ vẫn dùng được:

```powershell
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-encryption-key-rotation.ps1 -ApplyLocalRotation
```

Production procedure:

1. Xác minh backup/restore gần nhất và đặt maintenance window; chặn traffic mutation tới Application API.
2. Dừng mọi Application API replica dùng khóa cũ. Directus và database có thể tiếp tục chạy nhưng không được có API writer cũ.
3. Inject khóa kế tiếp qua secret manager vào `API_SESSION_ENCRYPTION_KEY_NEXT`; không ghi khóa vào command output, ticket hoặc evidence.
4. Chạy `node apps/api/dist/rotate-encryption-key.js` bằng image release và API DB identity. Tool lock ba bảng, decrypt bằng khóa hiện tại, re-encrypt bằng khóa mới và commit toàn bộ hoặc rollback toàn bộ.
5. Promote khóa mới thành `API_SESSION_ENCRYPTION_KEY`, xóa secret tạm `API_SESSION_ENCRYPTION_KEY_NEXT`, rồi khởi động toàn bộ replica bằng cùng release/config.
6. Kiểm tra readiness, session continuity, auth audit và log redaction; revoke toàn bộ session nếu có dấu hiệu khóa cũ bị lộ.

## 3. Retention schedule

- Preview: `tools/database/run-security-retention.ps1` không có `-Apply`.
- Apply chỉ được chạy bởi maintenance identity sau khi preview được review: `tools/database/run-security-retention.ps1 -Apply`.
- Cutoff lấy từ `SECURITY_SESSION_RETENTION_DAYS` và `SECURITY_AUDIT_RETENTION_MONTHS`; không truyền ngày tùy ý từ frontend hay Application API.
- Production scheduler, timezone, alert receiver và maintenance identity phải được khai báo trong deployment configuration của Phase 13. Job phải fail closed, giữ log chỉ gồm count/correlation metadata và cảnh báo khi exit code khác 0.
- Database rollback test `tools/database/test-phase3-security-retention.ps1` phải pass trước mỗi thay đổi function hoặc retention policy.

## 4. Token or account compromise playbook

1. Ghi incident ID, thời điểm, identity/secret bị ảnh hưởng và nguồn phát hiện; không copy raw credential vào ticket.
2. Chặn đường vào tương ứng: revoke user/session family, suspend account, disable service identity hoặc đóng ingress bị nghi ngờ.
3. Rotate credential theo phạm vi: Application API encryption key, Directus `KEY`/`SECRET`, provider key hoặc payment secret; không rotate rộng hơn nếu chưa có evidence để tránh làm mất dấu.
4. Kiểm tra `app_security.audit_events`, Directus activity và edge log đã redacted; bảo toàn evidence theo retention/legal policy.
5. Với password compromise, buộc reset password và xác minh identity-change trigger đã revoke session. Với encryption-key compromise, rotate committed và cân nhắc revoke toàn bộ session.
6. Chỉ mở lại traffic sau readiness, negative permission, login/revoke và secret scan pass. Ghi root cause, phạm vi ảnh hưởng và action phòng ngừa.

## 5. Access review

- Review human staff/admin và service identity trước production, sau mỗi thay đổi nhân sự/quyền, và theo lịch vận hành được phê duyệt.
- Mỗi review đối chiếu role, policy, MFA, Studio access, active status, last use và owner; identity không còn owner hoặc không còn nhu cầu phải disable/revoke.
- Super Admin chỉ dành cho break-glass theo `SEC-003`; mọi lần sử dụng phải audit và rotate/revoke credential sau sự cố.
- Local evidence không được dùng để tuyên bố WireGuard, production scheduler hoặc production access review đã chạy.

## 6. Evidence state

- Local encryption-key rollback drill: `PASS`.
- Local committed encryption-key rotation with active-session continuity: `PASS` on 2026-08-02.
- Local Redis stop/start fail-closed drill: `PASS`.
- Retention preview and rollback/purge boundary: `PASS_LOCAL`.
- Production WireGuard, scheduler and access-review execution: `PENDING_EXTERNAL`.
