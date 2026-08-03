# Phase 3 Evidence — Identity, JWT, RBAC & Security

**Status:** LOCAL_IMPLEMENTATION_VERIFIED / CLOSURE_APPROVAL_PENDING  
**Kickoff approval:** `PRODUCT-015`  
**Decision baseline:** `SEC-004`, `SEC-005`, `DATA-006`, `SEC-006`, `SEC-007`, `SEC-008`, `SEC-009`, `SEC-010`, `ARCH-015`

Tài liệu này chỉ ghi evidence có thể tái hiện. Checklist chưa có bằng chứng giữ nguyên `PENDING`; không dùng tuyên bố hoặc dữ liệu giả để thay test output.

## 1. Auth/session contract

| Evidence | Status | Artifact / command | Kết quả |
|---|---|---|---|
| Auth sequence và trust boundary | PASS_BASELINE | [`PHASE_3_AUTH_SESSION_CONTRACT.md`](PHASE_3_AUTH_SESSION_CONTRACT.md), [`PHASE_3_RUNTIME_SECURITY.md`](PHASE_3_RUNTIME_SECURITY.md), `SEC-007` | Thin Application API + private Directus handoff đã chạy trong local Compose |
| Session lifecycle/rotation/revoke contract | PASS_BASELINE | [`security.test.mjs`](../../apps/api/test/security.test.mjs), [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1) | Opaque handle rotate; old handle 401; logout làm session mất hiệu lực |
| CSRF/CORS/cookie contract | PASS_BASELINE | [`server.ts`](../../apps/api/src/server.ts), [`security.test.mjs`](../../apps/api/test/security.test.mjs) | `__Host-`, Secure, HttpOnly, SameSite, Origin/Host và signed CSRF đã được test |
| Browser không nhận Directus token | PASS_BASELINE | [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1) | Login/refresh response scan không có access/refresh token marker; token chỉ lưu ciphertext server-side |
| Registration/email verification bridge | PASS_BASELINE | [`security.test.mjs`](../../apps/api/test/security.test.mjs), [`test-phase3-email-verification.ps1`](../../tools/api/test-phase3-email-verification.ps1), `SEC-010` | Generic `202`, duplicate enumeration denied, user `unverified` trước verify, encrypted token + opaque fragment handle, verified login và replay denial pass |

## 2. Roles, policies and ownership

| Evidence | Status | Artifact / command | Kết quả |
|---|---|---|---|
| Role-policy-permission matrix | APPROVED_CONTRACT | [`PHASE_3_ROLE_POLICY_MATRIX.md`](PHASE_3_ROLE_POLICY_MATRIX.md), `SEC-008` | Logical contract approved; Directus implementation được ghi riêng |
| Versioned role/policy manifest | PASS | [`phase3-default-deny.json`](../../apps/directus/security/phase3-default-deny.json), [`apply-phase3-security.ps1`](../../tools/directus/apply-phase3-security.ps1) | 13 role + 13 policy + 13 access; đúng 7 self-TFA permission cho human staff; 0 business collection permission |
| Manifest idempotency | PASS | `apply-phase3-security.ps1 -Apply` chạy lại sau licensed apply | created=0, updated=0; role/policy/access unchanged=13/13/13; permission unchanged=7 |
| Directus security baseline | PASS | [`validate-security-baseline.ps1`](../../tools/directus/validate-security-baseline.ps1) | `state=phase3_least_privilege roles=14 admin_policies=1 non_admin_policies=14 permissions=7 application_roles=13` |
| Public/default-deny và self-TFA boundary tests | PASS | [`test-phase3-negative-permissions.ps1`](../../tools/directus/test-phase3-negative-permissions.ps1) | Anonymous denials=6; restricted-role denials=90; 21 staff TFA boundary checks; direct/cross-user mutation bị chặn |
| Cross-user ownership denial tests | DEFERRED_PHASE4 | [`PHASE_3_ROLE_POLICY_MATRIX.md`](PHASE_3_ROLE_POLICY_MATRIX.md), `SEC-008` | Chưa có business collection/schema để tạo fixture hợp lệ; bắt buộc ở Phase 4 sau licensed entitlement, không dùng dữ liệu giả để đóng Phase 3 |
| Service-account least-privilege tests | PASS_BASELINE | [`validate-phase3-security.ps1`](../../tools/directus/validate-phase3-security.ps1) | 5 service policies không Studio access, 0 permission; workload-specific allow paths chờ Phase 4 |
| Admin/billing/risk separation tests | PASS_BASELINE | [`validate-phase3-security.ps1`](../../tools/directus/validate-phase3-security.ps1), `SEC-008` | 7 staff policy MFA=true; risk/payment roles tách; business allow paths chờ Phase 4 |
| Directus entitlement architecture | PASS | [`DIRECTUS_ENTITLEMENT_REPORT.md`](DIRECTUS_ENTITLEMENT_REPORT.md), `ARCH-015` | Licensed path approved và active; credential chỉ nằm trong protected local runtime environment |
| Licensed Directus runtime entitlement | PASS_LOCAL | [`validate-license.ps1`](../../tools/directus/validate-license.ps1) | Open Innovation Grant `active`; production/custom permissions=true; `-RequireLicensed` pass; không in credential |

