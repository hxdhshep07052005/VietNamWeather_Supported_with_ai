# Phase 12 — Quality, Security Hardening & Observability

**Status:** BLOCKED  
**Phụ thuộc:** Core features complete; Phase 11 nếu được đưa vào release  
**Mục tiêu:** Chứng minh hệ thống đúng, an toàn, quan sát được và chịu được failure trước production.

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

## Acceptance criteria

- Không còn security finding Critical/High chưa được chấp nhận chính thức.
- Permission, entitlement và i18n fallback tests pass.
- Seed idempotency/environment-isolation tests và AI tool authorization tests pass.
- SLO/NFR chính đạt trên staging gần production.
- Provider/payment outage và stale data không tạo dữ liệu giả hoặc mở Pro sai.
- Alert quan trọng được trigger thử và dẫn tới runbook đúng.
- Restore/migration rollback hoặc recovery path đã được rehearsal.

## Decision Gate — phải hỏi và chốt với bạn

1. Mức coverage/quality gate tối thiểu và ai có quyền waive test failure?
2. Có ngân sách cho external penetration test không?
3. Load profile production dự kiến và hệ số headroom là bao nhiêu?
4. Observability stack nào được chọn và log/metric retention bao lâu?
5. Severity nào chặn release tuyệt đối?
6. Ai trực cảnh báo và thời gian phản hồi mục tiêu là bao nhiêu?
