# Phase 13 Decision Gate — Deployment, Release & Operations

**Date:** 2026-08-16
**Status:** APPROVED
**Approved by:** Product Owner & Infrastructure Lead
**Decision IDs:** `OPS-008` through `OPS-015`

## Decision Gate Summary

Phase 13 establishes the production deployment, infrastructure architecture, disaster recovery invariants, operational incident runbooks, and budget monitoring for the Vietnam Weather platform on an owner-managed VPS (`OPS-003`).

---

## OPS-008 — Production VPS Infrastructure Baseline

**Ruling:** Production will be hosted on an owner-managed Linux VPS running **Ubuntu 24.04 LTS x64**, located in a Southeast Asian data center (Vietnam or Singapore) ensuring round-trip latency to Vietnamese users remains under 50ms.
- **Capacity:** Minimum 4 vCPU, 8 GB RAM, 80 GB NVMe SSD storage.
- **Portability:** Zero cloud vendor lock-in (`ADR-008`). All services run within standard OCI-compliant containers orchestrated by Docker Engine 27+ and Docker Compose v2.
- **Network Interface:** Public ports 80 (HTTP) and 443 (HTTPS) exposed via the `web` reverse proxy. SSH access strictly secured via key-based authentication on a non-standard port with password authentication disabled.

---

## OPS-009 — Multi-Tier Production Topology & Network Isolation

**Ruling:** Production container services are deployed via `compose.prod.yaml` using strict network segmentation:
1. **Application Network (`application`):** Bridge network connecting the public `web` reverse proxy, `api` service (8080), `worker` service (8081), and `directus` service.
2. **Data Network (`data`, `internal: true`):** Isolated, non-routable internal network hosting the `database` (PostgreSQL/PostGIS 16) and `redis` (7-Alpine) containers. Neither database nor Redis ports may be bound or mapped to the host network interface.

---

## OPS-010 — Private Directus Admin Studio Ingress

**Ruling:** In accordance with `SEC-002`, the Directus Admin Studio (`:8055`) is never exposed to the public internet:
- Bound strictly to host loopback `127.0.0.1:8055` or an internal WireGuard VPN interface.
- Public web reverse proxy blocks all external `/admin` paths.
- System administration and content management take place exclusively through authenticated VPN sessions or secure SSH local port forwarding.

---

## OPS-011 — Zero-Downtime Deployment & Health Gating

**Ruling:** Production updates use container rolling recreation with health-gated dependencies:
- Deployments use `docker compose -f compose.prod.yaml up -d --build --remove-orphans`.
- Container startup ordering is gated by health checks:
  - Database must be healthy (`pg_isready`) before API, Worker, or Directus start.
  - Redis must be healthy (`redis-cli ping`) before API or Worker start.
  - Directus and Redis must be healthy before API and Worker mark readiness.
- The `web` reverse proxy continues serving cached assets and API proxying until newly spawned backend containers report HTTP 200 on `/health/ready`.
- Any schema migration must be verified backwards-compatible with the currently running application before execution.

---

## OPS-012 — Disaster Recovery & Backup Invariants (RPO / RTO)

**Ruling:** Disaster recovery standards are formally defined and verified:
- **Recovery Point Objective (RPO):** $\le$ 24 hours. Daily automated database dump (`pg_dump -Fc`) executed at 02:00 `Asia/Ho_Chi_Minh`.
- **Recovery Time Objective (RTO):** $\le$ 1 hour. Full system recovery from cold backup must complete within 60 minutes.
- **Backup Verification Drill:** Backups must include automated SHA256 checksums and undergo automated restore rehearsal into an isolated database to verify table counts and PostGIS functionality before archiving.
- **Retention:** 30 days of rolling daily backups maintained on-server, replicated to an off-site S3-compatible encrypted cold bucket.

---

## OPS-013 — Monthly Operating Cost Envelope Enforcement

**Ruling:** Monthly operating expenses must remain strictly below the **15,000,000 VND / month** budget ceiling (`OPS-002`):
- **Cost Allocation:**
  - VPS Hosting: ~1,500,000 - 2,500,000 VND / month.
  - WeatherAPI Subscription: ~1,000,000 - 2,000,000 VND / month.
  - Geoapify Routing/Geocoding: ~1,500,000 - 3,000,000 VND / month.
  - Domain, SSL & Offsite Backup: ~500,000 VND / month.
  - Headroom & Operational Buffer: ~7,000,000 VND / month.
- **Alert Tiers:** Automated budget alerts trigger at:
  - **50% (7,500,000 VND):** Informational notice.
  - **75% (11,250,000 VND):** Operations review.
  - **90% (13,500,000 VND):** Non-critical quota throttling.
  - **100% (15,000,000 VND):** Hard fail-closed stop on auto-spend APIs (`OPS-006`).

---

## OPS-014 — Secret Lifecycle & Non-Root Container Execution

**Ruling:**
- Zero secrets, database passwords, or private keys may ever be committed to git or baked into Docker image layers.
- Production environment configurations (`.env.production`) are generated using cryptographically secure random sources (`tools/environment/generate-production-secrets.ps1`).
- All runtime containers (`web`, `api`, `worker`) must execute under unprivileged non-root users (`node`, `nginx`). Root execution is strictly prohibited in production containers.

---

## OPS-015 — Operations Runbooks & Incident Response Governance

**Ruling:** The platform must maintain actionable, copy-pasteable operational runbooks in `docs/operations/`:
- `RUNBOOK_DEPLOYMENT.md`: Step-by-step zero-downtime release, preflight checks, and rollback procedure.
- `RUNBOOK_INCIDENT_RESPONSE.md`: Triage and remediation workflows for WeatherAPI outages, Geoapify latency, payment webhook failures, Redis outages, and secret compromise.
- `RUNBOOK_BACKUP_RESTORE.md`: Automated backup scheduling, off-site replication, and full disaster restore drills.
- `RUNBOOK_MONITORING_ALERTS.md`: Health monitoring, log tracing via correlation IDs, budget tracking, and escalation contacts.