## 3. Platform security

| Evidence | Status | Artifact / command | Kết quả |
|---|---|---|---|
| Secure headers, CORS and CSRF tests | PASS_BASELINE | [`security.test.mjs`](../../apps/api/test/security.test.mjs), [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1) | CSP/HSTS/no-store, exact origin, missing/invalid CSRF denial pass |
| Rate-limit and payload-limit tests | PASS_BASELINE | [`security.test.mjs`](../../apps/api/test/security.test.mjs) | Login route returns 429 after configured threshold; oversized body returns 413 |
| MFA/recovery flow tests | PASS_LOCAL | [`test-phase3-mfa.ps1`](../../tools/directus/test-phase3-mfa.ps1) | Managed staff và admin TOTP enrollment, missing-OTP denial, OTP login, admin recovery, MFA-change session revoke, cleanup và secret log scan đều pass |
| Secret/token/PII log-redaction tests | PASS_BASELINE | [`server.ts`](../../apps/api/src/server.ts), [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1), [`test-phase3-password-recovery.ps1`](../../tools/api/test-phase3-password-recovery.ps1), [`test-phase3-email-verification.ps1`](../../tools/api/test-phase3-email-verification.ps1) | API URL/cookie/credential/location redaction và live marker scan pass; Directus verify endpoint bị loại khỏi access log; frontend bundle/source-map scan chờ frontend tồn tại |
| Local Directus key/secret incident rotation | PASS | [`rotate-local-directus-secrets.ps1`](../../tools/environment/rotate-local-directus-secrets.ps1) | Directus recreated, old sessions invalidated, replacement secrets không được in |
| Admin Studio VPN control evidence | PENDING | Chưa có | Chưa kiểm chứng |
| Security checklist/incident/access-review runbook | PASS_ARTIFACT | [`PHASE_3_SECURITY_OPERATIONS.md`](PHASE_3_SECURITY_OPERATIONS.md) | Checklist, token/account incident procedure, access review, retention và key-rotation procedure đã versioned; production execution vẫn PENDING_EXTERNAL |

## 4. Session and incident drills

