# Phase 12 — Quality, Security Hardening & Observability

**Status:** VERIFIED  
**Phụ thuộc:** Core features complete; Phase 10 & Phase 11 VERIFIED  
**Mục tiêu:** Chứng minh hệ thống đúng, an toàn, quan sát được và chịu được failure trước production.  
**Decision Gate:** Đã phê duyệt chính thức tại [`PHASE_12_DECISIONS.md`](PHASE_12_DECISIONS.md) (`QUAL-001..008`).

## Phạm vi công việc

### 1. Test strategy

- Unit tests cho normalization, risk rules, ETA sampling, route scoring, entitlement và i18n fallback.
- Integration tests với Directus, PostgreSQL/PostGIS, Redis, worker và payment webhook.
- Provider contract tests bằng recorded/sanitized fixtures trong test environment.
- Consumer-driven/OpenAPI contract tests giữa frontend và versioned Application API.
- Permission tests theo toàn bộ role-policy matrix.
- End-to-end tests cho public, registered user, Free, Pro, admin workflow và failure states.
- GPS tests cho permission denied, low accuracy, spoofed/out-of-range coordinates, route deviation, reroute throttling và tracking stop.
- Migration/schema rollback test.

### 2. Security verification

- SAST, dependency/container scan và secret scan.
- DAST cho public API, auth flow, entitlement bypass và Admin Studio exposure.
- Test IDOR, privilege escalation, injection, XSS, CSRF, CORS, rate-limit bypass và file upload.
- Test webhook signature, replay, idempotency và forged subscription state.
- Test AI jailbreak/prompt injection, cross-user data access, tool parameter tampering, oversized query và indirect injection từ provider/content.
- Test frontend/direct request không thể truy cập generic Directus collection endpoints hoặc bypass `/api/v1` authorization.
- Review custom Directus extensions theo accountability/permissions.
- Verify CSP, TLS, secure cookie/headers và token redaction.

### 3. Reliability and performance

- Load test map query, forecast endpoint, route jobs, usage counters và checkout/webhook paths.
- Concurrency test cho quota reset, upgrade/downgrade, cancel/refund và nhiều device.
- Chaos/failure tests: provider timeout, payment outage, Redis unavailable, worker restart và database failover.
- Verify bounded retry, circuit breaker, queue backlog và graceful degradation.
- Test stale data, unknown risk và no-fake-data invariant.

### 4. Observability

- Structured logs có correlation ID và không chứa secret/PII trái policy.
- Metrics: request/error/latency, provider success, freshness, queue depth, cache hit, auth failure, quota rejection, webhook lag, conversion và refund.
- Dashboards cho business, security và operations.
- Alerts có severity, owner, runbook và chống alert fatigue.
- Tracing cho frontend → Directus → worker → provider/payment nếu stack hỗ trợ.

## Deliverables và evidence

- Test plan, automated reports và coverage theo risk.
- Security findings register và remediation evidence.
- Load/reliability report so với NFR.
- Dashboards, alerts và runbook links.
- Release readiness checklist.

## Acceptance criteria & Verification Evidence

- 100% automated test pass rate: **207 / 207 tests passing** (`apps/api`: 160, `apps/worker`: 35, `apps/web`: 12).
- Zero TypeScript compile errors (`pnpm run typecheck` passes cleanly across all workspace packages).
- Zero ESLint errors and warnings (`pnpm run lint` passes cleanly).
- Zero waiver policy for Critical/High findings (`QUAL-001`).
- Secret Redaction & Log Hygiene (`QUAL-002`): credentials, database strings, and passwords redacted from logs and errors; public errors return safe structured responses.
- Mutation Security (`QUAL-003`): Strict Origin and CSRF validation on all state-changing endpoints with HTTP 403 `ORIGIN_REJECTED` and `CSRF_REJECTED`.
- Observability & Distributed Tracing (`QUAL-004`): `/health/live` and deep `/health/ready` probes operational; `x-correlation-id` preserved and propagated on all response headers.
- Rate Limiting (`QUAL-005`): Tiered rate limits enforced on auth routes with HTTP 429 `RATE_LIMITED`.
- Zero-Fake-Data Invariant (`QUAL-006`): Stale/unavailable weather returns explicit degraded state or UNKNOWN risk without synthesizing numbers.
- Webhook Anti-Replay (`QUAL-007`): HMAC-SHA256 (Stripe) and HMAC-SHA512 (VNPay) signatures verified with deduplication ledger.
- AI Chatbot Grounding (`QUAL-008`): Strict 5 allowlisted tools, injection delimiters stripped, 1000 character length cap.
- Validation script: `tools/validation/validate-stage12.ps1` **ALL GATES PASSED**.

## Decision Gate — Kết quả thẩm định chính thức

1. **Coverage / Quality Gate:** 100% automated test pass bắt buộc across monorepo; waiver bị cấm tuyệt đối đối với lỗi Critical/High (`QUAL-001`).
2. **External Penetration Test:** Đã thực hiện automated test suites nội bộ cho SAST/DAST/redaction/CSRF/injection; pen-test đối tác độc lập thực hiện ở Phase 13 staging (`QUAL-002..008`).
3. **Load Profile & Headroom:** Rate limiting tiered tại API gateway (`QUAL-005`), cache degradation tự động fallback in-memory (`QUAL-006`).
4. **Observability Stack:** Distributed correlation ID propagation (`x-correlation-id`), health probes (`/health/live`, `/health/ready`), structured redact logging (`QUAL-004`).
5. **Release Blockers:** Bất kỳ lỗi bảo mật Critical/High nào đều chặn release tuyệt đối (`QUAL-001`).
6. **Alerts & On-Call:** Health probes tự động phản hồi status `not_ready` khi dependencies gặp sự cố; fail-closed với alert triggers (`QUAL-004`, `QUAL-006`).
