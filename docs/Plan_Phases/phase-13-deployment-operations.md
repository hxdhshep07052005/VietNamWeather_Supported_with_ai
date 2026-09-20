# Phase 13 — Deployment, Release & Operations

**Status:** VERIFIED  
**Phụ thuộc:** Phase 12 VERIFIED  
**Mục tiêu:** Triển khai production bằng quy trình có kiểm soát, rollback được, có backup và vận hành rõ ràng.  
**Decision Gate:** Đã phê duyệt chính thức tại [`PHASE_13_DECISIONS.md`](PHASE_13_DECISIONS.md) (`OPS-008..015`).

## Phạm vi công việc

### 1. Infrastructure and network

- Provision bằng IaC hoặc cấu hình version hóa theo ADR (`compose.prod.yaml`).
- Directus, worker, PostgreSQL/PostGIS, Redis, object storage và payment integration trong network boundary đã duyệt (`data` internal: true).
- Database/cache không public; Admin Studio theo access control đã chốt (chỉ bound `127.0.0.1:8055` / VPN theo `SEC-002`/`OPS-010`).
- TLS certificate, domain, WAF/reverse proxy (`infra/nginx/nginx.conf`), secure headers và rate limit production.
- Secret injection từ secret generator (`tools/environment/generate-production-secrets.ps1`); không copy `.env` thủ công không kiểm soát.

### 2. CI/CD and release

- Build immutable, signed/scanned artifacts (`apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/worker/Dockerfile`).
- Promotion development -> staging -> production bằng approval gate.
- Schema/config migration chạy preflight, backup và compatibility check.
- Chọn rolling deployment với Compose healthcheck dependencies.
- Rollback code/config/schema được rehearsal và ghi vào runbook.

### 3. Billing and scheduled jobs

- Production webhook endpoint có domain/TLS, signature verification và replay protection.
- Scheduled weather ingestion, quota reset, subscription reconciliation và retention jobs có owner.
- Job retry/dead-letter và alert khi webhook/entitlement projection bị trễ.
- Payment provider outage không làm mất subscription history hoặc tự cấp Pro vô thời hạn.

### 4. Data protection

- Automated backup database/object storage theo RPO <= 24h (`tools/database/backup-prod.ps1`).
- Encryption at rest/in transit theo platform capability.
- Restore test trên environment cô lập theo RTO <= 1h (`tools/database/restore-prod-drill.ps1`).
- Retention 30 ngày cho backup file có SHA256 checksum.

### 5. Operations

- Runbook startup/shutdown, provider outage, payment outage, webhook lag, queue backlog, credential rotation, database incident và rollback trong `docs/operations/`.
- On-call/escalation ownership theo `PRODUCT-010` và `OPS-004`.
- Capacity/cost dashboards và budget alert (50%, 75%, 90%, 100% của 15.000.000 VND/tháng theo `OPS-002`/`OPS-013`).

## Deliverables và evidence

- `compose.prod.yaml`: Production multi-tier compose topology với network isolation (`data` internal: true).
- `apps/web/Dockerfile` & `infra/nginx/nginx.conf`: Unprivileged Nginx reverse proxy phục vụ SPA routing và proxying `/api/v1/`.
- `tools/environment/generate-production-secrets.ps1`: Automated cryptographic production secret generator.
- `tools/database/backup-prod.ps1`: Automated daily database backup with SHA256 verification and 30-day retention.
- `tools/database/restore-prod-drill.ps1`: Automated disaster recovery drill tool.
- Operational Runbooks trong `docs/operations/`:
  - [`RUNBOOK_DEPLOYMENT.md`](../operations/RUNBOOK_DEPLOYMENT.md)
  - [`RUNBOOK_INCIDENT_RESPONSE.md`](../operations/RUNBOOK_INCIDENT_RESPONSE.md)
  - [`RUNBOOK_BACKUP_RESTORE.md`](../operations/RUNBOOK_BACKUP_RESTORE.md)
  - [`RUNBOOK_MONITORING_ALERTS.md`](../operations/RUNBOOK_MONITORING_ALERTS.md)
- Validation script: `tools/validation/validate-stage13.ps1` **ALL GATES PASSED**.

## Acceptance criteria & Verification Evidence

- Production deploy không cần sửa source hoặc secret thủ công trên server (`OPS-014`).
- Có thể rollback release trong mục tiêu RTO <= 1h (`RUNBOOK_DEPLOYMENT.md`, `RUNBOOK_BACKUP_RESTORE.md`).
- Backup phục hồi được trên bài test, có SHA256 checksum (`tools/database/restore-prod-drill.ps1` PASS).
- Secret rotation không cần commit code (`tools/environment/generate-production-secrets.ps1`).
- Health/readiness, metrics, logs và alerts hoạt động sau deploy (`/health/live`, `/health/ready`).
- Public endpoints chỉ expose đúng services: Nginx chặn tuyệt đối `/admin` (HTTP 403) và chỉ proxy `/api/v1/` và static assets.
- Payment webhook retry không tạo duplicate charge state hoặc entitlement sai (`QUAL-007`).
- 100% automated test pass rate across monorepo: **207 / 207 tests PASS** (`apps/api`: 160, `apps/worker`: 35, `apps/web`: 12).
- Zero TypeScript errors (`pnpm run typecheck` clean).
- Zero ESLint errors and warnings (`pnpm run lint` clean).

## Decision Gate — Kết quả thẩm định chính thức (`OPS-008..015`)

1. **VPS Infrastructure (`OPS-008`):** Ubuntu 24.04 LTS x64, 4 vCPU, 8 GB RAM, 80 GB NVMe, Vietnam/Singapore region (<50ms latency).
2. **Topology & Network Isolation (`OPS-009`):** Database & Redis chạy trên internal non-routable data network; ports không bind ra host.
3. **Private Admin Studio (`OPS-010`, `SEC-002`):** Directus Admin Studio bound strictly `127.0.0.1:8055`; Nginx return 403 trên `/admin`.
4. **Zero-Downtime Deployment (`OPS-011`):** Rolling container update với healthcheck dependency gating.
5. **RPO / RTO & Backup (`OPS-012`):** RPO <= 24h, RTO <= 1h, 30 ngày retention, SHA256 checksums, restore drill định kỳ.
6. **Budget Ceiling (`OPS-013`, `OPS-002`):** 15.000.000 VND/tháng với alert tiers tại 50%, 75%, 90%, 100%.
7. **Secret Security & Non-Root (`OPS-014`):** Random crypto generator, non-root users (`node`, `nginx`) trong container runtime.
8. **Runbooks & Governance (`OPS-015`):** 4 runbooks đầy đủ trong `docs/operations/`.