| Evidence | Status | Artifact / command | Kết quả |
|---|---|---|---|
| Login/refresh/logout happy path | PASS_BASELINE | [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1) | Real local Directus traveler login, refresh và logout pass; temporary account/rows removed |
| Refresh replay and rotation denial | PASS_BASELINE | [`security.test.mjs`](../../apps/api/test/security.test.mjs), [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1) | Rotated handle differs; previous handle and logged-out handle return 401 |
| Password reset/account disable revocation | PASS_BASELINE | [`test-phase3-password-recovery.ps1`](../../tools/api/test-phase3-password-recovery.ps1), [`003-create-api-security.sh`](../../infra/postgres/init/003-create-api-security.sh) | Mailpit delivery, native Directus reset, server-side encrypted token, clean fragment redirect, old-session 401, new-password login và handle replay denial pass |
| Email verification transition/replay | PASS_BASELINE | [`test-phase3-email-verification.ps1`](../../tools/api/test-phase3-email-verification.ps1), [`apply-phase3-registration.ps1`](../../tools/directus/apply-phase3-registration.ps1) | Registration policy, Mailpit delivery, unverified-login denial, activation, verified login, encrypted token, clean redirect và replay denial pass |
| Token/session compromise drill | PASS_BASELINE | [`test-phase3-auth-runtime.ps1`](../../tools/api/test-phase3-auth-runtime.ps1), [`test-phase3-encryption-key-rotation.ps1`](../../tools/api/test-phase3-encryption-key-rotation.ps1), [`rotate-encryption-key.ts`](../../apps/api/src/rotate-encryption-key.ts) | Replay/revoke, encrypted envelope, DB least privilege, rollback rotation và committed local key rotation with active-session continuity pass |
| Redis outage/fail-closed drill | PASS_BASELINE | [`test-phase3-redis-failure.ps1`](../../tools/api/test-phase3-redis-failure.ps1), [`server.ts`](../../apps/api/src/server.ts) | Readiness trả `503/not_ready`; rate-limited auth route trả retryable `UPSTREAM_UNAVAILABLE`; Redis restart được kiểm tra sau drill |
| Audit retention/purge verification | PASS_BASELINE | [`run-security-retention.ps1`](../../tools/database/run-security-retention.ps1), [`test-phase3-security-retention.ps1`](../../tools/database/test-phase3-security-retention.ps1) | Preview non-destructive pass; old session/audit fixture bị purge, recent fixture được giữ, future cutoff bị deny, API role không execute và transaction rollback sạch |

The live API drills clear only the `fastify-rate-limit-*` keys in the local Redis rate-limit database before and after each run. This keeps repeated local validation deterministic without changing the configured production limits or deleting application data.

## 5. Closure gate

### 5.1 Commands đã pass

```text
STAGE1_VALIDATION_OK decisions=53 references=53 adrs=11
STAGE2_LOCAL_VALIDATION_OK remote_github_ci=use_validate-stage2-remote.ps1
DIRECTUS_ROLE_POLICY_APPLY_OK mode=apply roles=13 permissions=7 policy_created=0 policy_updated=0 policy_unchanged=13 role_created=0 role_updated=0 role_unchanged=13 access_created=0 access_updated=0 access_unchanged=13 permission_created=0 permission_updated=0 permission_unchanged=7 permission_deleted=0 secrets_printed=false
DIRECTUS_LICENSE_VALIDATION_OK mode=required name=Open Innovation Grant status=active source=env production=true custom_permissions=true seats_limit=-1 collections_limit=-1 flows_limit=-1 usage_seats=1 usage_collections=0 usage_flows=0 key_configured=true token_configured=false secrets_printed=false
DIRECTUS_SECURITY_BASELINE_OK state=phase3_least_privilege roles=14 admin_policies=1 non_admin_policies=14 permissions=7 application_roles=13
DIRECTUS_ROLE_POLICY_VALIDATION_OK roles=13 policies=13 access=13 permissions=7 staff_mfa=7 staff_self_tfa_permissions=7 public_permissions=0 admin_policies=1 ai_users=0 secrets_printed=false
DIRECTUS_NEGATIVE_PERMISSION_TEST_OK roles=13 restricted_endpoints=6 anonymous_denials=6 role_denials=90 staff_self_metadata_checks=14 staff_tfa_boundary_checks=21 ephemeral_users_remaining=0 secrets_printed=false
LOCAL_STACK_VALIDATION_OK services=6 directus_release=12.1.1 directus_checks=6 api_ready=true postgis=true redis_auth=true private_services=2 secrets_printed=false
SECURITY_RETENTION_PREVIEW_OK sessions=0 audit_events=0 api_execute=false secrets_printed=false
PHASE3_SECURITY_RETENTION_DB_TEST_OK identity_trigger=true old_rows_purged=true recent_rows_retained=true future_cutoff_denied=true api_execute=false fixtures_rolled_back=true secrets_printed=false
PHASE3_AUTH_RUNTIME_TEST_OK login=true refresh_rotation=true replay_denied=true csrf_denied=true logout_revoke=true password_change_revoke=true status_change_revoke=true role_change_revoke=true encrypted_tokens=true audit_events=6 api_db_least_privilege=true log_redaction=true browser_tokens_exposed=false secrets_printed=false
PHASE3_PASSWORD_RECOVERY_RUNTIME_TEST_OK request_accepted=true mailpit_delivery=true token_server_side=true clean_redirect=true reset_success=true old_session_revoked=true new_password_login=true replay_denied=true encrypted_token=true log_redaction=true secrets_printed=false
PHASE3_EMAIL_VERIFICATION_RUNTIME_TEST_OK registration_accepted=true duplicate_enumeration_denied=true mailpit_delivery=true unverified_login_denied=true token_server_side=true clean_redirect=true verification_success=true verified_login=true replay_denied=true encrypted_token=true log_redaction=true secrets_printed=false
API_ENCRYPTION_KEY_ROTATION_OK mode=apply sessions=1 recovery_tokens=0 verification_tokens=0 secrets_printed=false
PHASE3_API_ENCRYPTION_KEY_ROTATION_TEST_OK mode=apply active_session_preserved=true rotation_transaction=true committed=True api_restart=True secrets_printed=false
PHASE3_API_ENCRYPTION_KEY_ROTATION_TEST_OK mode=rollback active_session_preserved=true rotation_transaction=true committed=False api_restart=False secrets_printed=false
PHASE3_REDIS_FAILURE_RUNTIME_TEST_OK ready_fail_closed=true readiness_not_ready=true rate_limit_dependency_denied=true retryable_error=true secrets_printed=false
PHASE3_MFA_RUNTIME_TEST_OK managed_staff_enrollment=true managed_staff_missing_otp_denied=true managed_staff_otp_login=true admin_enrollment=true admin_missing_otp_denied=true admin_otp_login=true admin_recovery=true session_revoke=true totp_rfc6238=true log_redaction=true secrets_printed=false
SECRET_SCAN_OK engine=gitleaks version=8.30.1 scopes=worktree,history redacted=true
STAGE3_SECURITY_RUNTIME_BASELINE_OK default_deny=true least_privilege_self_tfa=true negative_tests=true auth_runtime=true password_recovery=true email_verification=true redis_failure=true csrf=true session_rotation=true identity_revoke=true encryption_key_rotation=true retention=true admin_mfa=true staff_mfa=true license_gate=pass secrets_printed=false
```

