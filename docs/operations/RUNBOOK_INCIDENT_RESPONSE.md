# Operations Runbook — Incident Response & Triage

**Document ID:** `RUNBOOK-INC-001`  
**Decisions:** `QUAL-002`, `QUAL-006`, `QUAL-007`, `OPS-014`, `OPS-015`  
**Incident Severity Matrix:**
- **SEV-1 (Critical):** Public API down, database inaccessible, data corruption, or payment state corrupted. Target response: < 15 minutes.
- **SEV-2 (High):** Upstream provider failure (WeatherAPI, Geoapify), webhook processing backlog > 5 minutes, or Pro entitlement latency. Target response: < 1 hour.
- **SEV-3 (Medium):** Cache degradation, non-blocking rate limit spikes, or single container restarts. Target response: < 4 hours.

---

## 1. Scenario: WeatherAPI Upstream Outage / Provider Failure (`QUAL-006`)

### Symptoms
- Ingestion worker logs: `WEATHER_PROVIDER_FETCH_TIMEOUT` or HTTP 5xx from WeatherAPI.
- Circuit breaker trips in `worker` and `api`.
- Users report degraded banner or stale indicator on map/location views.

### Diagnostic Actions
1. Check worker logs:
   ```bash
   docker compose -f compose.prod.yaml logs --tail=100 worker | grep -E "circuit|error|provider"
   ```
2. Verify provider status externally:
   ```bash
   curl -I https://api.weatherapi.com/v1/forecast.json
   ```

### Remediation & Invariant Checks
- **Zero-Fake-Data Invariant (`QUAL-006`):** Confirm that the API is returning structured `degraded: true` / `freshness: "stale"` or `"unavailable"` responses. Verify that the platform is NOT fabricating fake weather values.
- Circuit breaker automatically opens after 3 consecutive failures (`WEATHER_PROVIDER_CIRCUIT_FAILURE_THRESHOLD: 3`) and resets after 60s (`WEATHER_PROVIDER_CIRCUIT_RESET_MS: 60000`).
- If outage is prolonged (>2 hours), post a notice on the status banner via Directus announcement settings.

---

## 2. Scenario: Payment Webhook Latency or Verification Failure (`QUAL-007`)

### Symptoms
- User reports upgrading to Pro but capabilities remain Free.
- API logs show `BILLING_INVALID_SIGNATURE` or HTTP 400 on `/api/v1/billing/webhook/stripe` or `/api/v1/billing/webhook/vnpay`.

### Diagnostic Actions
1. Search billing audit log for the user:
   ```bash
   docker compose -f compose.prod.yaml logs --tail=200 api | grep -E "billing|webhook|stripe|vnpay"
   ```
2. Inspect Stripe or VNPay dashboard to confirm webhook dispatch status and response codes.

### Remediation
1. If signature verification failed: check if webhook secrets in `.env.production` (`STRIPE_WEBHOOK_SECRET` / `VNPAY_HASH_SECRET`) were rotated out of sync.
2. If network timeout occurred: trigger manual retry from provider dashboard (Stripe dashboard -> Webhooks -> Resend).
3. **Idempotency Guarantee:** Redelivered webhooks are safely reconciled via the `processedEvents` ledger without double-crediting.
4. If urgent compensation is required, execute manual Pro grant via Admin Studio (`MONET-008`):
   ```bash
   # Records audit log with operator ID, duration, and justification
   ```

---

## 3. Scenario: Redis Cache Outage / Unavailability (`QUAL-006`)

### Symptoms
- `/health/ready` reports HTTP 503 `status: "not_ready"`.
- Application API logs show `REDIS_UNAVAILABLE` or connection timeout.

### Diagnostic Actions
1. Check Redis container status:
   ```bash
   docker compose -f compose.prod.yaml ps redis
   docker compose -f compose.prod.yaml logs --tail=50 redis
   ```
2. Probe Redis directly on internal network:
   ```bash
   docker compose -f compose.prod.yaml exec redis redis-cli ping
   ```

### Remediation
1. Restart the Redis container:
   ```bash
   docker compose -f compose.prod.yaml restart redis
   ```
2. Verify in-memory degradation: While Redis is recovering, cached requests fall back to direct PostgreSQL query or in-memory LRU without crashing user sessions.
3. Check AOF file integrity if restart loops:
   ```bash
   docker compose -f compose.prod.yaml exec redis redis-check-aof --fix /data/appendonly.aof
   ```

---

## 4. Scenario: Database Connection Pool Saturation (`ARCH-005`)

### Symptoms
- API responses slow down with HTTP 500 `INTERNAL_ERROR`.
- PostgreSQL logs: `FATAL: remaining connection slots are reserved for non-superuser connections`.

### Diagnostic Actions
1. Query active connections:
   ```bash
   docker compose -f compose.prod.yaml exec database psql -U directus -d directus -c \
     "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
   ```
2. Identify long-running queries:
   ```bash
   docker compose -f compose.prod.yaml exec database psql -U directus -d directus -c \
     "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 5;"
   ```

### Remediation
1. Terminate orphaned backend connections:
   ```bash
   docker compose -f compose.prod.yaml exec database psql -U directus -d directus -c \
     "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND now() - state_change > interval '5 minutes';"
   ```
2. Restart API containers to recycle connection pools:
   ```bash
   docker compose -f compose.prod.yaml restart api
   ```

---

## 5. Scenario: Compromised Secret / Credential Leak (`OPS-014`)

### Protocol
If an API key, database password, or session key is suspected to be exposed:
1. **Rotate immediately:** Run `tools/environment/generate-production-secrets.ps1` to generate clean cryptographic keys.
2. **Rotate provider keys:** Regenerate WeatherAPI, Geoapify, Stripe, or VNPay credentials via their respective vendor consoles.
3. **Apply and restart:**
   ```bash
   docker compose --env-file .env.production -f compose.prod.yaml up -d --remove-orphans
   ```
4. **Invalidate active sessions:** Update `API_SESSION_ENCRYPTION_KEY` which instantly renders all prior session handles unreadable, forcing users to re-authenticate securely.
