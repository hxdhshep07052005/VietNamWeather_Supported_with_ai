# Operations Runbook — Monitoring, Alerts & Budget Governance

**Document ID:** `RUNBOOK-MON-001`  
**Decisions:** `OPS-002`, `OPS-005`, `OPS-013`, `QUAL-004`  
**Budget Ceiling:** 15,000,000 VND / month  
**Escalation Ownership:** Product Owner / Technical Owner (Solo Full-Time Delivery per `OPS-004`)

---

## 1. System Health Monitoring Architecture

The platform exposes two standardized health probes monitored continuously:

| Endpoint | Frequency | Success Code | Check Scope | Alert Trigger |
| :--- | :--- | :--- | :--- | :--- |
| `/health/live` | Every 30s | HTTP 200 | Liveness of Fastify process & event loop | 3 consecutive failures -> Restart API container |
| `/health/ready` | Every 60s | HTTP 200 | Deep check: Database pool, Redis ping, Directus readiness, verification & recovery stores | 2 consecutive failures -> Page on-call operator |

### Uptime Monitoring Probe Script
On an external monitoring agent (e.g. Uptime Kuma, BetterStack, or simple cron probe):
```bash
#!/bin/bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://weather.example.vn/health/ready)
if [ "$STATUS" -ne 200 ]; then
  echo "CRITICAL: System readiness check failed with HTTP $STATUS"
  # Send Telegram / Discord webhook notification
fi
```

---

## 2. Distributed Log Tracing via Correlation ID (`QUAL-004`)

Every request traversing the stack carries an immutable `correlationId`:
1. Inbound request: client sends `x-correlation-id` or API generates `api_<hex>`.
2. Public Nginx reverse proxy logs `$http_x_correlation_id`.
3. Fastify application logs contain `req.id` / `correlationId`.
4. Error responses return `{ "error": { "correlationId": "api_xxxx", ... } }`.

### Searching Logs for an Incident
To trace a specific user request across all services:
```bash
CORR_ID="api_abcdef0123456789"

# Search API logs
docker compose -f compose.prod.yaml logs api | grep "$CORR_ID"

# Search Web reverse proxy logs
docker compose -f compose.prod.yaml logs web | grep "$CORR_ID"
```

---

## 3. Monthly Operating Cost Envelope Enforcement (`OPS-002`, `OPS-013`)

The platform enforces a strict operating cost ceiling of **15,000,000 VND / month**:

```
Budget Envelope Breakdown:
+--------------------------------------------------------------+
| VPS Server (Ubuntu 24.04, 4 vCPU, 8 GB RAM):   ~2,000,000 VND|
| WeatherAPI Enterprise Forecast Calls:          ~2,000,000 VND|
| Geoapify Routing & Geocoding:                  ~2,500,000 VND|
| Domain, SSL, Email & Storage:                    ~500,000 VND|
| Emergency Headroom & Growth Buffer:            ~8,000,000 VND|
+--------------------------------------------------------------+
| Total Maximum Operating Ceiling:              15,000,000 VND |
+--------------------------------------------------------------+
```

### Automated Alert Tiers & Action Plan

| Tier | Spend Level (VND) | Notification Channel | Mandatory Action |
| :--- | :--- | :--- | :--- |
| **50%** | 7,500,000 VND | Email / Telegram notice | Informational report; review daily projection trends. |
| **75%** | 11,250,000 VND | Urgent alert to Operator | Audit external API consumption (WeatherAPI, Geoapify). Increase cache TTL if needed (`API_WEATHER_CACHE_TTL_SECONDS`). |
| **90%** | 13,500,000 VND | High-priority page | Enable non-critical query rate throttling. Restrict unregistered public routing requests. |
| **100%** | 15,000,000 VND | Critical incident page | **Hard Fail-Closed (`OPS-006`):** Freeze paid provider burst calls. Serve exclusively cached weather and pre-calculated routes until month rollover. |

---

## 4. On-Call Escalation Matrix (`PRODUCT-010`, `OPS-004`)

| Role | Contact | Primary Responsibility |
| :--- | :--- | :--- |
| **Primary On-Call** | Product Owner / Tech Lead | Triage, container restart, rollback decision, provider communication. |
| **Emergency Escalation** | Designated Technical Backup | VPS provider console access, domain registrar control, DNS emergency switch. |