`pnpm run validate:stage3` đã pass trên trạng thái hiện tại ngày 2026-08-04. Full validator build lại API image trước live drills, yêu cầu licensed entitlement thật và chạy secret scan trên worktree/history; kết quả local này không được dùng để giả lập CI commit hoặc production deployment evidence.

Các kết quả trên chứng minh licensed least-privilege authorization, auth/session runtime, registration/email verification, password recovery hardening, identity-change revoke, encryption-key rotation, Redis fail-closed, retention boundary và staff/admin MFA/recovery baseline ở local. Không còn local implementation/test gate nào trong phạm vi Phase 3 bị bỏ trống. Chưa có business collection, ownership item filter, production VPN/edge evidence hoặc positive business permission nào được coi là hoàn thành ngoài phase tương ứng.

### 5.2 Closure còn lại

- Product Owner phê duyệt Phase 3 closure và mở Phase 4 Decision Gate.
- CI closure run trên commit cuối sau khi Product Owner yêu cầu commit/push. Không dùng local output để giả lập remote run.
- Cross-user ownership test thuộc Phase 4 sau schema thật, không tạo fixture business giả trong Phase 3.
- WireGuard/private Admin Studio và production retention scheduler execution/alert evidence thuộc Phase 13 theo `OPS-003`, `SEC-005` và `DATA-006`; các mục này không bị đánh dấu pass ở local.

Phase 3 chỉ được chuyển `VERIFIED` khi:

- Tất cả deliverable trong `phase-03-security-identity.md` có artifact versioned.
- Negative permission tests pass cho public, restricted staff/admin và service account. Cross-user ownership là acceptance gate của Phase 4 sau khi schema/entitlement thật tồn tại, không phải lý do tạo business fixture giả trong Phase 3.
- Browser bundle, source map, request/response và log không lộ Directus token hoặc backend secret.
- Session rotation/revoke và entitlement stale-state behavior có test tái hiện được.
- `THREAT_MODEL.md`, security checklist và incident playbook được cập nhật theo implementation thực tế.
- Local/CI validator pass trên commit dùng làm closure evidence.

Phase 4 không được chuyển `VERIFIED` nếu chưa bổ sung positive/cross-user ownership tests trên collection/schema thật theo matrix `SEC-008`.
