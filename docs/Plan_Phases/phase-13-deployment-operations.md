# Phase 13 — Deployment, Release & Operations

**Status:** BLOCKED  
**Phụ thuộc:** Phase 12 VERIFIED  
**Mục tiêu:** Triển khai production bằng quy trình có kiểm soát, rollback được, có backup và vận hành rõ ràng.

## Phạm vi công việc

### 1. Infrastructure and network

- Provision bằng IaC hoặc cấu hình version hóa theo ADR.
- Directus, worker, PostgreSQL/PostGIS, Redis, object storage và payment integration trong network boundary đã duyệt.
- Database/cache không public; Admin Studio theo access control đã chốt.
- TLS certificate, domain, WAF/reverse proxy, secure headers và rate limit production.
- Secret injection từ secret manager; không copy `.env` thủ công không kiểm soát.

### 2. CI/CD and release

- Build immutable, signed/scanned artifacts nếu toolchain hỗ trợ.
- Promotion development → staging → production bằng approval gate.
- Schema/config migration chạy preflight, backup và compatibility check.
- Chọn rolling, blue-green hoặc canary phù hợp kiến trúc.
- Feature flags cho rollout rủi ro cao và Pro/payment.
- Rollback code/config/schema được rehearsal.

### 3. Billing and scheduled jobs

- Production webhook endpoint có domain/TLS, signature verification và replay protection.
- Scheduled weather ingestion, quota reset, subscription reconciliation và retention jobs có owner.
- Job retry/dead-letter và alert khi webhook/entitlement projection bị trễ.
- Payment provider outage không làm mất subscription history hoặc tự cấp Pro vô thời hạn.

### 4. Data protection

- Automated backup database/object storage theo RPO.
- Encryption at rest/in transit theo platform capability.
- Restore test trên environment cô lập.
- Retention và deletion jobs được monitoring.
- Không dùng production dump cho development nếu chưa anonymize/approve.

### 5. Operations

- Runbook startup/shutdown, provider outage, payment outage, webhook lag, queue backlog, credential rotation, database incident và rollback.
- On-call/escalation ownership.
- Capacity/cost dashboards và budget alert.
- Scheduled security/dependency/Directus update process.
- Status page hoặc communication process khi incident ảnh hưởng user.

## Deliverables và evidence

- Production architecture inventory và IaC/config repository.
- Deployment pipeline + approval logs.
- Backup/restore and rollback drill reports.
- Payment webhook smoke test và subscription reconciliation report.
- Operations runbooks và escalation matrix.
- Production smoke test và release evidence.

## Acceptance criteria

- Production deploy không cần sửa source hoặc secret thủ công trên server.
- Có thể rollback release trong mục tiêu RTO đã chốt.
- Backup phục hồi được trên bài test, không chỉ tồn tại file backup.
- Secret rotation không cần commit code.
- Health/readiness, metrics, logs và alerts hoạt động sau deploy.
- Public endpoints chỉ expose đúng services, permissions và Pro gates đã duyệt.
- Payment webhook retry không tạo duplicate charge state hoặc entitlement sai.

## Decision Gate — phải hỏi và chốt với bạn

**Đã chốt:** Production self-hosted trên VPS/server do Product Owner quản lý; deployment local-first và không khóa cloud vendor (`OPS-003`).

1. VPS region, OS, capacity, network và domain/DNS chính thức là gì?
2. Chọn managed PostgreSQL/Redis/object storage hay tự vận hành?
3. Deployment strategy và maintenance window mong muốn là gì?
4. RPO/RTO và backup retention chính thức là bao nhiêu?
5. Ai có quyền approve production release và rollback?
6. Cơ chế cảnh báo tại 50%/75%/90%/100% của ceiling 15 triệu VND/tháng gửi cho ai?
7. Có cần status page, on-call 24/7 hoặc support theo giờ hành chính?
