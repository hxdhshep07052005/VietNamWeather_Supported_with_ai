# Phase 3 Runtime Security Implementation

**Status:** IMPLEMENTED_BASELINE / CLOSURE_PENDING  
**Phase:** 3 — Identity, JWT, RBAC & Security  
**Contract:** `SEC-007`, `SEC-008`, `SEC-009`, `SEC-010`  
**Directus path:** `ARCH-015` (Open Innovation Grant entitlement active locally)

## Runtime boundary

- `apps/api` is the only browser-facing Application API. The browser receives an opaque `__Host-` session cookie and a separate CSRF token; it never receives Directus access/refresh tokens.
- Directus remains the identity authority. The API calls Directus over the private Compose network and treats `/users/me` success plus the Directus-issued, server-held JWT identity claims as one validated identity result. The browser cannot provide or override these claims.
- Default-deny Phase 3 policies intentionally expose only the minimum self identity (`id`) to the traveler. Email, role metadata and business profile fields stay out of the session DTO until an approved collection/field mapping exists in Phase 4.
- Session records and sanitized security audit events live in PostgreSQL schema `app_security`. Directus tokens are AES-256-GCM encrypted at rest; only SHA-256 session-handle hashes are indexed. Redis is used only for distributed rate limiting.

## Controls implemented

| Control | Implementation | Verification |
|---|---|---|
| Login | `POST /api/v1/auth/login`, server-to-server Directus login | Live Directus test |
| Refresh rotation | `POST /api/v1/auth/refresh`, atomic opaque-handle replacement and replay denial | Unit + live test |
| Logout/revoke | `POST /api/v1/auth/logout`, local family revoke before upstream best-effort logout | Unit + live test |
| Identity-change revoke | PostgreSQL trigger revokes all active application sessions after password, status, role, MFA-secret change or user deletion | Live Directus/API/database test |
| CSRF/origin | Signed `__Host-` CSRF cookie, header token, explicit Origin/Host allowlist | Unit + live test |
| Headers/CORS | Helmet CSP/HSTS, exact-origin credentials, no-store DTOs | Unit test |
| Rate/payload limits | Redis-backed Fastify limiter and validated body limit | Unit test |
| Redaction | Pino paths redact cookies, authorization and credential fields; live log marker scan | Live test |
| DB least privilege | API DB identity can use `app_security` but cannot read Directus credential columns | Live database test |
| Retention/purge | DB-owner-only purge function; API role cannot execute it or delete audit rows; future cutoffs fail closed | Live transaction/rollback test |
| Redis failure | Readiness bypasses the rate limiter, reports `not_ready`/503 when Redis is unavailable, and rate-limited API routes return retryable dependency failure instead of trusting a fallback | Live Redis stop/start drill |
| Admin MFA/recovery | Directus TOTP enrollment, missing-OTP denial, OTP login and admin recovery | Live Directus test |
| Password recovery | Directus reset mail through allowlisted consume URL, encrypted server-side token exchange, clean fragment redirect, one-time handle and session revoke | Live Mailpit/Directus/API test |
| Registration/email verification | Generic registration response, approved traveler role, required verification, encrypted token exchange, clean fragment redirect and one-time handle | Unit + live Mailpit/Directus/API test |
| Encryption-key rotation | Transactional re-encryption for session, recovery and verification ciphertext; committed local drill preserves an active session after API restart | Rollback + committed live drill |

## Configuration contract

Application values are injected through `.env.local`/deployment secrets and validated by `loadApiConfig`; retention values are validated by the environment/maintenance tooling. No frontend or business code owns these values.

- Directus access token TTL: `10m` and refresh token TTL: `14d` (`SEC-004`).
- Application session maximum: `14` days; user concurrency: `5`; staff/admin baseline: `2` (`SEC-004`).
- Cookie names must use `__Host-`, with `Secure`, `HttpOnly`, `Path=/`, no `Domain`, and configured `SameSite`.
- API origins are an explicit comma-separated allowlist. Wildcards and credentialed wildcard CORS are rejected.
- Encryption/signing keys are 32-byte base64url secrets generated locally by `initialize-local-env.ps1` or `upgrade-local-phase3-env.ps1`.
- Rate and payload values remain deployment configuration and require load/security review before production promotion.
- Redis connection/command timeout is deployment configuration (`API_REDIS_TIMEOUT_MS`); missing or out-of-range values stop API startup, and Redis loss fails readiness/mutations closed.
- Security/session retention is `90` days, security audit retention is `12` months and billing-reference retention is `24` months through versioned environment configuration (`DATA-006`). Billing deletion is not implemented before its Phase 8 schema and legal gate exist.

## Reproducible commands

```powershell
pnpm --filter @vietnam-weather/api build
pnpm --filter @vietnam-weather/api test
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-auth-runtime.ps1
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-password-recovery.ps1
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-email-verification.ps1
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-encryption-key-rotation.ps1
powershell -ExecutionPolicy Bypass -File tools/api/test-phase3-redis-failure.ps1
powershell -ExecutionPolicy Bypass -File tools/database/test-phase3-security-retention.ps1
powershell -ExecutionPolicy Bypass -File tools/directus/test-phase3-mfa.ps1
powershell -ExecutionPolicy Bypass -File tools/validation/validate-stage3.ps1
pnpm lint
pnpm typecheck
pnpm test
```

The live drills create temporary Directus identities and transaction-scoped database fixtures. They verify login/refresh/replay/logout, registration/email verification, password recovery, password/status/role/MFA session revocation, encrypted session state, encryption-key rotation, Redis failure behavior, retention boundaries, API database least privilege, admin TOTP/recovery and log redaction, then remove or roll back all fixtures. They print no credential, OTP secret or token value.

## Remaining closure gates

- Licensed Directus runtime evidence passes `validate-license.ps1 -RequireLicensed`: Open Innovation Grant is active with production and custom permissions enabled. The credential remains only in protected runtime environment state.
- Admin and managed-staff MFA enrollment/login work in the live licensed runtime. Each human staff policy has one self-scoped `directus_users:update` permission limited to `tfa_secret`; direct field mutation is rejected by Directus, authorization-field mutation and cross-user TFA mutation remain denied.
- Ownership/field/item permissions for business data remain Phase 4 work because the real business collections do not exist yet; no placeholder business permission or fake fixture is used to close Phase 3.
- Password reset and email verification now follow accepted `SEC-009`/`SEC-010`: Directus native tokens are allowed only on redacted consume requests; the browser receives only clean URL-fragment handles. Registration duplicate enumeration, token encryption, expiry/replay denial and verified-login transition pass live tests.
- Security checklist, incident response, access review, key rotation, Redis failure and retention procedures are versioned in [`PHASE_3_SECURITY_OPERATIONS.md`](PHASE_3_SECURITY_OPERATIONS.md). Admin Studio WireGuard evidence, production scheduler execution and CI closure evidence remain pending external/runtime proof.
- Phase 4 must map the approved logical matrix to real collections and add positive/cross-user ownership tests before Phase 4 can be marked `VERIFIED`; Phase 3 evidence must not invent business fixtures to satisfy that later gate.
